/** Shared wire types. Keep in sync with docs/api_contract.md and backend schemas. */

export type SessionStatus =
  'draft' | 'ready' | 'active' | 'paused' | 'completed' | 'aborted' | 'review_required';

export type RepState = 'REST' | 'EXTENDING' | 'TARGET_HOLD' | 'RETURNING' | 'INVALID' | 'PAUSED';

export interface Quality {
  usable: boolean;
  reason: string | null;
  confidence: number | null;
}

export interface FrameEvent {
  type: 'frame';
  session_id: string;
  sequence: number;
  timestamp_ms: number;
  image_b64: string;
}

export interface MeasurementEvent {
  type: 'measurement';
  sequence: number;
  timestamp_ms: number;
  projected_knee_angle_deg: number;
  rep_count: number;
  state: RepState;
  quality: Quality;
  model_version: string;
  simulated?: boolean;
}

export interface QualityWarningEvent {
  type: 'quality_warning';
  sequence: number;
  timestamp_ms?: number;
  reason: string;
  message: string;
  rep_count: number;
  model_version?: string;
  simulated?: boolean;
}

export interface StreamErrorEvent {
  type: 'error';
  code: string;
  message: string;
}

export interface Profile {
  id: string;
  role: 'patient' | 'clinician' | 'admin';
  display_name: string;
}

export interface Protocol {
  id: string;
  patient_id: string;
  clinician_id: string;
  protocol_name: string;
  version: number;
  parameters: Record<string, unknown>;
  approved_at: string | null;
  active: boolean;
  persisted?: boolean;
}

export interface SessionSummary {
  session_id: string;
  protocol_id: string;
  protocol_version: number;
  model_version: string;
  keypoint_mapping_version: string;
  analytics_version: string;
  status: SessionStatus;
  metrics: {
    completed_reps: number;
    target_reps: number;
    projected_knee_angle_min_deg: number;
    projected_knee_angle_max_deg: number;
    projected_range_deg: number;
    target_range_hit_count: number;
    median_rep_duration_seconds: number;
    usable_frame_pct: number;
  };
  quality_flags: string[];
  raw_video_stored: false;
  persisted?: boolean;
  stream_token?: string | null;
}

export interface SummaryPayload {
  headline: string;
  what_was_measured: string;
  observed_values: string[];
  data_quality_note: string;
  clinician_review_note: string;
}

export interface ApiErrorBody {
  detail: string;
  code?: string;
}

export type Role = 'patient' | 'clinician';

/**
 * Flattened display shape for the screens that render a protocol. Live rows are
 * mapped from `Protocol` above by `toProtocolView` in `lib/data.ts`; demo
 * fixtures supply the same shape directly.
 *
 * Everything the clinician configures is optional because it lives in
 * `Protocol.parameters`, a free-form map the backend does not type. Screens must
 * therefore handle absence rather than assume a field is present — rendering
 * `undefined` as if it were data is what previously hid a real protocol.
 * `instructions`, `stop_instructions` and `notes` have no backend equivalent at
 * all and are only ever set by fixtures; never synthesise them for live data,
 * since that would be inventing clinical text.
 */
export interface DemoProtocol {
  id: string;
  name: string;
  side?: 'left' | 'right';
  target_reps?: number;
  target_angle_min_deg?: number;
  target_angle_max_deg?: number;
  hold_duration_seconds?: number;
  instructions?: string;
  stop_instructions?: string;
  version: number;
  approved: boolean;
  camera_view?: 'side';
  notes?: string;
}

export interface SessionRecord {
  id: string;
  protocol_id: string;
  protocol_version: number;
  started_at: string;
  status: SessionStatus;
  completed_reps?: number;
  usable_frame_pct?: number;
  projected_range_deg?: number;
  quality_flags: string[];
}

export interface AngleSample {
  timestamp_ms: number;
  angle_deg: number | null;
  usable: boolean;
  rep_count: number;
  state: 'REST' | 'EXTENDING' | 'RETURNING';
}

export type SessionEvent = MeasurementEvent | QualityWarningEvent;

/** GET /sessions/{id} plus the recorded angle trace used by the Recovery Twin. */
export interface SessionDetail extends SessionSummary {
  angle_trace: AngleSample[];
  events: SessionEvent[];
  simulated?: boolean;
}

/** Where a screen's data came from — drives the SIMULATED badge. */
export type DataSource = 'live' | 'simulated';

export interface DataResult<T> {
  data: T;
  source: DataSource;
}
