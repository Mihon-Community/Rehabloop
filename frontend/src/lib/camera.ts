import { api } from './api';
import { isLocalDemoSession } from './auth';
import { supabase } from './supabase';

export const CAMERA_CONSENT_VERSION = 'camera-processing-v1';
export const CAMERA_CONSENT_PURPOSE = 'camera_processing';

// These identifiers match the repository's synthetic local/demo seeds only.
const MEMORY_DEMO_CONSENT_ID = 'demo-consent-record';
const SEEDED_DEMO_CONSENT_ID = '44444444-4444-4444-8444-444444444444';

let activeCameraStream: MediaStream | null = null;

export function setActiveCameraStream(stream: MediaStream | null): void {
  activeCameraStream = stream;
}

export function getActiveCameraStream(): MediaStream | null {
  return activeCameraStream;
}

export function stopActiveCameraStream(): void {
  activeCameraStream?.getTracks().forEach((track) => track.stop());
  activeCameraStream = null;
}

/** Record explicit consent with the signed-in user's RLS-scoped Supabase client. */
export async function createCameraConsent(patientId: string): Promise<string> {
  if (isLocalDemoSession()) {
    const health = await api.health();
    return health.storage_mode === 'supabase' ? SEEDED_DEMO_CONSENT_ID : MEMORY_DEMO_CONSENT_ID;
  }

  if (!supabase) {
    throw new Error('Supabase sign-in is required to save camera consent in this environment.');
  }

  const { data, error } = await supabase
    .from('consent_records')
    .insert({
      patient_id: patientId,
      consent_version: CAMERA_CONSENT_VERSION,
      purpose: CAMERA_CONSENT_PURPOSE,
    })
    .select('id')
    .single();

  if (error) throw new Error(`Could not save camera consent: ${error.message}`);
  return data.id as string;
}
