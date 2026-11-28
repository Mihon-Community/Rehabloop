import * as React from 'react';
import { cn } from '@/lib/utils';
import { pickVariants, type VariantProps } from './variants';

/* No `whitespace-nowrap`, and min-heights rather than fixed heights: several
   labels here are full sentences ("Enable camera mode (consent still required
   at setup)"), which a nowrap button forced wider than a phone viewport. They
   wrap and the button grows instead. */
const BASE =
  'inline-flex items-center justify-center gap-2 rounded-[9px] text-center text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-55 [&_svg]:size-4 [&_svg]:shrink-0';

const VARIANTS = {
  /* Every variant states its own border and background rather than inheriting
     part of the global `button` baseline, so a Button looks the same whether
     it renders as <button> or, via asChild, as an <a>. */
  variant: {
    default:
      'border border-primary bg-primary text-primary-foreground shadow-sm hover:bg-[var(--primary-hover)] hover:border-[var(--primary-hover)]',
    outline:
      'border border-input bg-card text-foreground hover:border-primary hover:bg-accent hover:text-accent-foreground',
    secondary: 'border border-transparent bg-secondary text-secondary-foreground hover:bg-muted',
    ghost:
      'border border-transparent bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground',
    link: 'border border-transparent bg-transparent text-primary underline-offset-4 hover:underline',
    /* Clinical tones. Confirming and flagging are tinted, so a row of them
       reads as a set of peer choices; `critical` is filled because it marks
       the one irreversible act on a screen. Each is always paired with its own
       text label — tone is never the only signal. */
    confirm:
      'border border-[color-mix(in_srgb,var(--success)_45%,var(--border))] bg-[var(--success-soft)] text-[var(--success)] hover:border-[var(--success)] hover:bg-[color-mix(in_srgb,var(--success-soft)_80%,var(--success))]',
    caution:
      'border border-[color-mix(in_srgb,var(--warning)_45%,var(--border))] bg-[var(--warning-soft)] text-[var(--warning)] hover:border-[var(--warning)] hover:bg-[color-mix(in_srgb,var(--warning-soft)_80%,var(--warning))]',
    critical:
      'border border-destructive bg-destructive text-destructive-foreground shadow-sm hover:bg-[color-mix(in_srgb,var(--destructive)_85%,black)]',
  },
  /* The pointer-coarse bumps take every button to the 44px touch floor on a
     touchscreen while keeping desktop density at 40/36px — raising the base
     sizes instead would have loosened every toolbar on a mouse-driven
     machine. */
  size: {
    default: 'min-h-10 px-4 py-2 pointer-coarse:min-h-11',
    sm: 'min-h-9 rounded-lg px-3 py-1.5 text-xs pointer-coarse:min-h-11',
    lg: 'min-h-11 rounded-lg px-6 py-2.5',
    /* Fixed square, and p-0 so the baseline's horizontal padding can't push a
       16px icon wider than the box it sits in. */
    icon: 'size-9 shrink-0 p-0 pointer-coarse:size-11',
  },
} as const;

export type ButtonVariant = keyof typeof VARIANTS.variant;
export type ButtonSize = keyof typeof VARIANTS.size;

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof VARIANTS> {
  /**
   * Renders the single child element with the button's classes instead of a
   * <button>, for links that should look like buttons. Replaces the Radix Slot
   * this project used to depend on: the one thing it was used for here was
   * merging className onto a react-router <Link>.
   */
  asChild?: boolean;
}

export function buttonClasses(
  options: VariantProps<typeof VARIANTS> & { className?: string } = {},
): string {
  const { className, ...variants } = options;
  return pickVariants(BASE, VARIANTS, variants, { variant: 'default', size: 'default' }, className);
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, children, ...props }, ref) => {
    const classes = buttonClasses({ variant, size, className });

    if (asChild) {
      const child = React.Children.only(children) as React.ReactElement<{ className?: string }>;
      return React.cloneElement(child, {
        ...props,
        // The child wins on every prop except the class list, which is merged
        // so the child's own utilities can still override the variant's.
        ...child.props,
        className: cn(classes, child.props.className),
        ref,
      } as React.Attributes & { className: string });
    }

    return (
      <button ref={ref} className={classes} {...props}>
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';

export { Button };
