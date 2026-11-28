import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Circle, XCircle } from '@/components/icon';
import { Badge } from '@/components/base';

/* Drawn icons rather than the typographic ✓ / ! / ✕ this used before: the
   glyphs rendered at different weights and baselines across platforms, and a
   shape pinned to each tone means the status survives greyscale printing and
   colour-blind readers. The label itself is always spelled out alongside. */
const tones = {
  good: { variant: 'success', Icon: CheckCircle2 },
  warn: { variant: 'warning', Icon: AlertTriangle },
  bad: { variant: 'danger', Icon: XCircle },
  neutral: { variant: 'outline', Icon: Circle },
} as const;

export function StatusPill({ tone, children }: { tone: keyof typeof tones; children: ReactNode }) {
  const { variant, Icon } = tones[tone];
  return (
    <Badge variant={variant}>
      <Icon aria-hidden="true" />
      {children}
    </Badge>
  );
}
