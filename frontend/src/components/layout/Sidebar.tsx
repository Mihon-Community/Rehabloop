import { NavLink } from 'react-router-dom';
import {
  Activity,
  Box,
  ClipboardList,
  FileText,
  Home,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  Stethoscope,
  Video,
  X,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

const groups: { name: string; items: NavItem[] }[] = [
  {
    name: 'Overview',
    items: [
      { to: '/', label: 'Overview', icon: Home },
      { to: '/home', label: 'Patient home', icon: Activity },
    ],
  },
  {
    name: 'Sessions',
    items: [
      { to: '/setup', label: 'Camera setup', icon: Video },
      { to: '/sessions/session-demo-1/live', label: 'Live session', icon: Activity },
      { to: '/sessions/session-demo-1/result', label: 'Result', icon: FileText },
    ],
  },
  {
    name: 'Clinical',
    items: [
      { to: '/protocols/protocol-demo-1', label: 'Protocol', icon: ClipboardList },
      { to: '/clinician', label: 'Clinician', icon: Stethoscope },
    ],
  },
  {
    name: 'Recovery',
    items: [{ to: '/twin', label: 'Recovery Twin', icon: Box }],
  },
];

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
  onNavigate?: () => void;
  onClose?: () => void;
}

export function Sidebar({ collapsed = false, onToggle, onNavigate, onClose }: SidebarProps) {
  return (
    <div className="sidebar-shell relative flex h-full flex-col bg-[var(--sidebar)] text-[var(--sidebar-foreground)]">
      {onToggle ? (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="sidebar-collapse-toggle absolute -right-3 top-[52px] z-10 flex size-7 items-center justify-center rounded-full border border-[var(--sidebar-border)] bg-[var(--card)] text-[var(--muted-foreground)] shadow-[var(--card-shadow)]"
        >
          {collapsed ? (
            <PanelLeftOpen className="size-3.5" aria-hidden="true" />
          ) : (
            <PanelLeftClose className="size-3.5" aria-hidden="true" />
          )}
        </button>
      ) : null}
      <div className="sidebar-glow" aria-hidden="true" />
      <div
        className={cn(
          'relative flex h-16 shrink-0 items-center gap-3 border-b border-[var(--sidebar-border)] px-5',
          collapsed && 'justify-center px-0',
        )}
      >
        <span className="sidebar-logo-badge flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--sidebar-primary)] text-[var(--sidebar)]">
          <Sparkles className="size-5" aria-hidden="true" />
        </span>
        {!collapsed ? (
          <>
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
                className="sidebar-action rounded-md p-1.5 hover:bg-[var(--sidebar-accent)]"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            ) : null}
          </>
        ) : null}
      </div>

      <nav aria-label="Screens" className="flex-1 space-y-5 overflow-y-auto px-3 py-5">
        {groups.map((group) => (
          <div key={group.name}>
            {!collapsed ? (
              <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-widest opacity-60">
                {group.name}
              </p>
            ) : (
              <div
                className="mx-3 mb-3 border-t border-[var(--sidebar-border)]"
                aria-hidden="true"
              />
            )}
            <ul className="space-y-1">
              {group.items.map(({ to, label, icon: Icon }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={to === '/'}
                    title={collapsed ? label : undefined}
                    aria-label={collapsed ? label : undefined}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        'app-sidebar-link flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                        collapsed && 'justify-center px-0',
                        isActive
                          ? 'bg-[var(--sidebar-accent)] text-[var(--sidebar-foreground)]'
                          : 'opacity-75 hover:bg-[var(--sidebar-accent)] hover:opacity-100',
                      )
                    }
                  >
                    <Icon className="size-[18px] shrink-0" aria-hidden="true" />
                    {!collapsed ? <span className="truncate">{label}</span> : null}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  );
}
