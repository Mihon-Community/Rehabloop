import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { SafetyBanner } from '../../components/SafetyBanner';
import { api, sessionStreamUrl } from '../../lib/api';
import {
  getActiveCameraStream,
  setActiveCameraStream,
  stopActiveCameraStream,
} from '../../lib/camera';
import type { MeasurementEvent, QualityWarningEvent, StreamErrorEvent } from '../../types';

type LiveRouteState = {
  streamToken?: string;
  consentRecordId?: string;
  protocolName?: string;
};

type SessionEvent = MeasurementEvent | QualityWarningEvent | StreamErrorEvent;

const configuredFrameRate = Number(import.meta.env.VITE_FRAME_SAMPLE_RATE ?? 8);
const FRAME_RATE = Number.isFinite(configuredFrameRate)
  ? Math.min(8, Math.max(5, configuredFrameRate))
  : 8;
let cameraDisposalTimer: number | undefined;

export function LiveSessionScreen() {
  const { id: sessionId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const routeState = (location.state ?? {}) as LiveRouteState;
  const videoRef = useRef<HTMLVideoElement>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const sequenceRef = useRef(0);
  const sessionStartAtRef = useRef(Date.now());
  const manualCloseRef = useRef(false);
  const [streamToken, setStreamToken] = useState(routeState.streamToken ?? '');
  const [consentRecordId] = useState(routeState.consentRecordId ?? '');
  const [protocolName] = useState(routeState.protocolName ?? 'Assigned protocol');
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(getActiveCameraStream());
  const [paused, setPaused] = useState(!getActiveCameraStream() || !routeState.streamToken);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [qualityMessage, setQualityMessage] = useState('Waiting for the first frame…');
  const [latestMeasurement, setLatestMeasurement] = useState<MeasurementEvent | null>(null);
  const [repetitionCount, setRepetitionCount] = useState(0);
  const [simulated, setSimulated] = useState(false);

  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
      void videoRef.current.play().catch(() => undefined);
    }
  }, [cameraStream]);

  useEffect(() => {
    if (!sessionId || !streamToken || !cameraStream || paused) return;

    let cancelled = false;
    let socket: WebSocket | null = null;
    let frameTimer: number | undefined;

    // Delay connection by one task so React StrictMode's development-only
    // mount/cleanup check does not open and immediately revoke a stream token.
    const connectTimer = window.setTimeout(() => {
      if (cancelled) return;
      socket = new WebSocket(sessionStreamUrl(sessionId, streamToken));
      socketRef.current = socket;
      setError('');
      setConnected(false);
      setQualityMessage('Connecting to the vision service…');

      socket.onopen = () => {
        setConnected(true);
        setQualityMessage('Camera connected. Keep the full selected leg visible.');
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) {
          setError('This browser could not prepare camera frames.');
          return;
        }

        frameTimer = window.setInterval(
          () => {
            const video = videoRef.current;
            if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
            if (!video.videoWidth || !video.videoHeight) return;
            if (socket?.readyState !== WebSocket.OPEN) return;

            const scale = Math.min(1, 640 / video.videoWidth);
            canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
            canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const encoded = canvas.toDataURL('image/jpeg', 0.65).split(',', 2)[1];
            if (!encoded) return;
            const timestamp = Math.max(0, Date.now() - sessionStartAtRef.current);
            socket.send(
              JSON.stringify({
                type: 'frame',
                session_id: sessionId,
                sequence: sequenceRef.current,
                timestamp_ms: timestamp,
                image_b64: encoded,
              }),
            );
            sequenceRef.current += 1;
          },
          Math.round(1000 / FRAME_RATE),
        );
      };

      socket.onmessage = (message) => {
        try {
          const event = JSON.parse(String(message.data)) as SessionEvent;
          if (event.type === 'measurement') {
            setLatestMeasurement(event);
            setRepetitionCount(event.rep_count);
            setSimulated(Boolean(event.simulated));
            setQualityMessage(
              event.quality.usable
                ? 'Frame passed the movement quality checks.'
                : event.quality.reason || 'Measurement unavailable for this frame.',
            );
          } else if (event.type === 'quality_warning') {
            setRepetitionCount(event.rep_count);
            setSimulated(Boolean(event.simulated));
            setQualityMessage(event.message);
            setLatestMeasurement(null);
          } else if (event.type === 'error') {
            setError(`${event.code}: ${event.message}`);
          }
        } catch {
          setError('The vision service returned an unreadable event.');
        }
      };

      socket.onerror = () =>
        setError('Could not connect to the vision service. Check that it is running.');
      socket.onclose = () => {
        if (frameTimer !== undefined) window.clearInterval(frameTimer);
        setConnected(false);
        if (!manualCloseRef.current) {
          setPaused(true);
          setQualityMessage('The stream disconnected. Resume to reconnect the camera.');
          stopActiveCameraStream();
          setCameraStream(null);
        }
        manualCloseRef.current = false;
      };
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(connectTimer);
      if (frameTimer !== undefined) window.clearInterval(frameTimer);
      if (socket && socket.readyState < WebSocket.CLOSING)
        socket.close(1000, 'session screen changed');
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [cameraStream, paused, sessionId, streamToken]);

  useEffect(() => {
    if (cameraDisposalTimer !== undefined) window.clearTimeout(cameraDisposalTimer);
    cameraDisposalTimer = undefined;
    return () => {
      // StrictMode replays effects immediately in development; defer disposal
      // one task so the replay can cancel it, while real route changes stop tracks.
      cameraDisposalTimer = window.setTimeout(() => {
        socketRef.current?.close(1000, 'session screen left');
        stopActiveCameraStream();
        cameraDisposalTimer = undefined;
      }, 0);
    };
  }, []);

  async function resumeSession() {
    if (!sessionId || !consentRecordId) {
      setError('Return to Camera Setup and start a new session to reconnect.');
      return;
    }
    setBusy(true);
    setError('');
    let newStream: MediaStream | null = null;
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error('Camera access is unavailable in this browser.');
      newStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'user' },
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });

      let started;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          started = await api.startSession(sessionId, consentRecordId);
          break;
        } catch (cause) {
          if (!(cause instanceof Error) || !cause.message.includes('Session cannot be started'))
            throw cause;
          if (attempt === 2) throw cause;
          await new Promise((resolve) => window.setTimeout(resolve, 250));
        }
      }
      if (!started?.stream_token)
        throw new Error('The server did not return a session stream token.');

      manualCloseRef.current = false;
      sequenceRef.current += 1;
      sessionStartAtRef.current = Math.min(sessionStartAtRef.current, Date.now());
      setActiveCameraStream(newStream);
      setCameraStream(newStream);
      setStreamToken(started.stream_token);
      setPaused(false);
      setLatestMeasurement(null);
      setQualityMessage('Resuming camera stream…');
      newStream = null;
    } catch (cause) {
      newStream?.getTracks().forEach((track) => track.stop());
      setError(cause instanceof Error ? cause.message : 'Could not resume the session.');
    } finally {
      setBusy(false);
    }
  }

  function pauseSession() {
    manualCloseRef.current = true;
    setPaused(true);
    setConnected(false);
    setQualityMessage('Session paused. Camera stopped; resume when ready.');
    stopActiveCameraStream();
    setCameraStream(null);
    const socket = socketRef.current;
    if (socket && socket.readyState < WebSocket.CLOSING)
      socket.close(1000, 'patient paused session');
  }

  async function endSession() {
    if (!sessionId) return;
    setBusy(true);
    setError('');
    try {
      await api.completeSession(sessionId);
      manualCloseRef.current = true;
      socketRef.current?.close(1000, 'session completed');
      stopActiveCameraStream();
      setCameraStream(null);
      navigate(`/sessions/${sessionId}/result`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not end the session.');
    } finally {
      setBusy(false);
    }
  }

  if (!sessionId || !routeState.streamToken) {
    return (
      <section className="card" aria-labelledby="live-session-heading">
        <h1 id="live-session-heading">Live session</h1>
        <p className="notice">Start a session from Camera Setup to open a protected live stream.</p>
        <Link className="button-link" to="/setup">
          Go to Camera Setup
        </Link>
      </section>
    );
  }

  return (
    <section className="card" aria-labelledby="live-session-heading">
      <div className="section-heading-row">
        <div>
          <h1 id="live-session-heading">Live session</h1>
          <p className="meta">{protocolName}</p>
        </div>
        <span className={`status-pill ${connected ? 'status-good' : 'status-waiting'}`}>
          {connected ? 'Streaming' : paused ? 'Paused' : 'Connecting'}
        </span>
      </div>
      <SafetyBanner />

      <div className="live-layout">
        <div className="camera-preview live-preview">
          {cameraStream ? (
            <video ref={videoRef} autoPlay muted playsInline aria-label="Live camera preview" />
          ) : (
            <div className="camera-off" role="status">
              Camera is off while this session is paused.
            </div>
          )}
          <p className="meta">
            Live preview only. The current API does not return pose landmarks for a skeleton
            overlay.
          </p>
        </div>

        <div className="metric-panel">
          <div className="metric-card">
            <span>Repetitions</span>
            <strong aria-live="polite">{repetitionCount}</strong>
          </div>
          <div className="metric-card">
            <span>Movement state</span>
            <strong className="movement-state" aria-live="polite">
              {latestMeasurement?.quality.usable ? latestMeasurement.state.replace(/_/g, ' ') : '—'}
            </strong>
          </div>
          <div className="metric-card">
            <span>Projected 2D knee angle estimate</span>
            <strong aria-live="polite">
              {latestMeasurement?.quality.usable
                ? `${Math.round(latestMeasurement.projected_knee_angle_deg)}°`
                : '—'}
            </strong>
          </div>
          <div className="notice quality-status" role="status">
            <strong>Movement quality</strong>
            <span>{qualityMessage}</span>
            {latestMeasurement?.quality.usable && latestMeasurement.quality.confidence !== null && (
              <span className="meta">
                Landmark confidence: {Math.round(latestMeasurement.quality.confidence * 100)}%
              </span>
            )}
          </div>
          {simulated && <p className="simulated-label">SIMULATED fixture inference</p>}
        </div>
      </div>

      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      <div className="button-row session-controls">
        {paused ? (
          <button className="primary" disabled={busy} onClick={resumeSession} type="button">
            {busy ? 'Reconnecting…' : 'Resume session'}
          </button>
        ) : (
          <button disabled={busy} onClick={pauseSession} type="button">
            Pause session
          </button>
        )}
        <button disabled={busy} onClick={endSession} type="button">
          {busy ? 'Saving…' : 'End session'}
        </button>
      </div>
      <p className="meta">
        Frames are sampled at up to {FRAME_RATE} per second and sent for live processing. Raw video
        is not stored.
      </p>
    </section>
  );
}
