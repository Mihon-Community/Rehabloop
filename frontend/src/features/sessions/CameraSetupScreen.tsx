import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDemo } from '../../app/demoStore';
import { SimulatedBadge } from '../../components/SimulatedBadge';
import { StateMessage } from '../../components/StateMessage';
import { StatusPill } from '../../components/StatusPill';
import { api } from '../../lib/api';
import {
  Camera,
  CheckCircle2,
  ListChecks,
  LockKeyhole,
  ShieldAlert,
  ShieldCheck,
  Video,
} from '@/components/icon';
import { Alert, AlertDescription, AlertTitle, Button, Card } from '@/components/base';

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

  const passedCount = Object.values(checks).filter(Boolean).length;
  const checksPassed = passedCount === checklist.length;
  const cameraBlocked = cameraStatus === 'denied' || cameraStatus === 'unsupported';
  const canStart = consent && checksPassed && cameraStatus === 'ready' && service !== 'unavailable';

  return (
    <div className="screen-stack">
      <section className="card" aria-labelledby="setup-heading">
        <header className="mb-4 flex flex-wrap items-start gap-3">
          <span className="icon-chip icon-chip-lg mt-0.5" aria-hidden="true">
            <Camera className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="section-kicker">Capture pipeline · prepare</p>
            <div className="screen-title-row">
              <h1 id="setup-heading">4. Camera setup</h1>
              <SimulatedBadge source="simulated" />
            </div>
            <p className="screen-intro mb-0">
              A few quick checks help the camera see your full leg. You are in control throughout,
              and you can review saved information without using a camera.
            </p>
          </div>
        </header>

        <h2>Privacy first</h2>
        <Alert variant="info" icon={<LockKeyhole className="size-5" />}>
          <AlertTitle>Your frames stay with this session</AlertTitle>
          <AlertDescription>
            Frames are sampled only while measurement runs. Raw video is not stored by default, and
            no value is shown unless it passes the quality checks.
          </AlertDescription>
        </Alert>
      </section>

      {/* Consent gates everything below it, so it gets its own panel with the
          triage spine, a shield that changes shape once it is given, and a
          spelled-out status — the colour is never the only signal. */}
      <Card triage={consent ? 'stable' : 'caution'}>
        <div className="card-chart-head">
          <span className="icon-chip" aria-hidden="true">
            {consent ? <ShieldCheck className="size-4" /> : <ShieldAlert className="size-4" />}
          </span>
          <div className="min-w-0">
            <p className="section-kicker mb-0">Required first</p>
            <h2 className="card-chart-title">Consent before camera access</h2>
          </div>
          {consent ? (
            <StatusPill tone="good">Consent given</StatusPill>
          ) : (
            <StatusPill tone="warn">Consent required</StatusPill>
          )}
        </div>
        <p>
          Frames are sampled only while a session runs and are used to estimate movement. Raw video
          is not stored in this prototype. Camera access is optional.
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
      </Card>

      <section className="card">
        <div className="card-chart-head">
          <span className="icon-chip" aria-hidden="true">
            <Video className="size-4" />
          </span>
          <div className="min-w-0">
            <h2 className="card-chart-title">Live preview</h2>
            <p className="card-chart-meta">
              The preview is only there so you can check framing. Nothing is recorded on this
              screen.
            </p>
          </div>
        </div>
        {/* Preview beside its controls: the permission prompt, the service check
            and any plain-language help all sit next to the thing they describe. */}
        <div className="live-grid">
          <div>
            <div className="camera-preview">
              <video ref={videoRef} autoPlay playsInline muted aria-label="Camera preview" />
              {cameraStatus !== 'ready' ? (
                <div className="camera-placeholder">
                  <span className="justify-self-center">
                    <Camera className="size-8" aria-hidden="true" />
                  </span>
                  <p>No camera preview. Framing guide below.</p>
                </div>
              ) : null}
            </div>
          </div>
          <div>
            <div className="button-row">
              <Button
                type="button"
                size="lg"
                onClick={requestCamera}
                disabled={cameraStatus === 'requesting'}
              >
                {cameraStatus === 'requesting' ? 'Requesting camera…' : 'Allow camera'}
              </Button>
              <Button type="button" variant="outline" size="lg" onClick={checkService}>
                Check measurement service
              </Button>
            </div>
            {/* A refused or unavailable camera is not a failure of the app: it is
                the optional path, so it is flagged as a warning with the help
                text rather than as an error. */}
            {cameraBlocked ? (
              <Alert variant="warning" icon={<ShieldAlert className="size-5" />}>
                <AlertTitle>Camera unavailable — plain-language help</AlertTitle>
                <AlertDescription>{cameraError}</AlertDescription>
              </Alert>
            ) : null}
            {service === 'checking' ? (
              <StateMessage kind="loading" title="Checking measurement service…" />
            ) : null}
            {service === 'unavailable' ? (
              <StateMessage kind="error" title="Measurement service unavailable">
                Live measurement cannot start. You can review saved reports without a camera, or
                retry after the service is restored. No value is invented.
              </StateMessage>
            ) : null}
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-chart-head">
          <span className="icon-chip" aria-hidden="true">
            <ListChecks className="size-4" />
          </span>
          <div className="min-w-0">
            <h2 className="card-chart-title">Framing checklist</h2>
            <p className="card-chart-meta">
              Confirm each item before starting. Errors are shown as instructions, not codes.
            </p>
          </div>
          <StatusPill tone={checksPassed ? 'good' : 'neutral'}>
            {passedCount} of {checklist.length} confirmed
          </StatusPill>
        </div>
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
      </section>

      <section className="card">
        <div className="card-chart-head">
          <span className="icon-chip" aria-hidden="true">
            <CheckCircle2 className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="section-kicker mb-0">Next</p>
            <h2 className="card-chart-title">Start, or continue without a camera</h2>
          </div>
        </div>
        {/* Pre-flight readout. Every gate on the start button is named here with
            its current state, so a disabled Start is never unexplained. */}
        <dl className="detail-list">
          <dt>Consent</dt>
          <dd>
            {consent ? (
              <StatusPill tone="good">Consent given</StatusPill>
            ) : (
              <StatusPill tone="warn">Consent required</StatusPill>
            )}
          </dd>
          <dt>Camera</dt>
          <dd>
            {cameraStatus === 'ready' ? (
              <StatusPill tone="good">Camera preview active</StatusPill>
            ) : cameraStatus === 'requesting' ? (
              <StatusPill tone="neutral">Requesting camera…</StatusPill>
            ) : cameraBlocked ? (
              <StatusPill tone="warn">Camera unavailable</StatusPill>
            ) : (
              <StatusPill tone="neutral">Camera not requested yet</StatusPill>
            )}
          </dd>
          <dt>Framing checks</dt>
          <dd>
            {checksPassed ? (
              <StatusPill tone="good">All {checklist.length} confirmed</StatusPill>
            ) : (
              <StatusPill tone="neutral">
                {passedCount} of {checklist.length} confirmed
              </StatusPill>
            )}
          </dd>
          <dt>Measurement service</dt>
          <dd>
            {service === 'available' ? (
              <StatusPill tone="good">Measurement service available</StatusPill>
            ) : service === 'checking' ? (
              <StatusPill tone="neutral">Checking measurement service…</StatusPill>
            ) : service === 'unavailable' ? (
              <StatusPill tone="bad">Measurement service unavailable</StatusPill>
            ) : (
              <StatusPill tone="neutral">Not checked yet</StatusPill>
            )}
          </dd>
        </dl>

        {/* Two peer paths, same size and weight: measuring is not the "real"
            choice and reviewing is not a consolation. */}
        <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
          <Card className="card-accent-left">
            <p className="section-kicker mb-0">Camera path</p>
            <h3 className="mt-1 text-base">Measure this session</h3>
            <p className="meta">
              Needs consent, an active camera preview and every framing check confirmed.
            </p>
            <Button
              type="button"
              size="lg"
              className="mt-2 w-full"
              disabled={!canStart}
              onClick={() => {
                setSessionId('session-demo-live');
                navigate('/sessions/session-demo-live/live');
              }}
            >
              Start measurement session
            </Button>
          </Card>
          <Card>
            <p className="section-kicker mb-0">No-camera path</p>
            <h3 className="mt-1 text-base">Read a saved report</h3>
            <p className="meta">
              Camera access is optional. Nothing is captured and nothing is measured on this path.
            </p>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="mt-2 w-full"
              onClick={() => {
                setCameraMode('review');
                navigate('/sessions/session-demo-1/result');
              }}
            >
              Continue without camera — review saved report
            </Button>
          </Card>
        </div>

        {!canStart && consent ? (
          <p className="meta">
            Start requires consent, an active camera preview, all framing checks and an available
            measurement service.
          </p>
        ) : null}
        <div className="button-row">
          <Button variant="ghost" size="lg" asChild>
            <Link to="/home">Cancel</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
