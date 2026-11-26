import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';

export function StatusPill({
  tone,
  children,
}: {
  tone: 'good' | 'warn' | 'bad' | 'neutral';
  children: ReactNode;
}) {
  const variant = {
    good: 'success',
    warn: 'warning',
    bad: 'danger',
    neutral: 'outline',
  } as const;
  const icons = { good: '✓', warn: '!', bad: '✕', neutral: '•' } as const;
  return (
    <Badge variant={variant[tone]}>
      <span aria-hidden="true">{icons[tone]}</span> {children}
    </Badge>
  );
}
