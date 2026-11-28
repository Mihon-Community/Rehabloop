import { api, ApiError } from './api';
import {
  demoPatients,
  demoProtocols,
  demoSessionDetail,
  demoSessions,
  deterministicSummary,
} from './mocks/fixtures';
import type {
  DataResult,
  DemoProtocol,
  Protocol,
  SessionDetail,
  SessionRecord,
  SummaryPayload,
} from '../types';

/**
 * Data-access boundary for the UI. It calls the contract endpoints first and
 * falls back to clearly labelled fixtures while the backend is in scaffold
 * phase (501) or unavailable. Callers MUST render `source === 'simulated'` as a
 * SIMULATED badge — fallback never means "pretend this is live data".
 *
 * Only "the backend cannot serve this at all" justifies that labelled demo
 * data. 401 and 409 are deliberately excluded: they mean the request itself
 * was refused (not signed in, or the session is not completed), and answering
 * those with fixtures would dress a real refusal up as data. Callers must
 * surface them instead — and must distinguish a rejection from a pending
 * request, or the screen hangs on its loading state forever.
 */
function unavailable(error: unknown): boolean {
  if (error instanceof ApiError) {
    return [404, 501, 502, 503].includes(error.status);
  }
  return true; // network/CORS failure: local demo mode
}

/**
 * The request never described a real resource — the backend rejected its shape
 * before any domain rule ran, so there is nothing live to show.
 *
 * Reachable from ordinary navigation: the scaffold routes
 * (`/sessions/session-demo-1/...`, wired into the sidebar, StepCards and
 * DemoProvider's defaults) are not UUIDs, while the routes declare
 * `session_id: UUID`.
 *
 * Matching on the `VALIDATION_ERROR` code and not on 422 alone is what keeps
 * this safe: a 422 carrying `UNPROCESSABLE` is a domain refusal (invalid
 * clinician protocol parameters, say) and must never be answered with a
 * fixture.
 */
function malformedRequest(error: unknown): boolean {
  return (
    error instanceof ApiError && error.status === 422 && error.body.code === 'VALIDATION_ERROR'
  );
}

function readFiniteNumber(parameters: Record<string, unknown>, key: string): number | undefined {
  const value = parameters[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readNonEmptyString(parameters: Record<string, unknown>, key: string): string | undefined {
  const value = parameters[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * Map a backend `Protocol` onto the flattened display shape.
 *
 * The parameter keys read here must stay in step with the ones
 * `backend/app/services/session_service.py::_protocol_configuration` validates
 * (`target_min_deg`/`target_max_deg`/`rest_*`/`target_reps`). A protocol whose
 * parameters use some other spelling will render perfectly but still be
 * rejected with 422 at session start, so a mismatch here is invisible until a
 * patient tries to begin.
 *
 * `approved` requires both an approval timestamp and an active row: an archived
 * protocol that was once approved must not re-open the clinical gate.
 */
export function toProtocolView(protocol: Protocol): DemoProtocol {
  const parameters = protocol.parameters ?? {};
  const side = readNonEmptyString(parameters, 'side');
  const holdMs = readFiniteNumber(parameters, 'hold_ms');
  return {
    id: protocol.id,
    name: protocol.protocol_name,
    side: side === 'left' || side === 'right' ? side : undefined,
    target_reps: readFiniteNumber(parameters, 'target_reps'),
    target_angle_min_deg: readFiniteNumber(parameters, 'target_min_deg'),
    target_angle_max_deg: readFiniteNumber(parameters, 'target_max_deg'),
    hold_duration_seconds: holdMs === undefined ? undefined : holdMs / 1000,
    version: protocol.version,
    approved: protocol.approved_at !== null && protocol.active,
    camera_view: readNonEmptyString(parameters, 'camera') === 'side' ? 'side' : undefined,
  };
}

export async function loadProtocols(): Promise<DataResult<DemoProtocol[]>> {
  try {
    const data = await api.myProtocols();
    if (!Array.isArray(data) || !data.every((p) => p && typeof p.id === 'string')) {
      throw new Error('Unexpected protocol payload');
    }
    return { data: data.map(toProtocolView), source: 'live' };
  } catch (error) {
    if (!unavailable(error)) throw error;
    return { data: demoProtocols, source: 'simulated' };
  }
}

export async function loadSession(id: string): Promise<DataResult<SessionDetail>> {
  try {
    const session = await api.getSession(id);
    // The contract's SessionSummary has no trace yet; never invent one.
    return {
      data: { ...session, angle_trace: [], events: [] },
      source: 'live',
    };
  } catch (error) {
    if (!unavailable(error) && !malformedRequest(error)) throw error;
    return { data: demoSessionDetail, source: 'simulated' };
  }
}

/** No list-sessions endpoint exists in the v1 contract, so history is a labelled demo fixture. */
export function loadSessions(): DataResult<SessionRecord[]> {
  return { data: demoSessions, source: 'simulated' };
}

export interface SummaryResult extends DataResult<SummaryPayload> {
  /** True when the deterministic fallback was used instead of the LLM. */
  fallback: boolean;
  reason?: string;
}

export async function loadSummary(session: SessionDetail): Promise<SummaryResult> {
  try {
    const data = await api.createSummary(session.session_id);
    return { data, source: 'live', fallback: false };
  } catch (error) {
    // A fixture session's id is not one the backend can look up, so there is
    // no live summary to wait for — describe its stored numbers deterministically
    // rather than surfacing a path-validation message to a patient.
    if (!unavailable(error) && !malformedRequest(error)) throw error;
    const reason =
      error instanceof ApiError ? (error.body.code ?? error.body.detail) : 'Unavailable';
    return {
      data: deterministicSummary(session),
      source: 'simulated',
      fallback: true,
      reason,
    };
  }
}

export async function loadProgress(patientId: string): Promise<DataResult<SessionRecord[]>> {
  try {
    const result = (await api.progress(patientId)) as { sessions?: SessionRecord[] };
    return { data: result.sessions ?? [], source: 'live' };
  } catch (error) {
    if (!unavailable(error)) throw error;
    const patient = demoPatients.find((p) => p.id === patientId) ?? demoPatients[0];
    return { data: patient.sessions, source: 'simulated' };
  }
}

export async function loadMe(): Promise<
  DataResult<{ id: string; role: string; display_name: string | null }>
> {
  try {
    return { data: await api.me(), source: 'live' };
  } catch (error) {
    if (!unavailable(error)) throw error;
    return {
      data: { id: 'demo-user', role: 'patient', display_name: 'Demo user' },
      source: 'simulated',
    };
  }
}

export { demoPatients, demoProtocols, demoSessions };
