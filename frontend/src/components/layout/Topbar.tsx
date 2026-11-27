import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, ClipboardCheck, LogOut, Palette, Video } from 'lucide-react';
import { useDemo } from '@/app/demoStore';
import { pageTitle } from '@/app/themes';
import NotificationStack, {
  type StackNotification,
} from '@/components/kokonutui/notification-stack';
import { Badge } from '@/components/ui/badge';
import { signOut } from '@/lib/auth';
import { HamburgerIcon } from './HamburgerIcon';
import { ThemePicker } from './ThemePicker';

const demoNotifications: StackNotification[] = [
  {
    id: 'demo-1',
    app: 'Demo',
    title: 'Example session record',
    body: 'Illustrative notification only — no real patient data.',
    time: 'now',
    icon: (
      <span className="flex size-8 items-center justify-center rounded-lg bg-[var(--accent)] text-[var(--primary)]">
        <ClipboardCheck className="size-4" />
      </span>
    ),
  },
  {
    id: 'demo-2',
    app: 'Demo',
    title: 'Theme preference saved',
    body: 'Your theme choice is stored in this browser.',
    time: '09:50',
    icon: (
      <span className="flex size-8 items-center justify-center rounded-lg bg-[var(--accent)] text-[var(--primary)]">
        <Palette className="size-4" />
      </span>
    ),
  },
  {
    id: 'demo-3',
    app: 'Demo',
    title: 'Camera framing tip',
    body: 'Check that the full leg is visible before starting a session.',
    time: '09:12',
    icon: (
      <span className="flex size-8 items-center justify-center rounded-lg bg-[var(--accent)] text-[var(--primary)]">
        <Video className="size-4" />
      </span>
    ),
  },
];

interface TopbarProps {
  onMenuClick: () => void;
  menuOpen: boolean;
}

export function Topbar({ onMenuClick, menuOpen }: TopbarProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { role, setRole, setCameraMode } = useDemo();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const remainingNotifications = demoNotifications.filter(
    (item) => !dismissedIds.includes(item.id),
  );

  useEffect(() => {
    if (!notificationsOpen) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      if (!notificationsRef.current?.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNotificationsOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [notificationsOpen]);

  async function handleSignOut() {
    try {
      await signOut();
    } catch {
      /* demo mode has no session to clear */
    }
    setRole('patient');
    setCameraMode('review');
    navigate('/');
  }

  return (
    <header className="app-topbar sticky top-0 z-30 flex h-16 items-center gap-3 px-4 sm:px-6">
      <button
        type="button"
        onClick={onMenuClick}
        aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
        aria-expanded={menuOpen}
        aria-controls={menuOpen ? 'app-sidebar-drawer' : 'app-sidebar'}
        className="icon-btn flex size-10 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] icon-btn-flush text-[var(--foreground)] hover:bg-[var(--accent)] lg:hidden"
      >
        <HamburgerIcon open={menuOpen} />
      </button>

      <div className="min-w-0 flex-1">
        <h1 className="flex min-w-0 items-baseline truncate text-sm font-semibold text-[var(--foreground)] sm:text-base">
          <span className="shrink-0">RehabLoop</span>
          <span className="mx-1 shrink-0 opacity-50" aria-hidden="true">
            /
          </span>
          <span className="min-w-0 truncate font-normal text-[var(--muted-foreground)]">
            {pageTitle(pathname)}
          </span>
        </h1>
        <p className="hidden text-xs text-[var(--muted-foreground)] sm:block">
          Clinician-prescribed movement review
        </p>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <Badge variant="outline" className="hidden md:inline-flex" title="Display-only demo role">
          ROLE: {role.toUpperCase()}
        </Badge>
        <Badge
          variant="simulated"
          className="hidden sm:inline-flex"
          title="Fixture mode is never real inference"
        >
          DEMO
        </Badge>

        <div className="topbar-toolbar">
          <div className="relative" ref={notificationsRef}>
            <button
              type="button"
              onClick={() => setNotificationsOpen((value) => !value)}
              aria-label={`Notifications (${remainingNotifications.length} remaining)`}
              aria-expanded={notificationsOpen}
              aria-controls="notifications-panel"
              className="icon-btn relative flex size-9 items-center justify-center rounded-lg border border-transparent icon-btn-flush text-[var(--foreground)]"
            >
              <Bell aria-hidden="true" />
              {remainingNotifications.length ? (
                <span className="notif-badge absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-[var(--destructive)] text-[9px] font-bold text-[var(--destructive-foreground)]">
                  {remainingNotifications.length}
                </span>
              ) : null}
            </button>
            {notificationsOpen ? (
              <div
                id="notifications-panel"
                role="dialog"
                aria-label="Notifications"
                className="fixed left-4 right-4 top-16 z-50 rounded-xl border border-[var(--border)] bg-[var(--popover)] p-4 shadow-xl sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[360px]"
              >
                <NotificationStack
                  notifications={demoNotifications}
                  onDismiss={(id) =>
                    setDismissedIds((previous) =>
                      previous.includes(id) ? previous : [...previous, id],
                    )
                  }
                />
              </div>
            ) : null}
          </div>
          <ThemePicker />
          <span className="topbar-divider" aria-hidden="true" />
          <button
            type="button"
            onClick={handleSignOut}
            aria-label="Sign out and return to landing page"
            title="Sign out / return to landing page"
            className="icon-btn flex size-9 shrink-0 items-center justify-center rounded-lg border border-transparent icon-btn-flush text-[var(--foreground)]"
          >
            <LogOut aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
}
