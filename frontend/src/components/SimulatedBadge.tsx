import { Badge } from '@/components/ui/badge';
import { SIMULATED_LABEL } from '@/lib/mocks/fixtures';
import type { DataSource } from '@/types';

/** Every screen backed by fixtures must render this badge. */
export function SimulatedBadge({ source }: { source: DataSource }) {
  if (source === 'live') return null;
  return (
    <Badge variant="simulated" role="status" title={SIMULATED_LABEL}>
      SIMULATED
    </Badge>
  );
}
