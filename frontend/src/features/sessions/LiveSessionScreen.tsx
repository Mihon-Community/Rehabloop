import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Radio } from 'lucide-react';
import { SimulatedBadge } from '../../components/SimulatedBadge';
import { StateMessage } from '../../components/StateMessage';
import { StatusPill } from '../../components/StatusPill';
import { api, sessionStreamUrl } from '../../lib/api';
import {
  getActiveCameraStream,
  setActiveCameraStream,
  stopActiveCameraStream,
} from '../../lib/camera';
import { initialStreamState, reduceStreamEvent, type StreamState } from '../../lib/stream';
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

/** Screen 5 — live metrics from the session WebSocket, with pause/end and quality states. */
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
  const [stream, setStream] = useState<StreamState>(initialStreamState);
  const [simulated, setSimulated] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);
  const [received, setReceived] = useState(0);

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
          setReceived((count) => count + 1);
          if (event.type === 'measurement') {
            setStream((current) => reduceStreamEvent(current, event));
            setSimulated(Boolean(event.simulated));
            setQualityMessage(
              event.quality.usable
                ? 'Frame passed the movement quality checks.'
                : event.quality.reason || 'Measurement unavailable for this frame.',
            );
          } else if (event.type === 'quality_warning') {
            setStream((current) => reduceStreamEvent(current, event));
            setSimulated(Boolean(event.simulated));
            setQualityMessage(event.message);
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
      <section className="card" aria-labelledby="live-heading">
        <h1 id="live-heading">Live session</h1>
        <StateMessage kind="empty" title="No active session">
          Start a session from Camera Setup to open a protected live stream.
        </StateMessage>
        <Link className="button-link" to="/setup">
          Go to Camera Setup
        </Link>
      </section>
    );
  }

  const latest = stream.latest;
  // Live display rounds to whole degrees; the stored session result keeps one decimal place.
  const angle = latest ? Math.round(latest.projected_knee_angle_deg) : null;
  const sessionPhase = paused ? 'paused' : connected ? 'streaming' : 'connecting';

  return (
    <section className="card" aria-labelledby="live-heading">
      <div className="screen-title-row">
        <h1 id="live-heading">5. Live session</h1>
        <SimulatedBadge source={simulated ? 'simulated' : 'live'} />
      </div>
      <p className="screen-intro">
        Watch the live measurement state, repetitions and data quality. Angles are projected 2D
        estimates — never a clinical measurement.
      </p>
      <div className="mb-2 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
        <Radio className="size-5 text-primary" aria-hidden="true" />
        <span className="text-sm font-semibold">Session state:</span>
        <StatusPill
          tone={
            sessionPhase === 'paused' ? 'warn' : sessionPhase === 'streaming' ? 'good' : 'neutral'
          }
        >
          {sessionPhase === 'streaming'
            ? 'Streaming'
            : sessionPhase === 'paused'
              ? 'Paused'
              : 'Connecting'}
        </StatusPill>
        <span className="text-sm font-semibold">Quality:</span>
        {latest?.quality.usable ? (
          <StatusPill tone="good">usable frame</StatusPill>
        ) : (
          <StatusPill tone="neutral">not measured yet</StatusPill>
        )}
      </div>
      <p className="meta">
        Session {sessionId} · {protocolName}
      </p>

      {error ? (
        <StateMessage kind="error" title="Vision service issue">
          {error}
        </StateMessage>
      ) : null}

      <div className="live-grid motion-stagger">
        <div>
          <div className="camera-preview">
            {cameraStream ? (
              <video ref={videoRef} autoPlay muted playsInline aria-label="Live camera preview" />
            ) : (
              <div className="camera-placeholder">Camera is off while this session is paused.</div>
            )}
            {showOverlay && latest ? (
              <svg className="pose-overlay" viewBox="0 0 200 200" aria-hidden="true">
                <circle cx="60" cy="45" r="9" />
                <line x1="60" y1="54" x2="65" y2="110" />
                <circle cx="65" cy="110" r="8" />
                <line x1="65" y1="110" x2={70 + (angle ?? 72) / 3} y2={165 - (angle ?? 72) / 8} />
                <circle cx={70 + (angle ?? 72) / 3} cy={165 - (angle ?? 72) / 8} r="7" />
                <text x="6" y="194">
                  schematic overlay
                </text>
              </svg>
            ) : null}
          </div>
          <p className="meta">
            Live preview only. The current API does not return pose landmarks, so this overlay is a
            schematic approximation driven by the projected angle, not a real skeleton trace.
          </p>
          <div className="button-row">
            <button
              type="button"
              onClick={() => setShowOverlay((value) => !value)}
              aria-pressed={!showOverlay}
            >
              {showOverlay ? 'Hide pose overlay' : 'Show pose overlay'}
            </button>
          </div>
        </div>

        <div className="live-metrics" aria-live="polite">
          <div className="metric-card">
            <span className="metric-label">Repetitions counted</span>
            <span className="metric-value">{latest?.rep_count ?? 0}</span>
          </div>
          <div className="metric-card">
            <span className="metric-label">Movement state</span>
            <span className="metric-value">
              {latest?.quality.usable ? latest.state.replace(/_/g, ' ') : '—'}
            </span>
          </div>
          <div className="metric-card">
            <span className="metric-label">Projected knee angle estimate</span>
            <span className="metric-value">
              {latest?.quality.usable && angle !== null ? angle : '—'}
              <small>°</small>
            </span>
            <span className="meta">2D estimate from one camera view — not a clinical angle</span>
          </div>
          <div className="notice quality-status" role="status">
            <strong>Movement quality</strong>
            <span>{qualityMessage}</span>
            {latest?.quality.usable && latest.quality.confidence !== null && (
              <span className="meta">
                Landmark confidence: {Math.round(latest.quality.confidence * 100)}%
              </span>
            )}
          </div>
          {simulated && <p className="simulated-label">SIMULATED fixture inference</p>}
          {stream.warnings.length ? (
            <div className="warning-list" role="status">
              {stream.warnings.slice(-3).map((warning) => (
                <p key={warning.sequence}>
                  <StatusPill tone="warn">Quality warning</StatusPill> {warning.message} (seq{' '}
                  {warning.sequence})
                </p>
              ))}
            </div>
          ) : null}
          <p className="meta">
            Frames are sampled at up to {FRAME_RATE} per second and sent for live processing. Raw
            video is not stored. Events received: {received} · last accepted sequence:{' '}
            {stream.lastSequence}
          </p>

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
          {paused ? (
            <p className="meta">
              <StatusPill tone="warn">Paused</StatusPill> Resume is a deliberate user action; no
              frames are processed while paused.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
