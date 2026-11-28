import * as React from 'react';
import { pickVariants, type VariantProps } from './variants';

const BASE =
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold [&_svg]:size-3 [&_svg]:shrink-0';

const VARIANTS = {
  variant: {
    default: 'border-transparent bg-primary text-primary-foreground',
    secondary: 'border-transparent bg-secondary text-secondary-foreground',
    success: 'border-transparent bg-[var(--success-soft)] text-[var(--success)]',
    warning: 'border-transparent bg-[var(--warning-soft)] text-[var(--warning)]',
    danger: 'border-transparent bg-[var(--danger-soft)] text-[var(--danger)]',
    simulated: 'border-transparent bg-[var(--simulated-bg)] text-[var(--simulated-fg)]',
    outline: 'border-border text-foreground',
    /* Identifiers (session and protocol references) read as transcribed record
       numbers: squared off, monospaced and tabular so digits line up and a
       misread character is obvious. */
    record:
      'rounded-md border-border bg-[var(--muted-bg)] font-mono text-[11px] font-medium tabular-nums tracking-tight text-[var(--muted-foreground)]',
  },
} as const;

export type BadgeVariant = keyof typeof VARIANTS.variant;

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof VARIANTS> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span
      className={pickVariants(BASE, VARIANTS, { variant }, { variant: 'default' }, className)}
      {...props}
    />
  );
}

export { Badge };
