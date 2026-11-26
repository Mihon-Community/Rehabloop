import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Radio } from 'lucide-react';
import { SimulatedBadge } from '../../components/SimulatedBadge';
import { StateMessage } from '../../components/StateMessage';
import { StatusPill } from '../../components/StatusPill';
import { SIMULATED_LABEL } from '../../lib/mocks/fixtures';
import { demoMeasurements, demoWarnings } from '../../lib/mocks/fixtures';
import { initialStreamState, reduceStreamEvent, type StreamState } from '../../lib/stream';
import type { MeasurementEvent, QualityWarningEvent } from '../../types';

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
    <section className="card" aria-labelledby="live-heading">
      <div className="screen-title-row">
        <h1 id="live-heading">5. Live session</h1>
        <SimulatedBadge source="simulated" />
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
            phase === 'paused' || serviceError ? 'warn' : phase === 'streaming' ? 'good' : 'neutral'
          }
        >
          {serviceError ? 'measurement unavailable' : phase}
        </StatusPill>
        <span className="text-sm font-semibold">Quality:</span>
        {latest?.quality.usable ? (
          <StatusPill tone="good">usable frame</StatusPill>
        ) : (
          <StatusPill tone="neutral">not measured yet</StatusPill>
        )}
      </div>
      <p className="meta">
        Session {id ?? 'demo'} · {SIMULATED_LABEL}. Events are synthetic and labelled; no real
        inference or patient data is shown.
      </p>

      {serviceError ? (
        <StateMessage kind="error" title="Measurement service unavailable">
          Measurement is paused. No angle or repetition value is invented. You may retry the stream
          or end the session and review saved results (which are also simulated in this demo).
        </StateMessage>
      ) : null}

      <div className="live-grid motion-stagger">
        <div>
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
            <button type="button" onClick={togglePreview}>
              {preview ? 'Stop camera preview' : 'Show camera preview'}
            </button>
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
          {phase === 'idle' ? (
            <StateMessage kind="empty" title="Session not started">
              Start the simulated event stream to see how live measurements will appear.
            </StateMessage>
          ) : null}
          {latest ? (
            <>
              <div className="metric-card">
                <span className="metric-label">Repetitions counted</span>
                <span className="metric-value">{latest.rep_count}</span>
              </div>
              <div className="metric-card">
                <span className="metric-label">Projected knee angle estimate</span>
                <span className="metric-value">
                  {angle ?? '—'}
                  <small>°</small>
                </span>
                <span className="meta">
                  2D estimate from one camera view — not a clinical angle
                </span>
              </div>
              <p>
                Movement state: <StatusPill tone="neutral">{latest.state}</StatusPill>
              </p>
              <p>
                Frame quality:{' '}
                {latest.quality.usable ? (
                  <StatusPill tone="good">
                    Usable · confidence {latest.quality.confidence.toFixed(2)}
                  </StatusPill>
                ) : (
                  <StatusPill tone="bad">Not usable — measurement unavailable</StatusPill>
                )}
              </p>
            </>
          ) : null}
          {stream.warnings.length ? (
            <div className="warning-list" role="status">
              {stream.warnings.map((warning) => (
                <p key={warning.sequence}>
                  <StatusPill tone="warn">Quality warning</StatusPill> {warning.message} (seq{' '}
                  {warning.sequence})
                </p>
              ))}
            </div>
          ) : null}
          <p className="meta">
            Events received: {received} · last accepted sequence: {stream.lastSequence}
          </p>
          <div className="button-row">
            {phase === 'streaming' ? (
              <button type="button" onClick={() => setPhase('paused')}>
                Pause
              </button>
            ) : null}
            {phase === 'paused' ? (
              <button className="primary" type="button" onClick={() => setPhase('streaming')}>
                Resume
              </button>
            ) : null}
            {phase === 'idle' ? (
              <button className="primary" type="button" onClick={() => setPhase('streaming')}>
                Start simulated stream
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => navigate(`/sessions/${id ?? 'session-demo-1'}/result`)}
            >
              End session
            </button>
            <button type="button" onClick={() => setServiceError(true)}>
              Simulate vision unavailable
            </button>
          </div>
          {phase === 'paused' ? (
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
