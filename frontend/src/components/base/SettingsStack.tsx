import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ArrowRight, Check, ChevronDown } from '@/components/icon';

export interface StackRow {
  id: string;
  label: string;
  /** Secondary line under the label (current value, description). */
  detail?: string;
  /** Icon or chip before the label, matching the panel heads elsewhere. */
  leading?: ReactNode;
  /** Key of another page in `pages` — turns the row into a drill-down. */
  to?: string;
  trailing?: ReactNode;
  onSelect?: () => void;
  /** One-of-many selection within its section (renders a radio group). */
  selected?: boolean;
  /** On/off state (renders a switch). */
  checked?: boolean;
  tone?: 'default' | 'danger';
}

export interface StackSection {
  title?: string;
  rows: StackRow[];
  footer?: string;
}

export interface StackPage {
  title: string;
  sections: StackSection[];
}

export interface SettingsStackProps {
  pages: Record<string, StackPage>;
  root: string;
  className?: string;
}

const ROW =
  'flex w-full items-center gap-3 border-0 bg-transparent px-4 py-3 text-left text-sm transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)]';

function Row({ row, onOpen }: { row: StackRow; onOpen: (key: string) => void }) {
  const danger = row.tone === 'danger';
  /* The detail line is described, not named: folded into the accessible name
     it turned "Camera mode" into "Camera mode Off — saved reports only", which
     is a poor thing to hear on a switch. */
  const detailId = row.detail ? `${row.id}-detail` : undefined;

  /* The role follows what the row actually does, so a screen reader announces
     "selected"/"on" rather than just "button": one-of-many rows form a radio
     group, an on/off row is a switch, and a drill-down stays a button. */
  const role =
    row.selected !== undefined ? 'radio' : row.checked !== undefined ? 'switch' : undefined;
  const checkedState = row.selected !== undefined ? row.selected : row.checked;

  return (
    <button
      type="button"
      role={role}
      aria-checked={role ? Boolean(checkedState) : undefined}
      aria-describedby={detailId}
      onClick={() => (row.to ? onOpen(row.to) : row.onSelect?.())}
      className={cn(
        ROW,
        danger && 'font-semibold text-[var(--danger)] hover:bg-[var(--danger-soft)]',
      )}
    >
      {row.leading}

      <span className="min-w-0 flex-1">
        <span className={cn('block font-semibold', danger && 'text-[var(--danger)]')}>
          {row.label}
        </span>
        {row.detail ? (
          <span id={detailId} className="mt-0.5 block text-xs text-[var(--muted-foreground)]">
            {row.detail}
          </span>
        ) : null}
      </span>

      {row.trailing}

      {row.checked !== undefined ? (
        <span
          className={cn(
            'relative h-5 w-9 shrink-0 rounded-full transition-colors',
            row.checked ? 'bg-[var(--primary)]' : 'bg-[var(--input)]',
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 size-4 rounded-full bg-white transition-all',
              row.checked ? 'left-[1.125rem]' : 'left-0.5',
            )}
          />
        </span>
      ) : null}

      {row.selected ? <Check className="size-4 shrink-0 text-[var(--primary)]" /> : null}

      {row.to ? <ArrowRight className="size-4 shrink-0 text-[var(--muted-foreground)]" /> : null}
    </button>
  );
}

/**
 * Drill-down preference list: a page of titled sections, each a list of rows,
 * where a row can navigate to another page. Replaces a vendored stacked-panel
 * component — the same shape and the same props, built from project styles.
 */
export function SettingsStack({ pages, root, className }: SettingsStackProps) {
  const [trail, setTrail] = useState<string[]>([root]);
  const key = trail[trail.length - 1];
  const page = pages[key] ?? pages[root];
  const canGoBack = trail.length > 1;

  return (
    <div className={cn('card p-0', className)}>
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
        {canGoBack ? (
          <button
            type="button"
            onClick={() => setTrail((t) => t.slice(0, -1))}
            aria-label={`Back to ${pages[trail[trail.length - 2]]?.title ?? 'previous page'}`}
            className="icon-btn-flush flex size-8 shrink-0 items-center justify-center rounded-md border-0 bg-transparent text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
          >
            {/* The chevron is rotated rather than given its own icon, so back
                and expand stay visibly the same control at different angles. */}
            <ChevronDown className="size-4 rotate-90" />
          </button>
        ) : null}
        <h2 className="m-0 text-base font-bold tracking-tight">{page.title}</h2>
      </div>

      {page.sections.map((section, index) => {
        const isRadioGroup = section.rows.some((row) => row.selected !== undefined);
        return (
          <section
            key={section.title ?? `section-${index}`}
            className="border-b border-[var(--border)] last:border-b-0"
          >
            {section.title ? (
              <h3 className="m-0 px-4 pb-1 pt-4 text-[11px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
                {section.title}
              </h3>
            ) : null}
            <div
              role={isRadioGroup ? 'radiogroup' : undefined}
              aria-label={isRadioGroup ? section.title : undefined}
              className="divide-y divide-[var(--border)]"
            >
              {section.rows.map((row) => (
                <Row key={row.id} row={row} onOpen={(next) => setTrail((t) => [...t, next])} />
              ))}
            </div>
            {section.footer ? (
              <p className="m-0 px-4 pb-4 pt-2 text-xs leading-relaxed text-[var(--muted-foreground)]">
                {section.footer}
              </p>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
