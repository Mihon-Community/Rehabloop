import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Camera, LockKeyhole } from 'lucide-react';
import { useDemo } from '../../app/demoStore';
import { SimulatedBadge } from '../../components/SimulatedBadge';
import { StateMessage } from '../../components/StateMessage';
import { StatusPill } from '../../components/StatusPill';
import { Alert, AlertDescription, AlertTitle, Button } from '../../components/base';
import { ApiError, api } from '../../lib/api';
import {
  createCameraConsent,
  setActiveCameraStream,
  stopActiveCameraStream,
} from '../../lib/camera';
import type { Profile, Protocol } from '../../types';

type CameraStatus = 'idle' | 'requesting' | 'ready' | 'denied' | 'unsupported';
type ChecklistKey = 'side' | 'legVisible' | 'stable' | 'light' | 'onePerson';

const checklist: { key: ChecklistKey; label: string }[] = [
  { key: 'side', label: 'Camera is approximately side-on' },
  { key: 'legVisible', label: 'Hip, knee and ankle of the selected leg are in frame' },
  { key: 'stable', label: 'Camera is stable (not handheld)' },
  { key: 'light', label: 'Lighting is even and the leg is not backlit' },
  { key: 'onePerson', label: 'Only one person is in frame' },
];

const emptyChecks: Record<ChecklistKey, boolean> = {
  side: false,
  legVisible: false,
  stable: false,
  light: false,
  onePerson: false,
};

/** Screen 4 — consent, camera preview, framing checklist and non-camera path. */
export function CameraSetupScreen() {
  const navigate = useNavigate();
  const { setConsentGiven, setSessionId, setCameraMode } = useDemo();
  const videoRef = useRef<HTMLVideoElement>(null);
  const keepStreamOnUnmount = useRef(false);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [selectedProtocolId, setSelectedProtocolId] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('idle');
  const [cameraError, setCameraError] = useState('');
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [consent, setConsent] = useState(false);
  const [consentRecordId, setConsentRecordId] = useState('');
  const [checks, setChecks] = useState<Record<ChecklistKey, boolean>>(emptyChecks);
  const [service, setService] = useState<'unknown' | 'checking' | 'available' | 'unavailable'>(
    'unknown',
  );
  const [busy, setBusy] = useState(false);
  const [draftSessionId, setDraftSessionId] = useState('');

  const selectedProtocol = useMemo(
    () => protocols.find((protocol) => protocol.id === selectedProtocolId) ?? null,
    [protocols, selectedProtocolId],
  );
  const protocolSide = selectedProtocol?.parameters.side;
  const checksPassed = Object.values(checks).every(Boolean);
  const canStart =
    consent &&
    checksPassed &&
    cameraStatus === 'ready' &&
    service !== 'unavailable' &&
    Boolean(selectedProtocol) &&
    Boolean(consentRecordId);

  useEffect(() => {
    let mounted = true;
    Promise.all([api.me(), api.myProtocols()])
      .then(([currentProfile, assignedProtocols]) => {
        if (!mounted) return;
        setProfile(currentProfile);
        setProtocols(assignedProtocols);
        setSelectedProtocolId(assignedProtocols[0]?.id ?? '');
        if (currentProfile.role !== 'patient') {
          setLoadError('Camera sessions can only be started from a patient account.');
        } else if (assignedProtocols.length === 0) {
          setLoadError(
            'There is no active clinician-approved protocol assigned to this account yet.',
          );
        }
      })
      .catch((cause: unknown) => {
        if (!mounted) return;
        setLoadError(
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

  async function requestCamera() {
    setCameraError('');
    const secureContext =
      window.isSecureContext || ['localhost', '127.0.0.1'].includes(window.location.hostname);
    if (!secureContext) {
      setCameraStatus('unsupported');
      setCameraError('Camera access needs HTTPS or a local address such as http://localhost.');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus('unsupported');
      setCameraError(
        'This browser does not provide camera access. Try a current browser on HTTPS or localhost.',
      );
      return;
    }
    if (!profile || profile.role !== 'patient' || !selectedProtocol) {
      setCameraError('A patient account with an assigned active protocol is required.');
      return;
    }
    if (!consent) {
      setCameraError('Read and accept the camera-processing notice first.');
      return;
    }

    setCameraStatus('requesting');
    try {
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
      setCameraStatus('ready');
    } catch (cause) {
      setCameraStatus('denied');
      setCameraError(cause instanceof Error ? cause.message : 'Camera permission was not granted.');
    }
  }

  async function checkService() {
    setService('checking');
    try {
      await api.health();
      setService('available');
    } catch {
      setService('unavailable');
    }
  }

  function declineCamera() {
    keepStreamOnUnmount.current = false;
    stopActiveCameraStream();
    setCameraStream(null);
    setCameraStatus('idle');
    setConsent(false);
    setConsentGiven(false);
    setChecks(emptyChecks);
    setCameraMode('review');
    navigate('/home');
  }

  async function startSession() {
    if (!selectedProtocol || !consentRecordId || !checksPassed) return;
    setBusy(true);
    setCameraError('');
    try {
      const draft = draftSessionId
        ? { session_id: draftSessionId }
        : await api.createSession(selectedProtocol.id);
      setDraftSessionId(draft.session_id);
      const started = await api.startSession(draft.session_id, consentRecordId);
      if (!started.stream_token)
        throw new Error('The server did not return a session stream token.');

      keepStreamOnUnmount.current = true;
      setSessionId(started.session_id);
      navigate(`/sessions/${started.session_id}/live`, {
        state: {
          streamToken: started.stream_token,
          consentRecordId,
          protocolName: selectedProtocol.protocol_name,
        },
      });
    } catch (cause) {
      setCameraError(cause instanceof Error ? cause.message : 'Could not start the session.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card" aria-labelledby="setup-heading">
      <div className="screen-title-row">
        <h1 id="setup-heading">4. Camera setup</h1>
        <SimulatedBadge source="simulated" />
      </div>
      <p className="screen-intro">
        A few quick checks help the camera see your full leg. You are in control throughout, and you
        can review saved information without using a camera.
      </p>

      {loading ? (
        <StateMessage kind="loading" title="Loading your assigned protocol…" />
      ) : loadError && !profile ? (
        <StateMessage kind="error" title="Could not load your profile">
          {loadError}
          <div className="meta">
            <Link to="/sign-in">Go to sign in</Link>
          </div>
        </StateMessage>
      ) : profile?.role !== 'patient' ? (
        <StateMessage kind="error" title="Patient account required">
          {loadError || 'Camera sessions are for patient accounts.'}
          <div className="meta">
            <Link to="/home">Return to patient home</Link>
          </div>
        </StateMessage>
      ) : protocols.length === 0 ? (
        <StateMessage kind="empty" title="No active protocol assigned">
          {loadError || 'No active protocol is assigned yet.'}
          <div className="meta">
            <Link to="/home">Return to patient home</Link>
          </div>
        </StateMessage>
      ) : (
        <>
          <div className="form-stack">
            <label htmlFor="assigned-protocol">Assigned protocol</label>
            <select
              id="assigned-protocol"
              value={selectedProtocolId}
              onChange={(event) => setSelectedProtocolId(event.target.value)}
              disabled={cameraStatus === 'ready'}
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

          <h2 className="flex items-center gap-2">
            <Camera className="size-5 text-primary" aria-hidden="true" /> Privacy first
          </h2>
          <Alert variant="info" icon={<LockKeyhole className="size-5" />}>
            <AlertTitle>Your frames stay with this session</AlertTitle>
            <AlertDescription>
              Frames are sampled only while measurement runs. Raw video is not stored by default,
              and no value is shown unless it passes the quality checks.
            </AlertDescription>
          </Alert>

          <h2>Consent before camera access</h2>
          <p>
            If you continue, your camera frames will be sent live to RehabLoop's private vision
            service to estimate movement for this session. Frames are processed transiently and are
            not stored as video. Camera access is optional.
          </p>
          <label className="confirm-check">
            <input
              type="checkbox"
              checked={consent}
              disabled={cameraStatus === 'ready'}
              onChange={(event) => {
                setConsent(event.target.checked);
                setConsentGiven(event.target.checked);
              }}
            />
            I consent to camera frames being processed for this measurement session.
          </label>

          <h2>Live preview</h2>
          <div className="camera-preview">
            <video ref={videoRef} autoPlay playsInline muted aria-label="Camera preview" />
            {cameraStatus !== 'ready' ? (
              <div className="camera-placeholder">
                <span aria-hidden="true">▣</span>
                <p>No camera preview. Framing guide below.</p>
              </div>
            ) : null}
          </div>
          <div className="button-row">
            <button
              type="button"
              onClick={requestCamera}
              disabled={!consent || cameraStatus === 'requesting' || cameraStatus === 'ready'}
            >
              {cameraStatus === 'requesting' ? 'Requesting camera…' : 'Allow camera'}
            </button>
            <button type="button" onClick={checkService}>
              Check measurement service
            </button>
          </div>
          {cameraStatus === 'denied' || cameraStatus === 'unsupported' ? (
            <StateMessage kind="error" title="Camera unavailable — plain-language help">
              {cameraError}
            </StateMessage>
          ) : null}
          {cameraStatus === 'ready' ? (
            <StatusPill tone="good">Camera preview active</StatusPill>
          ) : null}
          {service === 'checking' ? (
            <StateMessage kind="loading" title="Checking measurement service…" />
          ) : null}
          {service === 'available' ? (
            <StatusPill tone="good">Measurement service available</StatusPill>
          ) : null}
          {service === 'unavailable' ? (
            <StateMessage kind="error" title="Measurement service unavailable">
              Live measurement cannot start. You can review saved reports without a camera, or retry
              after the service is restored. No value is invented.
            </StateMessage>
          ) : null}

          <h2>Framing checklist</h2>
          <p className="meta">
            Confirm each item before starting. Errors are shown as instructions, not codes.
          </p>
          <ul className="checklist motion-stagger">
            {checklist.map((item) => (
              <li key={item.key}>
                <label>
                  <input
                    type="checkbox"
                    checked={checks[item.key]}
                    onChange={(event) => setChecks({ ...checks, [item.key]: event.target.checked })}
                  />
                  {item.label}
                </label>
              </li>
            ))}
          </ul>
          {consent && !checksPassed ? (
            <p className="meta">
              Move back until your full leg is visible; then re-check the list.
            </p>
          ) : null}

          {cameraError && cameraStatus === 'ready' && (
            <p className="error-message" role="alert">
              {cameraError}
            </p>
          )}

          <div className="button-row">
            <Button type="button" disabled={!canStart || busy} onClick={startSession}>
              {busy ? 'Starting session…' : 'Start measurement session'}
            </Button>
            <button type="button" onClick={declineCamera}>
              Continue without camera — review saved report
            </button>
            <Link className="button-link" to="/home">
              Cancel
            </Link>
          </div>
          {!canStart && consent ? (
            <p className="meta">
              Start requires consent, an active camera preview, all framing checks and an available
              measurement service.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
