import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { X } from '@/components/icon';

export interface StackNotification {
  id: string;
  app: string;
  title: string;
  body: string;
  time: string;
  icon?: ReactNode;
}

export interface NotificationListProps {
  notifications?: StackNotification[];
  onDismiss?: (id: string) => void;
  className?: string;
}

const COLLAPSED_COUNT = 2;

/**
 * The notifications panel list. Replaces a vendored swipe-to-dismiss stack:
 * dismissal is an explicit labelled button rather than a drag gesture, which
 * is reachable by keyboard and by anyone who cannot execute a precise swipe,
 * and it keeps the panel usable on a desktop pointer too.
 */
export function NotificationList({
  notifications = [],
  onDismiss,
  className,
}: NotificationListProps) {
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState<string[]>([]);

  const live = notifications.filter((item) => !dismissed.includes(item.id));
  const shown = expanded ? live : live.slice(0, COLLAPSED_COUNT);
  const hidden = live.length - shown.length;

  function dismiss(id: string) {
    setDismissed((previous) => (previous.includes(id) ? previous : [...previous, id]));
    onDismiss?.(id);
  }

  if (!live.length) {
    return (
      <p className={cn('m-0 py-6 text-center text-sm text-[var(--muted-foreground)]', className)}>
        No notifications.
      </p>
    );
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {shown.map((item) => (
          <li
            key={item.id}
            className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3"
          >
            {item.icon}
            <div className="min-w-0 flex-1">
              <p className="m-0 flex items-baseline gap-2">
                <span className="truncate text-sm font-semibold">{item.title}</span>
                <span className="ml-auto shrink-0 text-[11px] tabular-nums text-[var(--muted-foreground)]">
                  {item.time}
                </span>
              </p>
              <p className="m-0 mt-0.5 text-xs leading-relaxed text-[var(--muted-foreground)]">
                {item.body}
              </p>
            </div>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              aria-label={`Dismiss notification: ${item.title}`}
              className="icon-btn-flush flex size-7 shrink-0 items-center justify-center rounded-md border-0 bg-transparent text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
            >
              <X className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>

      {live.length > COLLAPSED_COUNT ? (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
          className="self-start rounded-md border-0 bg-transparent px-2 py-1 text-xs font-semibold text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          {expanded ? 'Show less' : `Show all (${hidden} more)`}
        </button>
      ) : null}
    </div>
  );
}
