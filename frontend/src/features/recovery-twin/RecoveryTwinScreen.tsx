import { lazy, Suspense, useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader';
import { SimulatedBadge } from '../../components/SimulatedBadge';
import { StateMessage } from '../../components/StateMessage';
import { StatusPill } from '../../components/StatusPill';
import { loadSession } from '../../lib/data';
import { useAsync } from '../../lib/useAsync';
import { demoCompareTrace } from '../../lib/mocks/fixtures';
import type { AngleSample } from '../../types';
import { compareAtFrame, frameAtElapsed } from './angleMapping';
import {
  Activity,
  ArrowRight,
  Box,
  GitCompareArrows,
  Info,
  Pause,
  Play,
  RotateCcw,
} from '@/components/icon';
import { Alert, AlertDescription, AlertTitle, Badge, Button } from '@/components/base';

const TwinAvatar = lazy(() => import('./TwinAvatar'));

/**
 * How far apart two frames may be and still count as the same moment when
 * comparing sessions. Half the fixture's 500 ms cadence: close enough to pair
 * frames recorded at the same instant, tight enough that a differently-paced
 * session reports "no earlier frame" rather than pairing unrelated moments.
 */
const COMPARE_TOLERANCE_MS = 250;

/** One decimal, the precision the stored trace carries. */
function oneDecimal(value: number): string {
  return (Math.round(value * 10) / 10).toFixed(1);
}

/** A frame with no usable measurement prints as a labelled gap, never as 0°. */
function formatAngle(angle: number | null): string {
  return angle === null ? 'No measurement' : `${oneDecimal(angle)}°`;
}

function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`;
}

/* Both viewers lazy-load the same chunk, so both wait behind the same
   placeholder; it keeps the canvas box's footprint while the chunk arrives. */
function ViewerLoading() {
  return (
    <div className="twin-skeleton" role="status">
      Loading 3D view…
    </div>
  );
}

/** Screen 8 — measured-angle replay with a visible gap for unusable frames. */
export function RecoveryTwinScreen() {
  const { status, data, source, error, reload } = useAsync(() => loadSession('session-demo-1'), []);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [compare, setCompare] = useState(false);
  /* useId's colons are legal in id/for attributes but break querySelector, so
     the project strips them (same as TrendChart). */
  const rawId = useId().replace(/:/g, '');
  const replayTitleId = `twin-replay-${rawId}`;
  const timelineId = `twin-timeline-${rawId}`;
  const timelineNoteId = `twin-timeline-note-${rawId}`;

  const trace: AngleSample[] = data?.angle_trace ?? [];
  const lastFrame = Math.max(trace.length - 1, 0);
  const sample = trace[index];
  const angle = sample?.angle_deg ?? null;
  const flags = data?.quality_flags ?? [];

  /* Paired on timestamp, not array position: two sessions are comparable only
     where they recorded the same moment. Index pairing happened to work for
     these two fixtures because they share a timebase, and would have silently
     compared unrelated moments the first time one was recorded at a different
     cadence or length. */
  const comparison = compareAtFrame(sample, demoCompareTrace, COMPARE_TOLERANCE_MS);
  const compareSample = comparison.earlier;
  const compareAngle = compareSample?.angle_deg ?? null;

  /* A reload can return a shorter trace. Clamping keeps the cursor on a frame
     that exists, so the readout never labels a frame "unavailable" when what
     actually happened is that the frame is no longer part of the trace. */
  useEffect(() => {
    setIndex((current) => Math.min(current, Math.max(trace.length - 1, 0)));
  }, [trace.length]);

  /* Replay is driven by the trace's own timestamps on a rAF loop, not a fixed
     setInterval step. The old 600 ms step ran this 500 ms recording at 83% of
     real speed, drifted, and would have ignored an uneven cadence entirely.
     frameAtElapsed only ever returns the index of a frame that exists, so
     nothing is skipped and nothing between frames is invented. */
  const playFrom = useRef({ index: 0, at: 0 });
  useEffect(() => {
    if (!playing || trace.length === 0) return;
    playFrom.current = { index, at: performance.now() };
    let raf = 0;
    const tick = (now: number) => {
      const next = frameAtElapsed(trace, playFrom.current.index, now - playFrom.current.at);
      // Returning the current value unchanged lets React bail out: the loop
      // runs at display rate, but a frame only lasts 500 ms, so without this
      // it would re-render the screen ~30 times per displayed frame.
      setIndex((current) => (current === next ? current : next));
      if (next >= trace.length - 1) {
        // Stops on the last recorded frame instead of looping silently, so the
        // transport's state stays truthful about what is happening.
        setPlaying(false);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // `index` is read once to seed the start position; re-running on every
    // frame would restart the clock and freeze playback on one frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, trace]);

  /* Scrubbing or stepping is a deliberate act on one frame, so either stops
     playback instead of fighting the timer for the next 600 ms. */
  function goToFrame(next: number) {
    setPlaying(false);
    setIndex(Math.min(Math.max(next, 0), lastFrame));
  }

  const frameLabel = `Frame ${index + 1} of ${trace.length}`;
  /* Keyboard scrubbing announces the reading, not just the slider number: a
     range input otherwise reports "12" and nothing about the measurement. */
  const timelineValueText = `${frameLabel}, ${formatSeconds(sample?.timestamp_ms ?? 0)}, ${
    angle === null ? 'no measurement recorded for this frame' : `${oneDecimal(angle)} degrees`
  }`;

  return (
    <div className="screen-stack">
      <PageHeader
        eyebrow="Screen 8"
        title="Recovery Twin"
        description="Replay the recorded session frame by frame and compare it with an earlier one. Every value the view shows is printed beside it as text."
        icon={<Box className="size-5" aria-hidden="true" />}
        badge={<SimulatedBadge source={source ?? 'simulated'} />}
      />

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
          action={
            <Button variant="outline" size="sm" onClick={reload}>
              <RotateCcw aria-hidden="true" />
              Retry
            </Button>
          }
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
          {/* Provenance as labelled fields rather than one punctuation-separated
              run: which session, which protocol version, which model and which
              keypoint mapping produced the numbers below. */}
          <div className="patient-banner">
            <span className="patient-banner-name">Recorded session</span>
            <Badge variant="record">{data?.session_id}</Badge>
            <span className="patient-banner-field">
              Protocol version <strong>{data?.protocol_version}</strong>
            </span>
            <span className="patient-banner-field">
              Model <strong>{data?.model_version}</strong>
            </span>
            <span className="patient-banner-field">
              Keypoint mapping <strong>{data?.keypoint_mapping_version}</strong>
            </span>
            {flags.length > 0 ? (
              flags.map((flag) => (
                <StatusPill key={flag} tone="warn">
                  {flag}
                </StatusPill>
              ))
            ) : (
              <StatusPill tone="neutral">No quality flags</StatusPill>
            )}
          </div>

          <section className="card" aria-labelledby={replayTitleId}>
            <div className="card-chart-head flex-wrap">
              <span className="icon-chip" aria-hidden="true">
                <Activity className="size-5" />
              </span>
              <div className="min-w-0">
                <h2 id={replayTitleId} className="card-chart-title">
                  Measured-angle replay
                </h2>
                <p className="card-chart-meta">
                  {trace.length} recorded frames. Step one frame at a time, or scrub the timeline.
                </p>
              </div>
              {/* Neutral in both states on purpose: a green pill beside a
                  measurement would read as a verdict on the measurement. */}
              <StatusPill tone="neutral">{playing ? 'Replay running' : 'Replay paused'}</StatusPill>
            </div>

            {/* Two viewers only while comparing: a lone canvas in a two-track
                grid would sit in half the card with an empty column beside it.
                The grid keeps minmax(0, 1fr) tracks, so neither canvas's wide
                intrinsic size can widen the page. */}
            <div className={compare ? 'twin-grid motion-stagger' : undefined}>
              <div className="min-w-0">
                <h3 className="m-0">This session</h3>
                <p className="meta">Measured frames from the recording you are reviewing.</p>
                <Suspense fallback={<ViewerLoading />}>
                  <TwinAvatar angle={angle} variant="primary" context="this session" interactive />
                </Suspense>
                {/* The readings sit here, as text, outside the canvas: the view
                    is never the only place a number appears. */}
                <dl className="vitals-strip mt-3">
                  <div className="min-w-0">
                    <dt className="vitals-label">Projected angle</dt>
                    <dd className="vitals-value">{formatAngle(angle)}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="vitals-label">Repetitions counted</dt>
                    <dd className="vitals-value">{sample?.rep_count ?? 0}</dd>
                  </div>
                </dl>
                <p>
                  {angle === null ? (
                    <StatusPill tone="bad">
                      Measurement unavailable — visible gap, no interpolated motion
                    </StatusPill>
                  ) : (
                    <StatusPill tone="good">Recorded frame — {sample.state}</StatusPill>
                  )}
                </p>
              </div>

              {compare ? (
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="m-0">Earlier session — comparison</h3>
                    <SimulatedBadge source="simulated" />
                  </div>
                  <p className="meta">
                    An earlier labelled demo trace, paired with this one by recorded timestamp so
                    the two frames shown are the same moment of the movement.
                  </p>
                  <Suspense fallback={<ViewerLoading />}>
                    <TwinAvatar angle={compareAngle} variant="compare" context="earlier session" />
                  </Suspense>
                  <dl className="vitals-strip mt-3">
                    <div className="min-w-0">
                      <dt className="vitals-label">Projected angle</dt>
                      <dd className="vitals-value">{formatAngle(compareAngle)}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="vitals-label">Difference (this − earlier)</dt>
                      <dd className="vitals-value">
                        {comparison.kind === 'comparable'
                          ? `${comparison.difference > 0 ? '+' : comparison.difference < 0 ? '−' : ''}${oneDecimal(
                              Math.abs(comparison.difference),
                            )}°`
                          : 'Not comparable'}
                      </dd>
                    </div>
                  </dl>
                  {/* States WHY there is no number, rather than leaving the
                      reader to guess what "not comparable" meant. */}
                  <p>
                    {comparison.kind === 'comparable' ? (
                      <StatusPill tone="neutral">
                        Earlier recorded frame — {comparison.earlier.state}
                      </StatusPill>
                    ) : comparison.kind === 'earlier-frame-missing' ? (
                      <StatusPill tone="neutral">
                        Earlier session has no measurement at this moment — labelled gap, no
                        interpolated motion
                      </StatusPill>
                    ) : comparison.kind === 'this-frame-missing' ? (
                      <StatusPill tone="neutral">
                        This session has no measurement at this moment, so there is nothing to
                        compare against
                      </StatusPill>
                    ) : (
                      <StatusPill tone="neutral">
                        The earlier session recorded no frame at this moment
                      </StatusPill>
                    )}
                  </p>
                  {comparison.kind === 'no-earlier-frame' ? (
                    <p className="meta">
                      The earlier session has {demoCompareTrace.length} recorded frames and none
                      within {COMPARE_TOLERANCE_MS} ms of this one. No frame is invented to fill the
                      position.
                    </p>
                  ) : null}
                  <p className="meta">
                    The difference is arithmetic between two projected 2D estimates recorded at the
                    same moment — not a measure of recovery.
                  </p>
                </div>
              ) : null}
            </div>

            {/* Playback transport: play/pause, single-frame stepping, return to
                the first recorded frame, and the comparison toggle. */}
            <div className="button-row" role="group" aria-label="Replay controls">
              <Button
                className="min-h-11"
                onClick={() => {
                  // Parked on the last frame, Play means "play it again" —
                  // otherwise it would stop instantly with nothing to advance.
                  if (!playing && index >= lastFrame) setIndex(0);
                  setPlaying((v) => !v);
                }}
              >
                {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
                {playing ? 'Pause replay' : 'Play replay'}
              </Button>
              <div className="flex min-w-0 gap-2">
                <Button
                  variant="outline"
                  className="min-h-11 flex-1"
                  onClick={() => goToFrame(index - 1)}
                  disabled={index === 0}
                >
                  <ArrowRight className="rotate-180" aria-hidden="true" />
                  Previous frame
                </Button>
                <Button
                  variant="outline"
                  className="min-h-11 flex-1"
                  onClick={() => goToFrame(index + 1)}
                  disabled={index >= lastFrame}
                >
                  Next frame
                  <ArrowRight aria-hidden="true" />
                </Button>
              </div>
              {/* Returns to the first RECORDED frame rather than straightening
                  the limb to a neutral pose: a "default pose" the session never
                  measured would be invented movement. */}
              <Button
                variant="outline"
                className="min-h-11"
                onClick={() => goToFrame(0)}
                disabled={index === 0 && !playing}
              >
                <RotateCcw aria-hidden="true" />
                Back to first recorded frame
              </Button>
              <Button
                variant="outline"
                className="min-h-11"
                onClick={() => setCompare((v) => !v)}
                aria-pressed={compare}
              >
                <GitCompareArrows aria-hidden="true" />
                {compare ? 'Hide comparison' : 'Compare with earlier session'}
              </Button>
            </div>

            {/* Explicit label/value pairing: the <label> names the slider, the
                <output> restates the position for sighted users, and
                aria-valuetext gives a keyboard user the same reading. */}
            <div className="grid gap-2">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <label htmlFor={timelineId} className="text-sm font-semibold">
                  Timeline — recorded frames
                </label>
                <output htmlFor={timelineId} className="meta tabular-nums">
                  {frameLabel} · {formatSeconds(sample?.timestamp_ms ?? 0)} · {formatAngle(angle)}
                </output>
              </div>
              <input
                id={timelineId}
                type="range"
                min={0}
                max={lastFrame}
                step={1}
                value={index}
                aria-valuetext={timelineValueText}
                aria-describedby={timelineNoteId}
                onChange={(event) => goToFrame(Number(event.target.value))}
              />
              <p id={timelineNoteId} className="meta">
                Low-confidence frames are shown as a labelled gap. Missing frames are never filled
                with invented motion.
              </p>
            </div>
          </section>

          <p className="meta">
            <Link to="/sessions/session-demo-1/result">Back to session result</Link>
          </p>
        </>
      ) : null}
    </div>
  );
}
