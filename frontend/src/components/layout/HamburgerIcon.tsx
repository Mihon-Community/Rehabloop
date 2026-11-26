import { cn } from '@/lib/utils';

/**
 * Three bars that morph into an X via CSS (see .hamburger in index.css),
 * driven only by the `open` prop — no animation library needed. Colour comes
 * from the host button's text colour (currentColor), and the whole thing is
 * aria-hidden since the button it sits in already carries the real label.
 */
export function HamburgerIcon({ open }: { open: boolean }) {
  return (
    <span className={cn('hamburger', open && 'is-open')} aria-hidden="true">
      <span className="hamburger-line" />
      <span className="hamburger-line" />
      <span className="hamburger-line" />
    </span>
  );
}
