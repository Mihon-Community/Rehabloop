import type { ApiErrorBody, SessionSummary, SummaryPayload } from '../types';

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
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
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
  health: () => request<{ status: string }>('/api/v1/health'),
  me: () => request<{ id: string; role: string; display_name: string | null }>('/api/v1/me'),
  myProtocols: () => request<unknown[]>('/api/v1/patients/me/protocols'),
  getSession: (id: string) => request<SessionSummary>(`/api/v1/sessions/${id}`),
  progress: (patientId: string) => request<unknown>(`/api/v1/patients/${patientId}/progress`),
  createSummary: (id: string) =>
    request<SummaryPayload>(`/api/v1/sessions/${id}/summary`, { method: 'POST' }),
};

/** Build the session WebSocket URL. The real client replaces mock events with this. */
export function sessionStreamUrl(sessionId: string, token: string): string {
  const wsBase = BASE_URL.replace(/^http/, 'ws');
  return `${wsBase}/api/v1/sessions/${sessionId}/stream?token=${encodeURIComponent(token)}`;
}
