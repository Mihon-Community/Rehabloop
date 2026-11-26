/** Shared wire types. Keep in sync with docs/api_contract.md and backend schemas. */

export type SessionStatus =
  'draft' | 'ready' | 'active' | 'paused' | 'completed' | 'aborted' | 'review_required';

export type RepState = 'REST' | 'EXTENDING' | 'TARGET_HOLD' | 'RETURNING' | 'INVALID' | 'PAUSED';

export interface Quality {
  usable: boolean;
  reason: string | null;
  confidence: number;
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
  reason: string;
  message: string;
  rep_count: number;
  simulated?: boolean;
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

/** Protocol fields mirror the example protocol record in blueprint Section 5. */
export interface Protocol {
  id: string;
  name: string;
  clinician_name: string;
  side: 'left' | 'right';
  target_reps: number;
  target_angle_min_deg: number;
  target_angle_max_deg: number;
  hold_duration_seconds?: number;
  instructions: string;
  stop_instructions: string;
  version: number;
  approved: boolean;
  camera_view: 'side';
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
