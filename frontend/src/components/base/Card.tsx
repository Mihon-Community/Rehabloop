import * as React from 'react';
import { cn } from '@/lib/utils';
import { pickVariants, type VariantProps } from './variants';

/* Clinical card surfaces. `triage` draws the coloured spine down the leading
   edge of a patient file; it is a visual echo of a status the caller is
   already stating in words, never the only place a severity appears. */
const VARIANTS = {
  surface: {
    default: '',
    /** Faint ECG-paper grid, for panels whose subject is a measurement. */
    paper: 'card-chart-paper',
  },
  triage: {
    none: '',
    stable: 'card-triage card-triage-stable',
    caution: 'card-triage card-triage-caution',
    critical: 'card-triage card-triage-critical',
  },
} as const;

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof VARIANTS> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, surface, triage, ...props }, ref) => (
    <div
      ref={ref}
      className={pickVariants(
        'card',
        VARIANTS,
        { surface, triage },
        { surface: 'default', triage: 'none' },
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = 'Card';

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Adds the chart-section rule beneath the heading. */
  divided?: boolean;
}

const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, divided = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(divided ? 'card-chart-head' : 'flex flex-col space-y-1.5', className)}
      {...props}
    />
  ),
);
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn('text-base font-semibold leading-snug tracking-tight', className)}
      {...props}
    />
  ),
);
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
));
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn('pt-4', className)} {...props} />,
);
CardContent.displayName = 'CardContent';

export { Card, CardHeader, CardTitle, CardDescription, CardContent };
