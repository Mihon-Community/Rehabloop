import { SIMULATED_LABEL } from '@/lib/mocks/fixtures';
import type { DataSource } from '@/types';
import { Badge } from '@/components/base';

/** Every screen backed by fixtures must render this badge. */
export function SimulatedBadge({ source }: { source: DataSource }) {
  if (source === 'live') return null;
  return (
    <Badge variant="simulated" role="status" title={SIMULATED_LABEL}>
      SIMULATED
    </Badge>
  );
}
