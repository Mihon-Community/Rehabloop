import * as React from 'react';
import { cn } from '@/lib/utils';
import { pickVariants, type VariantProps } from './variants';

const BASE = 'relative flex gap-3 rounded-xl border p-4 text-sm';

const VARIANTS = {
  variant: {
    info: 'border-[var(--border)] border-l-[var(--primary)] bg-[var(--info-soft)] text-[var(--foreground)]',
    success:
      'border-[var(--border)] border-l-[var(--success)] bg-[var(--success-soft)] text-[var(--foreground)]',
    warning:
      'border-[var(--border)] border-l-[var(--warning)] bg-[var(--warning-soft)] text-[var(--foreground)]',
    destructive:
      'border-[var(--border)] border-l-[var(--danger)] bg-[var(--danger-soft)] text-[var(--foreground)]',
    neutral: 'border-[var(--border)] bg-[var(--muted-bg)] text-[var(--foreground)]',
  },
} as const;

/* The icon carries the variant's own tone. It used to be hard-coded
   text-primary, so a destructive alert showed a teal icon and every call site
   re-tinted it by hand. */
const ICON_TONE = {
  info: 'text-[var(--primary)]',
  success: 'text-[var(--success)]',
  warning: 'text-[var(--warning)]',
  destructive: 'text-[var(--danger)]',
  neutral: 'text-[var(--muted-foreground)]',
} as const;

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof VARIANTS> {
  icon?: React.ReactNode;
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant, icon, children, ...props }, ref) => (
    <div
      ref={ref}
      role={variant === 'destructive' ? 'alert' : 'status'}
      className={pickVariants(BASE, VARIANTS, { variant }, { variant: 'info' }, className)}
      {...props}
    >
      {icon ? (
        <span className={cn('mt-0.5 shrink-0', ICON_TONE[variant ?? 'info'])}>{icon}</span>
      ) : null}
      <div className="min-w-0 space-y-1">{children}</div>
    </div>
  ),
);
Alert.displayName = 'Alert';

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('font-semibold leading-snug', className)} {...props} />
));
AlertTitle.displayName = 'AlertTitle';

const AlertDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('text-sm leading-relaxed text-muted-foreground', className)}
      {...props}
    />
  ),
);
AlertDescription.displayName = 'AlertDescription';

export { Alert, AlertTitle, AlertDescription };
