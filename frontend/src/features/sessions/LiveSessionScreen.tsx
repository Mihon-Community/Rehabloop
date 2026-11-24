import { ScreenPlaceholder } from '../../components/ScreenPlaceholder';

export function LiveSessionScreen() {
  return (
    <ScreenPlaceholder
      title="5. Live session"
      purpose="Camera view with pose overlay, repetition count, current projected knee-angle estimate, quality indicator and pause/resume/end controls. Hide overlay supported."
      dataSource="WS /api/v1/sessions/{id}/stream (or labelled mock events)"
      states={['camera denied', 'vision service unavailable', 'paused', 'low quality']}
    >
      <p className="meta">
        Build against <code>mockEventStream()</code> from <code>lib/mocks</code> first; every event
        is labelled simulated. Swap to <code>sessionStreamUrl()</code> for real data. Frame sampling
        target: VITE_FRAME_SAMPLE_RATE (5-10 fps).
      </p>
    </ScreenPlaceholder>
  );
}
