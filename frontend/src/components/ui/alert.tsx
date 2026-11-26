import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const alertVariants = cva('relative flex gap-3 rounded-xl border p-4 text-sm', {
  variants: {
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
  },
  defaultVariants: { variant: 'info' },
});

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof alertVariants> {
  icon?: React.ReactNode;
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant, icon, children, ...props }, ref) => (
    <div
      ref={ref}
      role={variant === 'destructive' ? 'alert' : 'status'}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      {icon ? <span className="mt-0.5 shrink-0 text-primary">{icon}</span> : null}
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
