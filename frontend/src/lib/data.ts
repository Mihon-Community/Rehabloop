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
  SessionDetail,
  SessionRecord,
  SummaryPayload,
} from '../types';

/**
 * Data-access boundary for the UI. It calls the contract endpoints first and
 * falls back to clearly labelled fixtures while the backend is in scaffold
 * phase (501) or unavailable. Callers MUST render `source === 'simulated'` as a
 * SIMULATED badge — fallback never means "pretend this is live data".
 */
function unavailable(error: unknown): boolean {
  if (error instanceof ApiError) {
    return [404, 501, 502, 503].includes(error.status);
  }
  return true; // network/CORS failure: local demo mode
}

/**
 * NOTE: the backend's `Protocol` contract (see `types.Protocol`) does not yet
 * match this flattened `DemoProtocol` display shape. Live data is cast below
 * to keep placeholder screens compiling; reconcile before relying on it.
 */
export async function loadProtocols(): Promise<DataResult<DemoProtocol[]>> {
  try {
    const data = (await api.myProtocols()) as unknown as DemoProtocol[];
    if (!Array.isArray(data) || !data.every((p) => p && typeof p.id === 'string')) {
      throw new Error('Unexpected protocol payload');
    }
    return { data, source: 'live' };
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
    if (!unavailable(error)) throw error;
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
    if (!unavailable(error)) throw error;
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
