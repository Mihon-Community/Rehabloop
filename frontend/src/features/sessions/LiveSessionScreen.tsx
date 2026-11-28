import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MetricCard } from '../../components/MetricCard';
import { SimulatedBadge } from '../../components/SimulatedBadge';
import { StateMessage } from '../../components/StateMessage';
import { StatusPill } from '../../components/StatusPill';
import { demoMeasurements, demoWarnings, SIMULATED_LABEL } from '../../lib/mocks/fixtures';
import { initialStreamState, reduceStreamEvent, type StreamState } from '../../lib/stream';
import type { MeasurementEvent, QualityWarningEvent } from '../../types';
import { Gauge, Pause, Play, Radio, Repeat, Video } from '@/components/icon';
import { Button, Card } from '@/components/base';

type Phase = 'idle' | 'streaming' | 'paused' | 'ended';
const events: (MeasurementEvent | QualityWarningEvent)[] = [...demoMeasurements, ...demoWarnings];

/** Screen 5 — live metrics from labelled simulated events, with pause/end and quality states. */
export function LiveSessionScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('idle');
  const [stream, setStream] = useState<StreamState>(initialStreamState);
  const [showOverlay, setShowOverlay] = useState(true);
  const [serviceError, setServiceError] = useState(false);
  const [received, setReceived] = useState(0);
  const speed = Number(import.meta.env.VITE_FRAME_SAMPLE_RATE ?? 8);
  const intervalMs = Math.max(
    100,
    1000 / (Number.isFinite(speed) ? Math.min(Math.max(speed, 1), 10) : 8),
  );

  useEffect(() => {
    if (phase !== 'streaming' || serviceError) return;
    let cancelled = false;
    let index = 0;
    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      if (cancelled) return;
      const event = events[index % events.length];
      index += 1;
      setStream((current) => reduceStreamEvent(current, event));
      setReceived((count) => count + 1);
      timer = setTimeout(tick, intervalMs);
    };
    timer = setTimeout(tick, intervalMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [phase, serviceError, intervalMs]);

  const latest = stream.latest;
  const angle = latest ? Math.round(latest.projected_knee_angle_deg * 10) / 10 : null;
  /* Fixed to one decimal so the reading keeps the same width frame to frame:
     tabular-nums holds the digits in place, but a value flipping between "72"
     and "71.8" would still make the card twitch eight times a second. */
  const angleText = angle === null ? '—' : angle.toFixed(1);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  async function togglePreview() {
    if (preview) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      setPreview(false);
      return;
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = media;
      if (videoRef.current) videoRef.current.srcObject = media;
      setPreview(true);
    } catch {
      setServiceError(true);
    }
  }

  return (
    <div className="screen-stack">
      <section className="card" aria-labelledby="live-heading">
        <header className="mb-4 flex flex-wrap items-start gap-3">
          <span className="icon-chip icon-chip-lg mt-0.5" aria-hidden="true">
            <Radio className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="section-kicker">Capture pipeline · record</p>
            <div className="screen-title-row">
              <h1 id="live-heading">5. Live session</h1>
              <SimulatedBadge source="simulated" />
            </div>
            <p className="screen-intro mb-0">
              Watch the live measurement state, repetitions and data quality. Angles are projected
              2D estimates — never a clinical measurement.
            </p>
          </div>
        </header>

        {/* Session state as an obs strip: each reading gets its own labelled
            cell instead of a run of pills in a sentence. Only the session state
            is announced — the counters tick several times a second and would
            otherwise flood a screen reader. */}
        <dl className="vitals-strip">
          <div>
            <dt className="vitals-label">Session state</dt>
            <dd className="mt-1" aria-live="polite">
              <StatusPill
                tone={
                  phase === 'paused' || serviceError
                    ? 'warn'
                    : phase === 'streaming'
                      ? 'good'
                      : 'neutral'
                }
              >
                {serviceError ? 'measurement unavailable' : phase}
              </StatusPill>
            </dd>
          </div>
          <div>
            <dt className="vitals-label">Quality</dt>
            <dd className="mt-1">
              {latest?.quality.usable ? (
                <StatusPill tone="good">usable frame</StatusPill>
              ) : (
                <StatusPill tone="neutral">not measured yet</StatusPill>
              )}
            </dd>
          </div>
          <div>
            <dt className="vitals-label">Events received</dt>
            <dd className="vitals-value">{received}</dd>
          </div>
          <div>
            <dt className="vitals-label">Last accepted sequence</dt>
            <dd className="vitals-value">{stream.lastSequence}</dd>
          </div>
        </dl>
        <p className="meta">
          Session {id ?? 'demo'} · {SIMULATED_LABEL}. Events are synthetic and labelled; no real
          inference or patient data is shown.
        </p>

        {serviceError ? (
          <StateMessage kind="error" title="Measurement service unavailable">
            Measurement is paused. No angle or repetition value is invented. You may retry the
            stream or end the session and review saved results (which are also simulated in this
            demo).
          </StateMessage>
        ) : null}
      </section>

      <div className="live-grid motion-stagger">
        <Card>
          <div className="card-chart-head">
            <span className="icon-chip" aria-hidden="true">
              <Video className="size-4" />
            </span>
            <div className="min-w-0">
              <h2 className="card-chart-title">Camera view</h2>
              <p className="card-chart-meta">
                The overlay is a schematic drawn from the latest estimate, not a tracked skeleton.
              </p>
            </div>
          </div>
          <div className="camera-preview">
            <video ref={videoRef} autoPlay playsInline muted aria-label="Session camera preview" />
            {!preview ? <div className="camera-placeholder">Camera preview is off.</div> : null}
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
          <div className="button-row">
            <Button type="button" variant="outline" onClick={togglePreview}>
              {preview ? 'Stop camera preview' : 'Show camera preview'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowOverlay((value) => !value)}
              aria-pressed={!showOverlay}
            >
              {showOverlay ? 'Hide pose overlay' : 'Show pose overlay'}
            </Button>
          </div>
        </Card>

        {/* Paper surface: this panel's whole subject is a reading. */}
        <Card surface="paper">
          <div className="card-chart-head">
            <span className="icon-chip" aria-hidden="true">
              <Gauge className="size-4" />
            </span>
            <div className="min-w-0">
              <h2 className="card-chart-title">Live readings</h2>
              <p className="card-chart-meta">Projected 2D estimates, updated as frames arrive.</p>
            </div>
          </div>
          <div className="live-metrics">
            {phase === 'idle' ? (
              <StateMessage kind="empty" title="Session not started">
                Start the simulated event stream to see how live measurements will appear.
              </StateMessage>
            ) : null}
            {latest ? (
              <>
                <div className="metric-grid">
                  <MetricCard
                    label="Repetitions counted"
                    value={latest.rep_count}
                    icon={<Repeat className="size-4" aria-hidden="true" />}
                  />
                  <MetricCard
                    label="Projected knee angle estimate"
                    value={angleText}
                    unit="°"
                    hint="2D estimate from one camera view — not a clinical angle"
                    icon={<Gauge className="size-4" aria-hidden="true" />}
                  />
                </div>
                <dl className="detail-list">
                  <dt>Movement state</dt>
                  <dd>
                    <StatusPill tone="neutral">{latest.state}</StatusPill>
                  </dd>
                  <dt>Frame quality</dt>
                  <dd>
                    {latest.quality.usable ? (
                      <StatusPill tone="good">
                        Usable · confidence {latest.quality.confidence.toFixed(2)}
                      </StatusPill>
                    ) : (
                      <StatusPill tone="bad">Not usable — measurement unavailable</StatusPill>
                    )}
                  </dd>
                </dl>
              </>
            ) : null}
            {stream.warnings.length ? (
              <div className="warning-list" role="status">
                <p className="vitals-label">Quality warnings</p>
                {stream.warnings.map((warning) => (
                  <p key={warning.sequence}>
                    <StatusPill tone="warn">Quality warning</StatusPill> {warning.message} (seq{' '}
                    {warning.sequence})
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        </Card>
      </div>

      <section className="card">
        <div className="card-chart-head">
          <span className="icon-chip" aria-hidden="true">
            <Radio className="size-4" />
          </span>
          <div className="min-w-0">
            <h2 className="card-chart-title">Session controls</h2>
            <p className="card-chart-meta">
              Starting, pausing and resuming are reversible. Ending the session is not: it stops
              capture and opens the recorded result.
            </p>
          </div>
        </div>
        {/* One `critical` button on the screen, and it is the irreversible one.
            Start, resume and pause are tinted peers beside it. */}
        <div className="button-row">
          {phase === 'idle' ? (
            <Button type="button" variant="confirm" size="lg" onClick={() => setPhase('streaming')}>
              <Play aria-hidden="true" />
              Start simulated stream
            </Button>
          ) : null}
          {phase === 'paused' ? (
            <Button type="button" variant="confirm" size="lg" onClick={() => setPhase('streaming')}>
              <Play aria-hidden="true" />
              Resume
            </Button>
          ) : null}
          {phase === 'streaming' ? (
            <Button type="button" variant="caution" size="lg" onClick={() => setPhase('paused')}>
              <Pause aria-hidden="true" />
              Pause
            </Button>
          ) : null}
          <Button type="button" variant="ghost" size="sm" onClick={() => setServiceError(true)}>
            Simulate vision unavailable
          </Button>
          <Button
            type="button"
            variant="critical"
            size="lg"
            className="sm:ml-auto"
            onClick={() => navigate(`/sessions/${id ?? 'session-demo-1'}/result`)}
          >
            End session
          </Button>
        </div>
        {phase === 'paused' ? (
          <p className="meta">
            <StatusPill tone="warn">Paused</StatusPill> Resume is a deliberate user action; no
            frames are processed while paused.
          </p>
        ) : null}
      </section>
    </div>
  );
}
