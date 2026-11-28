import { Suspense, lazy, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, ListChecks } from 'lucide-react';
import { MetricCard } from '../../components/MetricCard';
import { SimulatedBadge } from '../../components/SimulatedBadge';
import { StateMessage } from '../../components/StateMessage';
import { StatusPill } from '../../components/StatusPill';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { ApiError } from '../../lib/api';
import { loadSession, loadSummary, type SummaryResult } from '../../lib/data';
import { useAsync } from '../../lib/useAsync';
import type { SessionDetail } from '../../types';

const TwinAvatar = lazy(() => import('../recovery-twin/TwinAvatar'));

/**
 * Exactly one of these holds at any time, so a failed request can never be
 * mistaken for one still in flight. Collapsing failure back into "no summary
 * yet" is what previously left this screen showing "Preparing explanation…"
 * forever whenever the summary call rejected.
 */
type SummaryState =
  | { phase: 'loading' }
  | { phase: 'ready'; result: SummaryResult }
  | { phase: 'error'; message: string };

/**
 * Stored metrics are null for a session that never produced usable frames, so
 * the declared `number` on SessionSummary.metrics does not hold for real rows.
 * Render a dash rather than letting `undefined` reach a patient as a value.
 */
function metricValue(value: number | null | undefined): number | string {
  return value ?? '—';
}

function summaryErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    // 409 is the backend refusing to summarise a session that is not
    // completed — a different situation from the summary layer being down,
    // so it deliberately does not fall back to the deterministic template.
    if (error.status === 409) {
      return 'This session was never completed, so there are no final measurements to explain. Record and finish a session first.';
    }
    return error.body.detail ?? `The explanation request failed (${error.status}).`;
  }
  return 'The explanation request could not be completed.';
}

/** Screen 6 — canonical stored numbers first, AI explanation beside them. */
export function SessionResultScreen() {
  const { id } = useParams();
  const sessionState = useAsync(() => loadSession(id ?? 'session-demo-1'), [id]);
  const [summaryState, setSummaryState] = useState<SummaryState>({ phase: 'loading' });

  useEffect(() => {
    let cancelled = false;
    if (!sessionState.data) return;
    setSummaryState({ phase: 'loading' });
    loadSummary(sessionState.data as SessionDetail)
      .then((result) => {
        if (!cancelled) setSummaryState({ phase: 'ready', result });
      })
      .catch((error: unknown) => {
        if (!cancelled) setSummaryState({ phase: 'error', message: summaryErrorMessage(error) });
      });
    return () => {
      cancelled = true;
    };
  }, [sessionState.data]);

  const session = sessionState.data;
  const summary = summaryState.phase === 'ready' ? summaryState.result : null;

  return (
    <div className="screen-stack">
      <section className="card" aria-labelledby="result-heading">
        <div className="screen-title-row">
          <h1 id="result-heading">6. Session result</h1>
          <SimulatedBadge source={sessionState.source ?? 'simulated'} />
        </div>
        <p className="screen-intro">
          The recorded numbers come first. The plain-language explanation sits beside them and never
          replaces them.
        </p>
        {sessionState.status === 'loading' ? (
          <StateMessage kind="loading" title="Loading session record…" />
        ) : null}
        {sessionState.status === 'error' ? (
          <StateMessage
            kind="error"
            title="Session could not be loaded"
            action={<button onClick={sessionState.reload}>Retry</button>}
          >
            {sessionState.error}
          </StateMessage>
        ) : null}
        {sessionState.status === 'ready' && !session ? (
          <StateMessage kind="empty" title="No session available" />
        ) : null}
        {session ? (
          <>
            <p className="meta">
              Session {session.session_id} · protocol version {session.protocol_version} · status{' '}
              {session.status} · model {session.model_version} · mapping{' '}
              {session.keypoint_mapping_version}
            </p>
            <h2>Recorded measurements</h2>
            <p className="meta">
              These are the canonical stored values. All angles are projected knee angle estimates
              from one camera view, not validated anatomical measurements.
            </p>
            <div className="metric-grid motion-stagger">
              <MetricCard
                label="Completed repetitions"
                value={metricValue(session.metrics.completed_reps)}
                unit="/ target"
                hint={
                  session.metrics.target_reps == null
                    ? 'Target not recorded'
                    : `Target: ${session.metrics.target_reps}`
                }
              />
              <MetricCard
                label="Projected knee angle estimate — min"
                value={metricValue(session.metrics.projected_knee_angle_min_deg)}
                unit="°"
              />
              <MetricCard
                label="Projected knee angle estimate — max"
                value={metricValue(session.metrics.projected_knee_angle_max_deg)}
                unit="°"
              />
              <MetricCard
                label="Projected range estimate"
                value={metricValue(session.metrics.projected_range_deg)}
                unit="°"
              />
              <MetricCard
                label="Target range hits"
                value={metricValue(session.metrics.target_range_hit_count)}
                unit="times"
              />
              <MetricCard
                label="Median repetition duration"
                value={metricValue(session.metrics.median_rep_duration_seconds)}
                unit="s"
                hint="Timing cue only, not clinical tempo"
              />
              <MetricCard
                label="Usable frames"
                value={metricValue(session.metrics.usable_frame_pct)}
                unit="%"
              />
            </div>

            <div className="twin-preview">
              <Suspense
                fallback={
                  <p className="meta" role="status">
                    Loading schematic preview…
                  </p>
                }
              >
                <TwinAvatar
                  angle={session.metrics.projected_knee_angle_max_deg}
                  variant="primary"
                />
              </Suspense>
              <div>
                <p className="meta" style={{ marginTop: 0 }}>
                  Schematic replay at this session&rsquo;s peak projected knee angle estimate — the
                  same number shown above, not an additional measurement.
                </p>
              </div>
            </div>

            <p>
              Data-quality flags:{' '}
              {session.quality_flags.length ? (
                session.quality_flags.map((flag) => (
                  <StatusPill key={flag} tone="warn">
                    {flag}
                  </StatusPill>
                ))
              ) : (
                <StatusPill tone="good">No quality flags recorded</StatusPill>
              )}
            </p>
            <p className="meta">Raw video stored: no ({String(session.raw_video_stored)})</p>
          </>
        ) : null}
      </section>

      {session ? (
        <section className="card" aria-labelledby="explanation-heading">
          <h2 id="explanation-heading">AI-generated explanation of recorded measurements</h2>
          <SimulatedBadge source={summary?.source ?? sessionState.source ?? 'simulated'} />
          {summaryState.phase === 'loading' ? (
            <StateMessage kind="loading" title="Preparing explanation…">
              Requesting a constrained summary; numbers below come only from the stored session.
            </StateMessage>
          ) : null}
          {summaryState.phase === 'error' ? (
            <StateMessage kind="error" title="No explanation available">
              {summaryState.message} The stored measurements above are unaffected.
            </StateMessage>
          ) : null}
          {summary ? (
            <>
              {summary.fallback ? (
                <StateMessage
                  kind="empty"
                  title="Language model unavailable — deterministic fallback used"
                >
                  {summary.reason ?? 'Unavailable'}. The text below is generated from the stored
                  numbers by a fixed template, not by a language model.
                </StateMessage>
              ) : null}
              <h3>{summary.data.headline}</h3>
              <p>{summary.data.what_was_measured}</p>
              <ul>
                {summary.data.observed_values.map((value) => (
                  <li key={value}>{value}</li>
                ))}
              </ul>
              <p className="meta">Data quality: {summary.data.data_quality_note}</p>
              <p className="meta">Clinician review: {summary.data.clinician_review_note}</p>
              <p className="meta">
                <StatusPill tone="warn">No clinical advice</StatusPill> This explanation does not
                diagnose, prescribe or say whether an exercise is safe.
              </p>
            </>
          ) : null}
        </section>
      ) : null}

      {session?.events.length ? (
        <section className="card" aria-labelledby="events-heading">
          <h2 id="events-heading">Recorded events</h2>
          <SimulatedBadge source="simulated" />
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Sequence</th>
                <th scope="col">Time (ms)</th>
                <th scope="col">Event</th>
                <th scope="col">Detail</th>
              </tr>
            </thead>
            <tbody>
              {session.events.map((event) => (
                <tr key={`${event.type}-${event.sequence}`}>
                  <td>{event.sequence}</td>
                  <td>{event.type === 'measurement' ? event.timestamp_ms : '—'}</td>
                  <td>{event.type === 'measurement' ? 'measurement' : 'quality_warning'}</td>
                  <td>
                    {event.type === 'measurement'
                      ? `${event.state} · ${Math.round(event.projected_knee_angle_deg * 10) / 10}° projected · ${event.quality.usable ? 'usable' : 'not usable'}`
                      : event.message}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {session ? (
        <Alert variant="info" icon={<ListChecks className="size-5" />}>
          <AlertTitle>What to do next</AlertTitle>
          <AlertDescription>
            Share this record with your physiotherapist at your next visit. They decide what any
            result means for your care plan — this app does not change it.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="button-row">
        <Button asChild>
          <Link to="/home">
            Save and return home <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
        <Button
          variant="outline"
          type="button"
          onClick={() =>
            window.alert('Report prepared for the assigned physiotherapist to review.')
          }
        >
          Share with assigned clinician
        </Button>
        <Button variant="ghost" asChild>
          <Link to="/twin">View Recovery Twin</Link>
        </Button>
      </div>
    </div>
  );
}
