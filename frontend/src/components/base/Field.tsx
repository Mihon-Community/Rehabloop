import * as React from 'react';
import { cn } from '@/lib/utils';

/* The two text inputs this app uses, sharing one class list so a textarea and
   an input never drift apart. Both are plain elements — nothing here needed a
   component library. */
const FIELD =
  'w-full rounded-lg border border-[var(--input)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:opacity-55';

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => (
    <input type={type} ref={ref} className={cn('flex h-10', FIELD, className)} {...props} />
  ),
);
Input.displayName = 'Input';

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn('flex', FIELD, className)} {...props} />
  ),
);
Textarea.displayName = 'Textarea';

export { Input, Textarea };
