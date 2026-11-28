import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDemo } from '../../app/demoStore';
import { MetricCard } from '../../components/MetricCard';
import { PageHeader } from '../../components/PageHeader';
import { SimulatedBadge } from '../../components/SimulatedBadge';
import { StateMessage } from '../../components/StateMessage';
import { StatusPill } from '../../components/StatusPill';
import { TrendChart } from '../../components/TrendChart';
import { demoPatients, demoProtocols, loadProgress } from '../../lib/data';
import { useAsync } from '../../lib/useAsync';
import type { Protocol } from '../../types';
import {
  AlertTriangle,
  CalendarClock,
  ClipboardCheck,
  GitBranch,
  SlidersHorizontal,
  Stethoscope,
  Users,
} from '@/components/icon';
import { Badge, Button, Card, Input, Textarea } from '@/components/base';

/** Screen 7 — patient list, protocol versioning, session review and trends. */
export function ClinicianDashboardScreen() {
  const { role, setRole } = useDemo();
  const [patientId, setPatientId] = useState(demoPatients[0].id);
  const [noPatients, setNoPatients] = useState(false);
  const [revoked, setRevoked] = useState(false);
  const [draft, setDraft] = useState<Protocol>(demoProtocols[0]);
  const [confirmed, setConfirmed] = useState(false);
  const [savedVersion, setSavedVersion] = useState<number | null>(null);
  const progress = useAsync(() => loadProgress(patientId), [patientId]);
  const patient = demoPatients.find((p) => p.id === patientId) ?? demoPatients[0];
  const flaggedSessions = progress.data?.filter((s) => s.quality_flags.length > 0).length ?? 0;

  return (
    <div className="screen-stack">
      <PageHeader
        eyebrow="Clinician workspace"
        title="Clinician dashboard"
        description="Review assigned patients, session status and quality flags at a glance. Protocol changes require an explicit clinician action."
        icon={<Stethoscope className="size-5" aria-hidden="true" />}
        badge={<SimulatedBadge source="simulated" />}
      />

      {/* Record context, kept above every panel so it is never ambiguous whose
          data — and which protocol version — is on screen. Hidden only while a
          simulated state says this account cannot see these patients at all. */}
      {!noPatients && !revoked ? (
        <div className="patient-banner">
          <span className="patient-banner-name">{patient.display_name}</span>
          <Badge variant="record">{patient.id}</Badge>
          <span className="patient-banner-field">
            Protocol <strong>{patient.protocol_name}</strong>
          </span>
          <span className="patient-banner-field">
            Protocol version <strong>{draft.version}</strong>
          </span>
        </div>
      ) : null}

      <Card role="region" aria-labelledby="overview-heading">
        <div className="card-chart-head flex-wrap">
          <span className="icon-chip" aria-hidden="true">
            <Users className="size-4" />
          </span>
          <div className="min-w-0">
            <h2 id="overview-heading" className="card-chart-title">
              Patient overview
            </h2>
            <p className="card-chart-meta">
              Counts of stored sessions for the selected record. Review quality flags before
              interpretation.
            </p>
          </div>
        </div>
        {role !== 'clinician' ? (
          <StateMessage
            kind="empty"
            title="Viewing the clinician demo while the patient role is selected"
            action={
              <Button variant="outline" size="sm" onClick={() => setRole('clinician')}>
                Switch demo view to clinician
              </Button>
            }
          >
            The real backend verifies clinician role and patient assignment. This UI selection only
            changes what is displayed.
          </StateMessage>
        ) : null}
        {progress.status === 'ready' && progress.data?.length ? (
          <div className="metric-grid motion-stagger">
            <MetricCard
              label="Assigned patients"
              value={demoPatients.length}
              hint="Demo accounts"
              icon={<Users className="size-4" aria-hidden="true" />}
            />
            <MetricCard
              label="Recorded sessions"
              value={progress.data.length}
              hint={patient.display_name}
              icon={<CalendarClock className="size-4" aria-hidden="true" />}
            />
            <MetricCard
              label="Sessions with quality flags"
              value={flaggedSessions}
              hint="Review before interpretation"
              icon={<AlertTriangle className="size-4" aria-hidden="true" />}
            />
          </div>
        ) : null}
        <div className="button-row">
          <Button variant="outline" size="lg" onClick={() => setNoPatients((v) => !v)}>
            {noPatients ? 'Restore patient list' : 'Simulate no assigned patients'}
          </Button>
          <Button variant="outline" size="lg" onClick={() => setRevoked((v) => !v)}>
            {revoked ? 'Restore access' : 'Simulate revoked access'}
          </Button>
        </div>
        {noPatients ? (
          <StateMessage kind="empty" title="No assigned patients">
            There are no patients assigned to this account. No protocol or exercise is suggested.
          </StateMessage>
        ) : null}
        {revoked ? (
          <StateMessage kind="error" title="Access revoked">
            This account can no longer view these patients. The backend is authoritative; reload
            after access is restored.
          </StateMessage>
        ) : null}
      </Card>

      {!noPatients && !revoked ? (
        <>
          <Card role="region" aria-labelledby="patients-heading">
            <div className="card-chart-head flex-wrap">
              <span className="icon-chip" aria-hidden="true">
                <ClipboardCheck className="size-4" />
              </span>
              <div className="min-w-0">
                <h2 id="patients-heading" className="card-chart-title">
                  Assigned patients
                </h2>
                <p className="card-chart-meta">
                  Selecting a record changes only what is displayed below.
                </p>
              </div>
              <Badge variant="outline">{demoPatients.length} records</Badge>
            </div>
            <ul className="item-list motion-stagger">
              {demoPatients.map((p) => (
                <li key={p.id} className="list-card">
                  <Button
                    type="button"
                    size="lg"
                    variant={p.id === patientId ? 'secondary' : 'outline'}
                    aria-pressed={p.id === patientId}
                    onClick={() => setPatientId(p.id)}
                  >
                    {p.display_name} {p.id === patientId ? '(selected)' : ''}
                  </Button>
                  <span className="flex min-w-0 flex-wrap items-center gap-2">
                    <Badge variant="record">{p.id}</Badge>
                    <span className="meta">{p.protocol_name}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <Card role="region" aria-labelledby="editor-heading">
            <div className="card-chart-head flex-wrap">
              <span className="icon-chip" aria-hidden="true">
                <SlidersHorizontal className="size-4" />
              </span>
              <div className="min-w-0">
                <h2 id="editor-heading" className="card-chart-title">
                  Protocol editor — {patient.display_name}
                </h2>
                <p className="card-chart-meta">
                  Current version: {draft.version}. Saving creates version {draft.version + 1}.
                </p>
              </div>
              <Badge variant="record">{draft.id}</Badge>
            </div>
            <div className="form-grid">
              <label>
                Target repetitions (count)
                <Input
                  type="number"
                  min="1"
                  max="30"
                  value={draft.target_reps}
                  onChange={(event) =>
                    setDraft({ ...draft, target_reps: Number(event.target.value) })
                  }
                />
              </label>
              <label>
                Target range minimum (° projected estimate)
                <Input
                  type="number"
                  min="0"
                  max="180"
                  value={draft.target_angle_min_deg}
                  onChange={(event) =>
                    setDraft({ ...draft, target_angle_min_deg: Number(event.target.value) })
                  }
                />
              </label>
              <label>
                Target range maximum (° projected estimate)
                <Input
                  type="number"
                  min="0"
                  max="180"
                  value={draft.target_angle_max_deg}
                  onChange={(event) =>
                    setDraft({ ...draft, target_angle_max_deg: Number(event.target.value) })
                  }
                />
              </label>
              <label>
                Hold duration (s)
                <Input
                  type="number"
                  min="0"
                  max="30"
                  value={draft.hold_duration_seconds ?? 0}
                  onChange={(event) =>
                    setDraft({ ...draft, hold_duration_seconds: Number(event.target.value) })
                  }
                />
              </label>
              <label className="full-width">
                Clinician notes
                <Textarea
                  rows={2}
                  value={draft.notes ?? ''}
                  onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
                />
              </label>
            </div>

            {/* The draft read back as labelled fields before it is committed, so
                the values being saved can be checked without re-reading the form.
                The spacing lives on this wrapper because `.section-kicker` sets
                its own margins and a `mt-*` utility would lose to them. */}
            <div className="mt-6">
              <p className="section-kicker">Draft parameters</p>
              <dl className="vitals-strip">
                <div className="min-w-0">
                  <dt className="vitals-label">Target side</dt>
                  <dd className="vitals-value capitalize">{draft.side}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="vitals-label">Target reps</dt>
                  <dd className="vitals-value">{draft.target_reps}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="vitals-label">Target angle range</dt>
                  <dd className="vitals-value">
                    {draft.target_angle_min_deg}–{draft.target_angle_max_deg}°
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="vitals-label">Version</dt>
                  <dd className="vitals-value">{draft.version}</dd>
                </div>
              </dl>
              <p className="meta">Projected estimate, not a medical threshold.</p>
            </div>

            <label className="confirm-check">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              I confirm this protocol change is appropriate for this individual patient.
            </label>
            <div className="button-row">
              <Button
                type="button"
                variant="confirm"
                size="lg"
                disabled={!confirmed}
                onClick={() => {
                  setDraft({ ...draft, version: draft.version + 1 });
                  setSavedVersion(draft.version + 1);
                  setConfirmed(false);
                }}
              >
                <ClipboardCheck aria-hidden="true" />
                Save as new version
              </Button>
            </div>
            {savedVersion ? (
              <Card triage="stable" className="mt-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <span className="icon-chip" aria-hidden="true">
                    <GitBranch className="size-4" />
                  </span>
                  <StatusPill tone="good">Version {savedVersion} saved</StatusPill>
                  <p className="meta min-w-0 flex-1">
                    Recorded as an explicit clinician action. No automatic change to the patient’s
                    care plan.
                  </p>
                </div>
              </Card>
            ) : null}
          </Card>

          {/* The caution spine appears only when this record actually carries
              quality flags, and never alone: the pill in the header states the
              count in words beside it. */}
          <Card
            surface="paper"
            triage={flaggedSessions > 0 ? 'caution' : undefined}
            role="region"
            aria-labelledby="sessions-heading"
          >
            <div className="card-chart-head flex-wrap">
              <span className="icon-chip" aria-hidden="true">
                <CalendarClock className="size-4" />
              </span>
              <div className="min-w-0">
                <h2 id="sessions-heading" className="card-chart-title">
                  Sessions for {patient.display_name}
                </h2>
                <p className="card-chart-meta">
                  Stored session values only. Review quality flags before interpretation.
                </p>
              </div>
              {/* Same condition as the spine above, so the colour never arrives
                  without the words. */}
              {flaggedSessions > 0 ? (
                <StatusPill tone="warn">{flaggedSessions} sessions flagged</StatusPill>
              ) : null}
            </div>
            {progress.status === 'loading' ? (
              <StateMessage kind="loading" title="Loading patient progress…" />
            ) : null}
            {progress.status === 'error' ? (
              <StateMessage
                kind="error"
                title="Could not load progress"
                action={
                  <Button variant="outline" size="sm" onClick={progress.reload}>
                    Retry
                  </Button>
                }
              >
                {progress.error}
              </StateMessage>
            ) : null}
            {progress.status === 'ready' && !progress.data?.length ? (
              <StateMessage kind="empty" title="No sessions to review" />
            ) : null}
            {progress.status === 'ready' && progress.data?.length ? (
              /* Seven columns of identifiers and stored values cannot be
                 squeezed onto a phone, so the table scrolls inside its card
                 rather than widening the page. */
              <div className="overflow-x-auto">
                <table className="data-table">
                  <caption>
                    Recorded sessions for {patient.display_name}. Repetitions are counts; usable
                    frames is a percentage of recorded frames.
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Date</th>
                      <th scope="col">Session</th>
                      <th scope="col">Status</th>
                      <th scope="col">Reps</th>
                      <th scope="col">Usable frames</th>
                      <th scope="col">Quality flags</th>
                      <th scope="col">Review</th>
                    </tr>
                  </thead>
                  <tbody>
                    {progress.data.map((session) => (
                      <tr key={session.id}>
                        <th scope="row" className="whitespace-nowrap">
                          {session.started_at.slice(0, 10)}
                        </th>
                        <td>
                          <Badge variant="record">{session.id}</Badge>
                        </td>
                        <td>
                          <StatusPill tone={session.status === 'completed' ? 'good' : 'warn'}>
                            {session.status}
                          </StatusPill>
                        </td>
                        <td>{session.completed_reps ?? '—'}</td>
                        <td>
                          {session.usable_frame_pct != null ? `${session.usable_frame_pct}%` : '—'}
                        </td>
                        <td>
                          {session.quality_flags.length ? (
                            <StatusPill tone="warn">
                              {session.quality_flags.length} flagged
                            </StatusPill>
                          ) : (
                            'None'
                          )}
                        </td>
                        <td>
                          <Link to={`/sessions/${session.id}/result`}>Review session</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </Card>

          {progress.status === 'ready' && progress.data?.length ? (
            <TrendChart sessions={progress.data} source={progress.source ?? 'simulated'} />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
