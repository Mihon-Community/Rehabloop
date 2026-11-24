import { ScreenPlaceholder } from '../../components/ScreenPlaceholder';

export function SessionResultScreen() {
  return (
    <ScreenPlaceholder
      title="6. Session result"
      purpose="Measured summary, data-quality note, event list and AI explanation of recorded measurements. Display canonical numeric values, never LLM-copied values."
      dataSource="GET /api/v1/sessions/{id} + POST /api/v1/sessions/{id}/summary"
      states={['saved', 'unsaved/retry', 'summary unavailable — deterministic fallback']}
    ></ScreenPlaceholder>
  );
}
