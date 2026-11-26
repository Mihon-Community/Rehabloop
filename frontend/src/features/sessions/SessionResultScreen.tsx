import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { SafetyBanner } from '../../components/SafetyBanner';
import { ApiError, api } from '../../lib/api';
import type { SessionSummary } from '../../types';

export function SessionResultScreen() {
  const { id } = useParams();
  const [session, setSession] = useState<SessionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) {
      setError('A session ID is required to view results.');
      setLoading(false);
      return;
    }
    let mounted = true;
    api
      .getSession(id)
      .then((result) => {
        if (mounted) setSession(result);
      })
      .catch((cause: unknown) => {
        if (!mounted) return;
        setError(
          cause instanceof ApiError && cause.status === 401
            ? 'Sign in to view this session.'
            : cause instanceof Error
              ? cause.message
              : 'Could not load the session results.',
        );
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [id]);

  const metrics = session?.metrics;

  return (
    <section className="card" aria-labelledby="session-result-heading">
      <h1 id="session-result-heading">Session result</h1>
      <SafetyBanner />
      {loading && <p role="status">Loading saved session values…</p>}
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      {session && metrics && (
        <>
          <p>
            Status: <strong>{session.status.replace(/_/g, ' ')}</strong>
            {' · '}
            {session.persisted === false
              ? 'In-memory session; not saved for later.'
              : 'Stored session values.'}
          </p>
          <div className="result-grid">
            <div className="metric-card">
              <span>Completed repetitions</span>
              <strong>{metrics.completed_reps}</strong>
            </div>
            <div className="metric-card">
              <span>Protocol target repetitions</span>
              <strong>{metrics.target_reps}</strong>
            </div>
            <div className="metric-card">
              <span>Projected knee-angle range</span>
              <strong>
                {Math.round(metrics.projected_knee_angle_min_deg)}°–
                {Math.round(metrics.projected_knee_angle_max_deg)}°
              </strong>
            </div>
            <div className="metric-card">
              <span>Frames passing quality checks</span>
              <strong>{Math.round(metrics.usable_frame_pct)}%</strong>
            </div>
          </div>
          <p className="meta">
            These are projected movement estimates from one camera view, not clinical measurements.
            Raw video stored: no.
          </p>
          {session.quality_flags.length > 0 && (
            <div className="notice">
              <strong>Session quality notes</strong>
              <ul>
                {session.quality_flags.map((flag) => (
                  <li key={flag}>{flag.replace(/_/g, ' ')}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
      <Link className="button-link" to="/home">
        Return to patient home
      </Link>
    </section>
  );
}
