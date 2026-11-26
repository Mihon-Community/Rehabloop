import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Camera, LockKeyhole } from 'lucide-react';
import { useDemo } from '../../app/demoStore';
import { SimulatedBadge } from '../../components/SimulatedBadge';
import { StateMessage } from '../../components/StateMessage';
import { StatusPill } from '../../components/StatusPill';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { api } from '../../lib/api';

type CameraStatus = 'idle' | 'requesting' | 'ready' | 'denied' | 'unsupported';
type ChecklistKey = 'side' | 'legVisible' | 'stable' | 'light' | 'onePerson';

const checklist: { key: ChecklistKey; label: string }[] = [
  { key: 'side', label: 'Camera is approximately side-on' },
  { key: 'legVisible', label: 'Hip, knee and ankle of the selected leg are in frame' },
  { key: 'stable', label: 'Camera is stable (not handheld)' },
  { key: 'light', label: 'Lighting is even and the leg is not backlit' },
  { key: 'onePerson', label: 'Only one person is in frame' },
];

/** Screen 4 — consent, camera preview, framing checklist and non-camera path. */
export function CameraSetupScreen() {
  const navigate = useNavigate();
  const { setConsentGiven, setSessionId, setCameraMode } = useDemo();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('idle');
  const [cameraError, setCameraError] = useState('');
  const [consent, setConsent] = useState(false);
  const [checks, setChecks] = useState<Record<ChecklistKey, boolean>>({
    side: false,
    legVisible: false,
    stable: false,
    light: false,
    onePerson: false,
  });
  const [service, setService] = useState<'unknown' | 'checking' | 'available' | 'unavailable'>(
    'unknown',
  );

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  async function requestCamera() {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setCameraStatus('unsupported');
      setCameraError(
        'Camera access needs a secure context (HTTPS or localhost). You can still review instructions and saved reports without a camera.',
      );
      return;
    }
    setCameraStatus('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraStatus('ready');
      setCameraError('');
    } catch {
      setCameraStatus('denied');
      setCameraError(
        'Camera permission was not granted. Nothing was recorded. You can continue in non-camera review mode and read the protocol and saved reports.',
      );
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

  const checksPassed = Object.values(checks).every(Boolean);
  const canStart = consent && checksPassed && cameraStatus === 'ready' && service !== 'unavailable';

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

      <h2 className="flex items-center gap-2">
        <Camera className="size-5 text-primary" aria-hidden="true" /> Privacy first
      </h2>
      <Alert variant="info" icon={<LockKeyhole className="size-5" />}>
        <AlertTitle>Your frames stay with this session</AlertTitle>
        <AlertDescription>
          Frames are sampled only while measurement runs. Raw video is not stored by default, and no
          value is shown unless it passes the quality checks.
        </AlertDescription>
      </Alert>

      <h2>Consent before camera access</h2>
      <p>
        Frames are sampled only while a session runs and are used to estimate movement. Raw video is
        not stored in this prototype. Camera access is optional.
      </p>
      <label className="confirm-check">
        <input
          type="checkbox"
          checked={consent}
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
        <button type="button" onClick={requestCamera} disabled={cameraStatus === 'requesting'}>
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
      {cameraStatus === 'ready' ? <StatusPill tone="good">Camera preview active</StatusPill> : null}
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
        <p className="meta">Move back until your full leg is visible; then re-check the list.</p>
      ) : null}

      <div className="button-row">
        <Button
          type="button"
          disabled={!canStart}
          onClick={() => {
            setSessionId('session-demo-live');
            navigate('/sessions/session-demo-live/live');
          }}
        >
          Start measurement session
        </Button>
        <button
          type="button"
          onClick={() => {
            setCameraMode('review');
            navigate('/sessions/session-demo-1/result');
          }}
        >
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
    </section>
  );
}
