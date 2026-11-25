import type { ApiErrorBody, Profile, Protocol, SessionSummary, SummaryPayload } from '../types';
import { getLocalDemoToken } from './auth';
import { supabase } from './supabase';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: ApiErrorBody,
  ) {
    super(body.detail ?? `API error ${status}`);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
  const accessToken = data.session?.access_token ?? getLocalDemoToken();
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });
  if (!response.ok) {
    let body: ApiErrorBody = { detail: `Request failed (${response.status})` };
    try {
      body = (await response.json()) as ApiErrorBody;
    } catch {
      /* keep the fallback message */
    }
    throw new ApiError(response.status, body);
  }
  return (await response.json()) as T;
}

export const api = {
  health: () => request<{ status: string; storage_mode?: 'memory' | 'supabase' }>('/api/v1/health'),
  me: () => request<Profile>('/api/v1/me'),
  myProtocols: () => request<Protocol[]>('/api/v1/patients/me/protocols'),
  createSession: (protocolId: string) =>
    request<SessionSummary>('/api/v1/sessions', {
      method: 'POST',
      body: JSON.stringify({ protocol_id: protocolId }),
    }),
  startSession: (sessionId: string, consentRecordId: string) =>
    request<SessionSummary>(`/api/v1/sessions/${sessionId}/start`, {
      method: 'POST',
      body: JSON.stringify({ consent_record_id: consentRecordId, camera_checks_passed: true }),
    }),
  completeSession: (sessionId: string) =>
    request<SessionSummary>(`/api/v1/sessions/${sessionId}/complete`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  getSession: (id: string) => request<SessionSummary>(`/api/v1/sessions/${id}`),
  progress: (patientId: string) => request<unknown>(`/api/v1/patients/${patientId}/progress`),
  createSummary: (id: string) =>
    request<SummaryPayload>(`/api/v1/sessions/${id}/summary`, { method: 'POST' }),
};

/** The backend accepts a short-lived session token here, never the user JWT. */
export function sessionStreamUrl(sessionId: string, token: string): string {
  const wsBase = BASE_URL.replace(/^http/, 'ws');
  return `${wsBase}/api/v1/sessions/${sessionId}/stream?token=${encodeURIComponent(token)}`;
}
