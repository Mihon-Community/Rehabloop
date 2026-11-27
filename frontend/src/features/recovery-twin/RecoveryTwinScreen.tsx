import { lazy, Suspense, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Info } from 'lucide-react';
import { SimulatedBadge } from '../../components/SimulatedBadge';
import { StateMessage } from '../../components/StateMessage';
import { StatusPill } from '../../components/StatusPill';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert';
import { loadSession } from '../../lib/data';
import { useAsync } from '../../lib/useAsync';
import { demoCompareTrace } from '../../lib/mocks/fixtures';
import type { AngleSample } from '../../types';

const TwinAvatar = lazy(() => import('./TwinAvatar'));

/** Screen 8 — measured-angle replay with a visible gap for unusable frames. */
export function RecoveryTwinScreen() {
  const { status, data, source, error, reload } = useAsync(() => loadSession('session-demo-1'), []);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [compare, setCompare] = useState(false);
  const [metric, setMetric] = useState<'angle' | 'reps'>('angle');

  const trace: AngleSample[] = data?.angle_trace ?? [];
  const sample = trace[index];
  const compareSample = demoCompareTrace[Math.min(index, demoCompareTrace.length - 1)];

  useEffect(() => {
    if (!playing || trace.length === 0) return;
    const timer = setInterval(() => {
      setIndex((current) => (current + 1) % trace.length);
    }, 600);
    return () => clearInterval(timer);
  }, [playing, trace.length]);

  return (
    <section className="card" aria-labelledby="twin-heading">
      <div className="screen-title-row">
        <h1 id="twin-heading">8. Recovery Twin</h1>
        <SimulatedBadge source={source ?? 'simulated'} />
      </div>
      <p className="screen-intro">
        Replay the recorded session frame by frame and compare it with an earlier one.
      </p>
      <Alert variant="info" icon={<Info className="size-5" />}>
        <AlertTitle>What this visualisation represents</AlertTitle>
        <AlertDescription>
          The avatar follows the same projected 2D knee-angle estimate shown in the session metrics.
          It is a schematic replay of the measured movement plane — not true 3D biomechanics, not an
          anatomical measurement, and not evidence of recovery. Missing or low-quality frames appear
          as labelled gaps, never invented motion.
        </AlertDescription>
      </Alert>
      {status === 'loading' ? <StateMessage kind="loading" title="Loading session trace…" /> : null}
      {status === 'error' ? (
        <StateMessage
          kind="error"
          title="Could not load session"
          action={<button onClick={reload}>Retry</button>}
        >
          {error}
        </StateMessage>
      ) : null}
      {status === 'ready' && trace.length === 0 ? (
        <StateMessage kind="empty" title="No angle trace is available for this session">
          The API session summary does not include a frame-level trace yet. No motion is invented.
          Use the labelled simulated fixture in this demo build.
        </StateMessage>
      ) : null}
      {status === 'ready' && trace.length > 0 ? (
        <>
          <div className="twin-grid motion-stagger">
            <div>
              <h3>Recorded session {data?.session_id}</h3>
              <p className="meta">
                Protocol version {data?.protocol_version} · model {data?.model_version} · mapping{' '}
                {data?.keypoint_mapping_version} · quality flags{' '}
                {data?.quality_flags.length ? data.quality_flags.join(', ') : 'none'}
              </p>
              <Suspense
                fallback={
                  <div className="twin-skeleton" role="status">
                    Loading 3D view…
                  </div>
                }
              >
                <TwinAvatar angle={sample?.angle_deg ?? null} variant="primary" />
              </Suspense>
              <p>
                {sample?.angle_deg === null || sample?.angle_deg === undefined ? (
                  <StatusPill tone="bad">
                    Measurement unavailable — visible gap, no interpolated motion
                  </StatusPill>
                ) : metric === 'angle' ? (
                  <StatusPill tone="good">
                    Projected knee angle estimate: {Math.round(sample.angle_deg * 10) / 10}°
                  </StatusPill>
                ) : (
                  <StatusPill tone="good">
                    Repetitions counted so far: {sample.rep_count}
                  </StatusPill>
                )}
              </p>
            </div>
            {compare ? (
              <div>
                <h3>Earlier session — comparison</h3>
                <p className="meta">Labelled purple, not distinguished by colour alone.</p>
                <Suspense
                  fallback={
                    <div className="twin-skeleton" role="status">
                      Loading 3D view…
                    </div>
                  }
                >
                  <TwinAvatar angle={compareSample?.angle_deg ?? null} variant="compare" />
                </Suspense>
                <p>
                  <StatusPill tone="neutral">
                    Earlier projected estimate:{' '}
                    {compareSample?.angle_deg === null
                      ? 'unavailable'
                      : `${Math.round((compareSample?.angle_deg ?? 0) * 10) / 10}°`}
                  </StatusPill>
                </p>
              </div>
            ) : null}
          </div>

          <div className="button-row">
            <button type="button" onClick={() => setPlaying((v) => !v)}>
              {playing ? 'Pause replay' : 'Play replay'}
            </button>
            <button type="button" onClick={() => setCompare((v) => !v)} aria-pressed={compare}>
              {compare ? 'Hide comparison' : 'Compare with earlier session'}
            </button>
            <label>
              Metric shown{' '}
              <select
                value={metric}
                onChange={(event) => setMetric(event.target.value as 'angle' | 'reps')}
              >
                <option value="angle">Projected angle estimate</option>
                <option value="reps">Repetitions counted</option>
              </select>
            </label>
          </div>
          <label className="full-width">
            Timeline — frame {index + 1} of {trace.length} ({sample?.timestamp_ms ?? 0} ms)
            <input
              type="range"
              min={0}
              max={Math.max(trace.length - 1, 0)}
              value={index}
              onChange={(event) => {
                setPlaying(false);
                setIndex(Number(event.target.value));
              }}
            />
          </label>
          <p className="meta">
            Low-confidence frames are shown as a labelled gap. Missing frames are never filled with
            invented motion.
          </p>
        </>
      ) : null}
      <p className="meta">
        <Link to="/sessions/session-demo-1/result">Back to session result</Link>
      </p>
    </section>
  );
}
