import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CalendarClock, Users } from 'lucide-react';
import { useDemo } from '../../app/demoStore';
import { MetricCard } from '../../components/MetricCard';
import { PageHeader } from '../../components/PageHeader';
import { SimulatedBadge } from '../../components/SimulatedBadge';
import { StateMessage } from '../../components/StateMessage';
import { StatusPill } from '../../components/StatusPill';
import { TrendChart } from '../../components/TrendChart';
import { demoPatients, demoProtocols, loadProgress } from '../../lib/data';
import { useAsync } from '../../lib/useAsync';
import type { DemoProtocol } from '../../types';

/** Screen 7 — patient list, protocol versioning, session review and trends. */
export function ClinicianDashboardScreen() {
  const { role, setRole } = useDemo();
  const [patientId, setPatientId] = useState(demoPatients[0].id);
  const [noPatients, setNoPatients] = useState(false);
  const [revoked, setRevoked] = useState(false);
  const [draft, setDraft] = useState<DemoProtocol>(demoProtocols[0]);
  const [confirmed, setConfirmed] = useState(false);
  const [savedVersion, setSavedVersion] = useState<number | null>(null);
  const progress = useAsync(() => loadProgress(patientId), [patientId]);
  const patient = demoPatients.find((p) => p.id === patientId) ?? demoPatients[0];

  return (
    <div className="screen-stack">
      <PageHeader
        eyebrow="Clinician workspace"
        title="Clinician dashboard"
        description="Review assigned patients, session status and quality flags at a glance. Protocol changes require an explicit clinician action."
        badge={<SimulatedBadge source="simulated" />}
      />

      <section className="card">
        <h2 className="mt-0">Patient overview</h2>
        {role !== 'clinician' ? (
          <StateMessage
            kind="empty"
            title="Viewing the clinician demo while the patient role is selected"
          >
            The real backend verifies clinician role and patient assignment. This UI selection only
            changes what is displayed.
            <button type="button" onClick={() => setRole('clinician')}>
              Switch demo view to clinician
            </button>
          </StateMessage>
        ) : null}
        {progress.status === 'ready' && progress.data?.length ? (
          <div className="grid gap-3 sm:grid-cols-3 motion-stagger">
            <MetricCard
              label="Assigned patients"
              value={demoPatients.length}
              hint="Demo accounts"
              icon={<Users className="size-4" aria-hidden="true" />}
            />
            <MetricCard
              label={`Sessions · ${patient.display_name}`}
              value={progress.data.length}
              hint="Recorded"
              icon={<CalendarClock className="size-4" aria-hidden="true" />}
            />
            <MetricCard
              label="Sessions with quality flags"
              value={progress.data.filter((s) => s.quality_flags.length > 0).length}
              hint="Review before interpretation"
              icon={<AlertTriangle className="size-4" aria-hidden="true" />}
            />
          </div>
        ) : null}
        <div className="button-row">
          <button type="button" onClick={() => setNoPatients((v) => !v)}>
            {noPatients ? 'Restore patient list' : 'Simulate no assigned patients'}
          </button>
          <button type="button" onClick={() => setRevoked((v) => !v)}>
            {revoked ? 'Restore access' : 'Simulate revoked access'}
          </button>
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
        {!noPatients && !revoked ? (
          <>
            <h2>Assigned patients</h2>
            <ul className="item-list motion-stagger">
              {demoPatients.map((p) => (
                <li key={p.id} className="list-card">
                  <button
                    type="button"
                    aria-pressed={p.id === patientId}
                    onClick={() => setPatientId(p.id)}
                  >
                    {p.display_name} {p.id === patientId ? '(selected)' : ''}
                  </button>
                  <span className="meta">{p.protocol_name}</span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </section>

      {!noPatients && !revoked ? (
        <>
          <section className="card" aria-labelledby="editor-heading">
            <h2 id="editor-heading">Protocol editor — {patient.display_name}</h2>
            <p className="meta">
              Current version: {draft.version}. Saving creates version {draft.version + 1}.
            </p>
            <div className="form-grid">
              <label>
                Target repetitions (count)
                <input
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
                <input
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
                <input
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
                <input
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
                <textarea
                  rows={2}
                  value={draft.notes ?? ''}
                  onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
                />
              </label>
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
              <button
                className="primary"
                type="button"
                disabled={!confirmed}
                onClick={() => {
                  setDraft({ ...draft, version: draft.version + 1 });
                  setSavedVersion(draft.version + 1);
                  setConfirmed(false);
                }}
              >
                Save as new version
              </button>
            </div>
            {savedVersion ? (
              <p className="meta">
                <StatusPill tone="good">Version {savedVersion} saved</StatusPill> Recorded as an
                explicit clinician action. No automatic change to the patient’s care plan.
              </p>
            ) : null}
          </section>

          <section className="card" aria-labelledby="sessions-heading">
            <h2 id="sessions-heading">Sessions for {patient.display_name}</h2>
            {progress.status === 'loading' ? (
              <StateMessage kind="loading" title="Loading patient progress…" />
            ) : null}
            {progress.status === 'error' ? (
              <StateMessage
                kind="error"
                title="Could not load progress"
                action={<button onClick={progress.reload}>Retry</button>}
              >
                {progress.error}
              </StateMessage>
            ) : null}
            {progress.status === 'ready' && !progress.data?.length ? (
              <StateMessage kind="empty" title="No sessions to review" />
            ) : null}
            {progress.status === 'ready' && progress.data?.length ? (
              <ul className="item-list motion-stagger">
                {progress.data.map((session) => (
                  <li key={session.id} className="list-card">
                    <span>
                      <strong>{session.started_at.slice(0, 10)}</strong>{' '}
                      <StatusPill tone={session.status === 'completed' ? 'good' : 'warn'}>
                        {session.status}
                      </StatusPill>
                    </span>
                    <span className="meta">
                      {session.completed_reps ?? '—'} reps · {session.usable_frame_pct ?? '—'}%
                      usable frames · {session.quality_flags.length || 'no'} quality flags
                    </span>
                    <span className="button-row">
                      <Link className="button-link" to={`/sessions/${session.id}/result`}>
                        Review session
                      </Link>
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          {progress.status === 'ready' && progress.data?.length ? (
            <TrendChart sessions={progress.data} source={progress.source ?? 'simulated'} />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
