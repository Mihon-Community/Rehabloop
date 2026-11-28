import { Suspense, lazy, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MetricCard } from '../../components/MetricCard';
import { SimulatedBadge } from '../../components/SimulatedBadge';
import { StateMessage } from '../../components/StateMessage';
import { StatusPill } from '../../components/StatusPill';
import { loadSession, loadSummary, type SummaryResult } from '../../lib/data';
import { useAsync } from '../../lib/useAsync';
import type { SessionDetail } from '../../types';
import {
  ArrowLeftRight,
  ArrowRight,
  Box,
  CheckCircle2,
  ClipboardCheck,
  Gauge,
  ListChecks,
  MessageCircle,
  Repeat,
  TableProperties,
  Timer,
  Video,
} from '@/components/icon';
import { Alert, AlertDescription, AlertTitle, Badge, Button, Card } from '@/components/base';

const TwinAvatar = lazy(() => import('../recovery-twin/TwinAvatar'));

/** Screen 6 — canonical stored numbers first, AI explanation beside them. */
export function SessionResultScreen() {
  const { id } = useParams();
  const sessionState = useAsync(() => loadSession(id ?? 'session-demo-1'), [id]);
  const [summary, setSummary] = useState<SummaryResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!sessionState.data) return;
    setSummary(null);
    loadSummary(sessionState.data as SessionDetail)
      .then((result) => {
        if (!cancelled) setSummary(result);
      })
      .catch(() => {
        if (!cancelled) setSummary(null);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionState.data]);

  const session = sessionState.data;

  return (
    <div className="screen-stack">
      <section className="card" aria-labelledby="result-heading">
        <header className="mb-4 flex flex-wrap items-start gap-3">
          <span className="icon-chip icon-chip-lg mt-0.5" aria-hidden="true">
            <ClipboardCheck className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="section-kicker">Capture pipeline · result</p>
            <div className="screen-title-row">
              <h1 id="result-heading">6. Session result</h1>
              <SimulatedBadge source={sessionState.source ?? 'simulated'} />
            </div>
            <p className="screen-intro mb-0">
              The recorded numbers come first. The plain-language explanation sits beside them and
              never replaces them.
            </p>
          </div>
        </header>
        {sessionState.status === 'loading' ? (
          <StateMessage kind="loading" title="Loading session record…" />
        ) : null}
        {sessionState.status === 'error' ? (
          <StateMessage
            kind="error"
            title="Session could not be loaded"
            action={
              <Button variant="outline" size="sm" onClick={sessionState.reload}>
                Retry
              </Button>
            }
          >
            {sessionState.error}
          </StateMessage>
        ) : null}
        {sessionState.status === 'ready' && !session ? (
          <StateMessage kind="empty" title="No session available" />
        ) : null}
        {session ? (
          /* The record header a clinical screen carries: which session, which
             protocol version and which model produced these numbers, as
             labelled fields rather than one run of text. The identifiers are
             record badges so a transcribed reference reads as a reference. */
          <div className="patient-banner">
            <span className="patient-banner-name">Session record</span>
            <Badge variant="record">{session.session_id}</Badge>
            <span className="patient-banner-field">
              Protocol version <strong>{session.protocol_version}</strong>
            </span>
            <StatusPill tone={session.status === 'completed' ? 'good' : 'neutral'}>
              {session.status}
            </StatusPill>
            <span className="patient-banner-field">
              Model <Badge variant="record">{session.model_version}</Badge>
            </span>
            <span className="patient-banner-field">
              Keypoint mapping <Badge variant="record">{session.keypoint_mapping_version}</Badge>
            </span>
          </div>
        ) : null}
      </section>

      {session ? (
        /* The canonical numbers, on the ECG-paper surface reserved for panels
           whose subject is a measurement — and ahead of any explanation. */
        <Card surface="paper">
          <div className="card-chart-head">
            <span className="icon-chip" aria-hidden="true">
              <Gauge className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="section-kicker mb-0">Stored values, first</p>
              <h2 className="card-chart-title">Recorded measurements</h2>
              <p className="card-chart-meta">
                These are the canonical stored values. All angles are projected knee angle estimates
                from one camera view, not validated anatomical measurements.
              </p>
            </div>
          </div>
          <div className="metric-grid motion-stagger">
            <MetricCard
              label="Completed repetitions"
              value={session.metrics.completed_reps}
              unit="/ target"
              hint={`Target: ${session.metrics.target_reps}`}
              icon={<Repeat className="size-4" aria-hidden="true" />}
            />
            <MetricCard
              label="Projected knee angle estimate — min"
              value={session.metrics.projected_knee_angle_min_deg}
              unit="°"
              icon={<Gauge className="size-4" aria-hidden="true" />}
            />
            <MetricCard
              label="Projected knee angle estimate — max"
              value={session.metrics.projected_knee_angle_max_deg}
              unit="°"
              icon={<Gauge className="size-4" aria-hidden="true" />}
            />
            <MetricCard
              label="Projected range estimate"
              value={session.metrics.projected_range_deg}
              unit="°"
              icon={<ArrowLeftRight className="size-4" aria-hidden="true" />}
            />
            <MetricCard
              label="Target range hits"
              value={session.metrics.target_range_hit_count}
              unit="times"
              icon={<CheckCircle2 className="size-4" aria-hidden="true" />}
            />
            <MetricCard
              label="Median repetition duration"
              value={session.metrics.median_rep_duration_seconds}
              unit="s"
              hint="Timing cue only, not clinical tempo"
              icon={<Timer className="size-4" aria-hidden="true" />}
            />
            <MetricCard
              label="Usable frames"
              value={session.metrics.usable_frame_pct}
              unit="%"
              icon={<Video className="size-4" aria-hidden="true" />}
            />
          </div>

          {/* Provenance of the readings above, as record fields: a flag is a
              stated condition of the data, not a footnote. */}
          <dl className="detail-list mt-4">
            <dt>Data-quality flags</dt>
            <dd className="flex flex-wrap gap-1">
              {session.quality_flags.length ? (
                session.quality_flags.map((flag) => (
                  <StatusPill key={flag} tone="warn">
                    {flag}
                  </StatusPill>
                ))
              ) : (
                <StatusPill tone="good">No quality flags recorded</StatusPill>
              )}
            </dd>
            <dt>Raw video stored</dt>
            <dd>no ({String(session.raw_video_stored)})</dd>
          </dl>
        </Card>
      ) : null}

      {session ? (
        <section className="card">
          <div className="card-chart-head">
            <span className="icon-chip" aria-hidden="true">
              <Box className="size-4" />
            </span>
            <div className="min-w-0">
              <h2 className="card-chart-title">Schematic replay</h2>
              <p className="card-chart-meta">
                A drawing of one number already recorded above — not a second reading.
              </p>
            </div>
          </div>
          <div className="twin-preview">
            <Suspense
              fallback={
                <p className="meta" role="status">
                  Loading schematic preview…
                </p>
              }
            >
              <TwinAvatar angle={session.metrics.projected_knee_angle_max_deg} variant="primary" />
            </Suspense>
            <p className="meta" style={{ marginTop: 0 }}>
              Schematic replay at this session&rsquo;s peak projected knee angle estimate — the same
              number shown above, not an additional measurement.
            </p>
          </div>
        </section>
      ) : null}

      {session ? (
        <section className="card" aria-labelledby="explanation-heading">
          <div className="card-chart-head">
            <span className="icon-chip" aria-hidden="true">
              <MessageCircle className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="section-kicker mb-0">Explanation, second</p>
              <h2 id="explanation-heading" className="card-chart-title">
                AI-generated explanation of recorded measurements
              </h2>
            </div>
            <SimulatedBadge source={summary?.source ?? sessionState.source ?? 'simulated'} />
          </div>
          {!summary ? (
            <StateMessage kind="loading" title="Preparing explanation…">
              Requesting a constrained summary; numbers below come only from the stored session.
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
          <div className="card-chart-head">
            <span className="icon-chip" aria-hidden="true">
              <TableProperties className="size-4" />
            </span>
            <div className="min-w-0">
              <h2 id="events-heading" className="card-chart-title">
                Recorded events
              </h2>
              <p className="card-chart-meta">
                {session.events.length} stored events, in sequence order
              </p>
            </div>
            <SimulatedBadge source="simulated" />
          </div>
          {/* Four columns of readings cannot be squeezed onto a phone without
              becoming unreadable, so the table scrolls sideways in the card. */}
          <div className="overflow-x-auto">
            <table className="data-table">
              <caption>
                Measurement and quality-warning events stored for this session, oldest first.
              </caption>
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
          </div>
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
        <Button size="lg" asChild>
          <Link to="/home">
            Save and return home <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
        <Button
          variant="outline"
          size="lg"
          type="button"
          onClick={() =>
            window.alert('Report prepared for the assigned physiotherapist to review.')
          }
        >
          Share with assigned clinician
        </Button>
        <Button variant="ghost" size="lg" asChild>
          <Link to="/twin">View Recovery Twin</Link>
        </Button>
      </div>
    </div>
  );
}
