import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { SafetyBanner } from '@/components/SafetyBanner';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { cn } from '@/lib/utils';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

/** Responsive shell: permanent desktop sidebar, drawer + hamburger below lg. */
export function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { pathname } = useLocation();
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useFocusTrap(drawerOpen, drawerRef, () => setDrawerOpen(false));

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      <aside
        id="app-sidebar"
        className={cn(
          'fixed inset-y-0 left-0 z-40 hidden border-r border-[var(--sidebar-border)] lg:block',
          collapsed ? 'w-[76px]' : 'w-[264px]',
        )}
      >
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} />
      </aside>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setDrawerOpen(false)}
            className="drawer-backdrop absolute inset-0 size-full bg-black/50"
          />
          <div
            id="app-sidebar-drawer"
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            tabIndex={-1}
            className="drawer-panel absolute inset-y-0 left-0 w-[min(280px,85vw)] border-r border-[var(--sidebar-border)] shadow-2xl"
          >
            <Sidebar onNavigate={() => setDrawerOpen(false)} onClose={() => setDrawerOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className={cn('min-h-screen', collapsed ? 'lg:pl-[76px]' : 'lg:pl-[264px]')}>
        <Topbar onMenuClick={() => setDrawerOpen(true)} menuOpen={drawerOpen} />

        <div className="mx-auto w-full max-w-[1180px] px-4 py-6 sm:px-6">
          <SafetyBanner />
          <main id="main-content">
            <div key={pathname} className="page-enter">
              <Outlet />
            </div>
          </main>
          <footer className="app-footer meta">
            Prototype only · Angles are projected 2D estimates · No diagnosis, treatment advice or
            autonomous plan changes · Raw video is not stored by default
          </footer>
        </div>
      </div>
    </div>
  );
}
