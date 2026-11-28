import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Activity, Box, Home, type IconComponent, Menu, Video } from '@/components/icon';

interface Tab {
  to: string;
  label: string;
  icon: IconComponent;
  end?: boolean;
}

/* The four destinations a patient moves between during a session, in the order
   they meet them. Everything else stays one tap away behind "More", which
   opens the same drawer the topbar's menu button does. */
const tabs: Tab[] = [
  { to: '/', label: 'Overview', icon: Home, end: true },
  { to: '/home', label: 'My plan', icon: Activity },
  { to: '/setup', label: 'Capture', icon: Video },
  { to: '/twin', label: 'Twin', icon: Box },
];

/**
 * Thumb-reachable navigation for phones and small tablets, where the sidebar
 * is collapsed into a drawer. Hidden from `lg` up, so it never duplicates the
 * permanent sidebar.
 */
export function MobileNav({
  onMoreClick,
  menuOpen,
}: {
  onMoreClick: () => void;
  menuOpen: boolean;
}) {
  return (
    <nav
      aria-label="Primary"
      className="mobile-nav fixed inset-x-0 bottom-0 z-30 flex items-stretch lg:hidden"
    >
      {tabs.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} className="mobile-nav-link">
          {({ isActive }) => (
            <>
              <span className={cn('mobile-nav-icon', isActive && 'is-active')}>
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="mobile-nav-label">{label}</span>
            </>
          )}
        </NavLink>
      ))}
      <button
        type="button"
        onClick={onMoreClick}
        aria-expanded={menuOpen}
        aria-controls={menuOpen ? 'app-sidebar-drawer' : undefined}
        className="mobile-nav-link mobile-nav-more"
      >
        <span className="mobile-nav-icon">
          <Menu className="size-5" aria-hidden="true" />
        </span>
        <span className="mobile-nav-label">More</span>
      </button>
    </nav>
  );
}
