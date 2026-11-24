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
