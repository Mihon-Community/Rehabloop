import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  Activity,
  Box,
  ClipboardList,
  FileText,
  HeartPulse,
  Home,
  type IconComponent,
  Settings,
  Stethoscope,
  Video,
  X,
} from '@/components/icon';

interface NavItem {
  to: string;
  label: string;
  icon: IconComponent;
}

/* Grouped the way a care team talks about the work — who the patient is, the
   capture itself, the clinical record, then recovery — rather than by the
   screens' technical names. */
const groups: { name: string; items: NavItem[] }[] = [
  {
    name: 'Patient',
    items: [
      { to: '/', label: 'Overview', icon: Home },
      { to: '/home', label: 'Patient home', icon: Activity },
    ],
  },
  {
    name: 'Session capture',
    items: [
      { to: '/setup', label: 'Camera setup', icon: Video },
      { to: '/sessions/session-demo-1/live', label: 'Live session', icon: Activity },
      { to: '/sessions/session-demo-1/result', label: 'Result', icon: FileText },
    ],
  },
  {
    name: 'Clinical record',
    items: [
      { to: '/protocols/protocol-demo-1', label: 'Protocol', icon: ClipboardList },
      { to: '/clinician', label: 'Clinician', icon: Stethoscope },
    ],
  },
  {
    name: 'Recovery',
    items: [{ to: '/twin', label: 'Recovery Twin', icon: Box }],
  },
  {
    name: 'Preferences',
    items: [{ to: '/settings', label: 'Settings', icon: Settings }],
  },
];

interface SidebarProps {
  onNavigate?: () => void;
  onClose?: () => void;
}

export function Sidebar({ onNavigate, onClose }: SidebarProps) {
  return (
    <div className="sidebar-shell relative flex h-full flex-col bg-[var(--sidebar)] text-[var(--sidebar-foreground)]">
      <div className="sidebar-glow" aria-hidden="true" />
      <div className="relative flex h-16 shrink-0 items-center gap-3 border-b border-[var(--sidebar-border)] px-5">
        <span className="sidebar-logo-badge flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--sidebar-primary)] text-[var(--sidebar)]">
          <HeartPulse className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold tracking-tight">RehabLoop</p>
          <p className="truncate text-[11px] text-[var(--sidebar-foreground)] opacity-70">
            Movement intelligence · prototype
          </p>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation menu"
            className="sidebar-action icon-btn-flush flex size-10 shrink-0 items-center justify-center rounded-md border-transparent bg-transparent text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-foreground)]"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <nav aria-label="Screens" className="flex-1 space-y-5 overflow-y-auto px-3 py-5">
        {groups.map((group) => (
          <div key={group.name}>
            <p className="sidebar-group-label">{group.name}</p>
            <ul className="space-y-1">
              {group.items.map(({ to, label, icon: Icon }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={to === '/'}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        /* py-3 keeps every row a 44px touch target, which
                           matters most in the mobile drawer. */
                        'app-sidebar-link flex min-h-11 items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-[var(--sidebar-accent)] text-[var(--sidebar-foreground)]'
                          : 'opacity-75 hover:bg-[var(--sidebar-accent)] hover:opacity-100',
                      )
                    }
                  >
                    <Icon className="size-[18px] shrink-0" aria-hidden="true" />
                    <span className="truncate">{label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Standing mode indicator, the sidebar's equivalent of the mode light on
          a monitor: it restates that nothing here is real patient data, on
          every screen, without competing with the safety banner's full text. */}
      <div className="shrink-0">
        <svg
          className="ecg-rule block h-2.5 w-full px-3 text-[var(--sidebar-primary)]"
          viewBox="0 0 240 10"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M0 5h88l5-4 4 8 5-8 4 4h130" />
        </svg>
        <div className="sidebar-status">
          <span className="sidebar-status-dot" aria-hidden="true" />
          <p className="sidebar-status-text">
            Demo mode · fixture data only
            <br />
            No patient-identifiable information
          </p>
        </div>
      </div>
    </div>
  );
}
