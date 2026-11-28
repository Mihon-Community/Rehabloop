import type {
  DemoProtocol,
  MeasurementEvent,
  QualityWarningEvent,
  SessionDetail,
  SessionRecord,
  SummaryPayload,
} from '../../types';

/**
 * Labelled synthetic fixtures for demo/dev. These numbers are illustrative and
 * are NOT clinical thresholds, real inference or patient data. Every screen
 * rendering them must show the SIMULATED badge from `SIMULATED_LABEL`.
 */
export const SIMULATED_LABEL = 'SIMULATED — synthetic demo data, not real inference';

export const demoProtocols: DemoProtocol[] = [
  {
    id: 'protocol-demo-1',
    name: 'Seated knee extension — demonstration protocol',
    side: 'right',
    target_reps: 8,
    target_angle_min_deg: 105,
    target_angle_max_deg: 120,
    hold_duration_seconds: 1,
    instructions:
      'Sit on a stable chair, turn side-on to the camera and straighten the lower leg as you were shown. Move only within the range your physiotherapist set for you.',
    stop_instructions:
      'Stop the session if you feel unsafe or experience concerning discomfort. Follow your clinician’s own instructions.',
    version: 2,
    approved: true,
    camera_view: 'side',
    notes: 'Demo protocol. Numbers are illustrative, not a prescription.',
  },
  {
    id: 'protocol-demo-2',
    name: 'Draft protocol — awaiting clinician approval',
    side: 'left',
    target_reps: 6,
    target_angle_min_deg: 95,
    target_angle_max_deg: 110,
    instructions: 'This draft has not been approved by a clinician.',
    stop_instructions: 'Do not start an unapproved exercise.',
    version: 1,
    approved: false,
    camera_view: 'side',
    notes: 'Draft only — used to exercise the read-only demo-mode state.',
  },
];

export const demoSessions: SessionRecord[] = [
  {
    id: 'session-demo-1',
    protocol_id: 'protocol-demo-1',
    protocol_version: 2,
    started_at: '2026-11-24T09:15:00Z',
    status: 'completed',
    completed_reps: 6,
    usable_frame_pct: 89.5,
    projected_range_deg: 47.2,
    quality_flags: ['CAMERA_SIDE_VIEW_ASSUMED'],
  },
  {
    id: 'session-demo-2',
    protocol_id: 'protocol-demo-1',
    protocol_version: 2,
    started_at: '2026-11-20T09:12:00Z',
    status: 'completed',
    completed_reps: 8,
    usable_frame_pct: 94.1,
    projected_range_deg: 44.6,
    quality_flags: [],
  },
  {
    id: 'session-demo-3',
    protocol_id: 'protocol-demo-1',
    protocol_version: 1,
    started_at: '2026-11-16T09:10:00Z',
    status: 'review_required',
    completed_reps: 4,
    usable_frame_pct: 61.3,
    projected_range_deg: 38.9,
    quality_flags: ['ANKLE_LANDMARK_LOW_CONFIDENCE'],
  },
];

/** Deterministic angle trace; null samples model rejected/low-quality frames. */
export const demoAngleTrace = Array.from({ length: 25 }, (_, i) => {
  const phase = i % 5;
  const usable = i !== 11 && i !== 12;
  return {
    timestamp_ms: i * 500,
    angle_deg: usable ? Math.round((72 + Math.sin((phase / 5) * Math.PI) * 46) * 10) / 10 : null,
    usable,
    rep_count: Math.floor(i / 5),
    state: (phase === 0 ? 'REST' : phase <= 2 ? 'EXTENDING' : 'RETURNING') as
      'REST' | 'EXTENDING' | 'RETURNING',
  };
});

/** A second, earlier trace for the compare mode — illustrative, not real data. */
export const demoCompareTrace = demoAngleTrace.map((sample, index) => ({
  ...sample,
  angle_deg:
    sample.angle_deg === null
      ? null
      : Math.round((sample.angle_deg - (index % 7 === 3 ? 6 : 2)) * 10) / 10,
  rep_count: sample.rep_count,
}));

export const demoMeasurements: MeasurementEvent[] = demoAngleTrace
  .filter((sample) => sample.usable)
  .map((sample, index) => ({
    type: 'measurement',
    sequence: index + 1,
    timestamp_ms: sample.timestamp_ms,
    projected_knee_angle_deg: sample.angle_deg ?? 0,
    rep_count: sample.rep_count,
    state: sample.state,
    quality: { usable: true, reason: null, confidence: 0.88 + (index % 4) * 0.02 },
    model_version: 'fixture-simulated',
    simulated: true,
  }));

export const demoWarnings: QualityWarningEvent[] = [
  {
    type: 'quality_warning',
    sequence: 12,
    reason: 'ANKLE_LANDMARK_LOW_CONFIDENCE',
    message: 'Move until the full lower leg is visible.',
    rep_count: 2,
    simulated: true,
  },
];

export const demoSessionDetail: SessionDetail = {
  session_id: 'session-demo-1',
  protocol_id: 'protocol-demo-1',
  protocol_version: 2,
  model_version: 'fixture-simulated',
  keypoint_mapping_version: 'fixture-knee-map',
  analytics_version: 'fixture-engine-0.1.0',
  status: 'completed',
  metrics: {
    completed_reps: 6,
    target_reps: 8,
    projected_knee_angle_min_deg: 71.2,
    projected_knee_angle_max_deg: 118.4,
    projected_range_deg: 47.2,
    target_range_hit_count: 5,
    median_rep_duration_seconds: 4.8,
    usable_frame_pct: 89.5,
  },
  quality_flags: ['CAMERA_SIDE_VIEW_ASSUMED'],
  raw_video_stored: false,
  angle_trace: demoAngleTrace,
  events: [...demoMeasurements.slice(0, 6), ...demoWarnings],
  simulated: true,
};

export const demoSummary: SummaryPayload = {
  headline: 'Session measurements recorded',
  what_was_measured:
    'The application measured projected knee movement and counted completed repetitions.',
  observed_values: [
    '6 of 8 configured repetitions were counted.',
    'The projected angle range recorded was 71.2 to 118.4 degrees.',
  ],
  data_quality_note: '89.5% of sampled frames met the configured landmark quality checks.',
  clinician_review_note:
    'The assigned physiotherapist can review this session alongside the patient’s care plan.',
};

/** Deterministic fallback when the language-model summary is unavailable. */
export function deterministicSummary(session: SessionDetail): SummaryPayload {
  const m = session.metrics;
  return {
    headline: 'Session measurements recorded',
    what_was_measured:
      'The application recorded projected knee movement and counted defined repetitions.',
    observed_values: [
      `${m.completed_reps} of ${m.target_reps} configured repetitions were counted.`,
      `The projected angle range recorded was ${m.projected_knee_angle_min_deg} to ${m.projected_knee_angle_max_deg} degrees.`,
    ],
    data_quality_note: `${m.usable_frame_pct}% of sampled frames met the configured landmark quality checks.`,
    clinician_review_note: 'The assigned physiotherapist can review these recorded measurements.',
  };
}

export interface DemoPatient {
  id: string;
  display_name: string;
  protocol_name: string;
  sessions: SessionRecord[];
}

export const demoPatients: DemoPatient[] = [
  {
    id: 'patient-demo-1',
    display_name: 'Demo patient A',
    protocol_name: demoProtocols[0].name,
    sessions: demoSessions,
  },
  {
    id: 'patient-demo-2',
    display_name: 'Demo patient B',
    protocol_name: 'Seated knee extension — earlier version',
    sessions: [
      {
        ...demoSessions[1],
        id: 'session-demo-4',
        completed_reps: 7,
        usable_frame_pct: 91.2,
      },
    ],
  },
];
