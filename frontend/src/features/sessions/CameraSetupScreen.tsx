import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SafetyBanner } from '../../components/SafetyBanner';
import { ApiError, api } from '../../lib/api';
import {
  createCameraConsent,
  setActiveCameraStream,
  stopActiveCameraStream,
} from '../../lib/camera';
import type { Profile, Protocol } from '../../types';

export function CameraSetupScreen() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const keepStreamOnUnmount = useRef(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [selectedProtocolId, setSelectedProtocolId] = useState('');
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [consentRecordId, setConsentRecordId] = useState('');
  const [legVisible, setLegVisible] = useState(false);
  const [cameraPositioned, setCameraPositioned] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draftSessionId, setDraftSessionId] = useState('');

  const selectedProtocol = useMemo(
    () => protocols.find((protocol) => protocol.id === selectedProtocolId) ?? null,
    [protocols, selectedProtocolId],
  );
  const protocolSide = selectedProtocol?.parameters.side;
  const checksPassed = Boolean(cameraStream && legVisible && cameraPositioned);

  useEffect(() => {
    let mounted = true;
    Promise.all([api.me(), api.myProtocols()])
      .then(([currentProfile, assignedProtocols]) => {
        if (!mounted) return;
        setProfile(currentProfile);
        setProtocols(assignedProtocols);
        setSelectedProtocolId(assignedProtocols[0]?.id ?? '');
        if (currentProfile.role !== 'patient') {
          setError('Camera sessions can only be started from a patient account.');
        } else if (assignedProtocols.length === 0) {
          setError('There is no active clinician-approved protocol assigned to this account yet.');
        }
      })
      .catch((cause: unknown) => {
        if (!mounted) return;
        setError(
          cause instanceof ApiError && cause.status === 401
            ? 'Sign in before setting up a camera session.'
            : cause instanceof Error
              ? cause.message
              : 'Could not load the assigned protocol.',
        );
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
      if (!keepStreamOnUnmount.current) stopActiveCameraStream();
    };
  }, []);

  useEffect(() => {
    if (videoRef.current && cameraStream) videoRef.current.srcObject = cameraStream;
  }, [cameraStream]);

  useEffect(() => {
    setDraftSessionId('');
  }, [selectedProtocolId]);

  async function enableCamera() {
    setBusy(true);
    setError('');
    try {
      const secureContext =
        window.isSecureContext || ['localhost', '127.0.0.1'].includes(window.location.hostname);
      if (!secureContext) {
        throw new Error('Camera access needs HTTPS or a local address such as http://localhost.');
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          'This browser does not provide camera access. Try a current browser on HTTPS or localhost.',
        );
      }
      if (!profile || profile.role !== 'patient' || !selectedProtocol) {
        throw new Error('A patient account with an assigned active protocol is required.');
      }
      if (!consentAccepted) throw new Error('Read and accept the camera-processing notice first.');

      const savedConsentId = consentRecordId || (await createCameraConsent(profile.id));
      setConsentRecordId(savedConsentId);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'user' },
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });
      setActiveCameraStream(stream);
      setCameraStream(stream);
      setLegVisible(false);
      setCameraPositioned(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Camera permission was not granted.');
    } finally {
      setBusy(false);
    }
  }

  function declineCamera() {
    keepStreamOnUnmount.current = false;
    stopActiveCameraStream();
    setCameraStream(null);
    setConsentAccepted(false);
    setLegVisible(false);
    setCameraPositioned(false);
    navigate('/home');
  }

  async function startSession() {
    if (!selectedProtocol || !consentRecordId || !checksPassed) return;
    setBusy(true);
    setError('');
    try {
      const draft = draftSessionId
        ? { session_id: draftSessionId }
        : await api.createSession(selectedProtocol.id);
      setDraftSessionId(draft.session_id);
      const started = await api.startSession(draft.session_id, consentRecordId);
      if (!started.stream_token)
        throw new Error('The server did not return a session stream token.');

      keepStreamOnUnmount.current = true;
      navigate(`/sessions/${started.session_id}/live`, {
        state: {
          streamToken: started.stream_token,
          consentRecordId,
          protocolName: selectedProtocol.protocol_name,
        },
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not start the session.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card" aria-labelledby="camera-setup-heading">
      <h1 id="camera-setup-heading">Camera setup</h1>
      <SafetyBanner />
      <p>
        Review the assigned protocol and camera notice. The browser will not request camera access
        until you accept the notice and choose to enable the preview.
      </p>

      {loading ? (
        <p role="status">Loading your assigned protocol…</p>
      ) : error && !profile ? (
        <div className="notice" role="alert">
          <p>{error}</p>
          <Link to="/">Go to sign in</Link>
        </div>
      ) : profile?.role !== 'patient' ? (
        <div className="notice" role="alert">
          <p>{error || 'Camera sessions are for patient accounts.'}</p>
          <Link to="/home">Return to patient home</Link>
        </div>
      ) : protocols.length === 0 ? (
        <div className="notice" role="status">
          <p>{error || 'No active protocol is assigned yet.'}</p>
          <Link to="/home">Return to patient home</Link>
        </div>
      ) : (
        <>
          <div className="form-stack">
            <label htmlFor="assigned-protocol">Assigned protocol</label>
            <select
              id="assigned-protocol"
              value={selectedProtocolId}
              onChange={(event) => setSelectedProtocolId(event.target.value)}
              disabled={Boolean(cameraStream)}
            >
              {protocols.map((protocol) => (
                <option key={protocol.id} value={protocol.id}>
                  {protocol.protocol_name} (version {protocol.version})
                </option>
              ))}
            </select>
          </div>

          {selectedProtocol && (
            <div className="notice protocol-summary">
              <strong>{selectedProtocol.protocol_name}</strong>
              <span>Protocol version {selectedProtocol.version}</span>
              <span>
                Selected side: {typeof protocolSide === 'string' ? protocolSide : 'as assigned'}
              </span>
              <span>
                Target repetitions:{' '}
                {String(selectedProtocol.parameters.target_reps ?? 'as assigned')}
              </span>
            </div>
          )}

          <section className="consent-panel" aria-labelledby="camera-consent-heading">
            <h2 id="camera-consent-heading">Camera-processing consent</h2>
            <p className="meta">
              Prototype notice for testing; production terms and consent wording need review before
              rollout.
            </p>
            <p>
              If you continue, your camera frames will be sent live to RehabLoop’s private vision
              service to estimate movement for this session. Frames are processed transiently and
              are not stored as video. Numeric session results may be saved according to the
              configured service. This prototype does not diagnose, treat, or provide medical
              advice. Camera use is optional, and you can stop the session at any time.
            </p>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={consentAccepted}
                onChange={(event) => setConsentAccepted(event.target.checked)}
                disabled={Boolean(cameraStream)}
              />
              <span>I have read this notice and agree to camera processing for this session.</span>
            </label>
            <div className="button-row">
              <button
                className="primary"
                disabled={!consentAccepted || busy || Boolean(cameraStream)}
                onClick={enableCamera}
                type="button"
              >
                {busy && !cameraStream ? 'Preparing camera…' : 'Accept and enable camera'}
              </button>
              <button onClick={declineCamera} type="button">
                Decline and return
              </button>
            </div>
          </section>

          {cameraStream && (
            <section className="camera-preview" aria-labelledby="preview-heading">
              <div className="section-heading-row">
                <h2 id="preview-heading">Camera preview</h2>
                <span className="status-pill status-good">Camera on</span>
              </div>
              <video ref={videoRef} autoPlay muted playsInline aria-label="Live camera preview" />
              <p className="meta">
                Use a stable side view with one person in frame and the full selected leg visible.
                This app cannot verify framing automatically.
              </p>
              <div className="checklist">
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={legVisible}
                    onChange={(event) => setLegVisible(event.target.checked)}
                  />
                  <span>The hip, knee, and ankle on the selected side are visible.</span>
                </label>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={cameraPositioned}
                    onChange={(event) => setCameraPositioned(event.target.checked)}
                  />
                  <span>
                    The camera is steady, approximately side-on, and only one person is in view.
                  </span>
                </label>
              </div>
              <div className="button-row">
                <button
                  className="primary"
                  disabled={!checksPassed || busy}
                  onClick={startSession}
                  type="button"
                >
                  {busy ? 'Starting session…' : 'Start live session'}
                </button>
                <button onClick={declineCamera} type="button">
                  Turn off camera
                </button>
              </div>
            </section>
          )}
        </>
      )}

      {error && profile && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
