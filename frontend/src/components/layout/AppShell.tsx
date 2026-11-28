import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { SafetyBanner } from '@/components/SafetyBanner';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { MobileNav } from './MobileNav';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

/** Responsive shell: permanent desktop sidebar, drawer + hamburger below lg. */
export function AppShell() {
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
        className="fixed inset-y-0 left-0 z-40 hidden w-[264px] border-r border-[var(--sidebar-border)] lg:block"
      >
        <Sidebar />
      </aside>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setDrawerOpen(false)}
            className="drawer-backdrop absolute inset-0 size-full border-0 bg-black/50"
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

      <div className="min-h-screen lg:pl-[264px]">
        <Topbar onMenuClick={() => setDrawerOpen(true)} menuOpen={drawerOpen} />

        {/* The reading column grows in steps rather than staying pinned at
            1180px, so a 1440 or 2560 display gets wider cards and more
            columns in the auto-fit grids instead of empty gutters. The deep
            bottom padding below lg keeps the footer clear of the mobile tab
            bar, which is fixed over the content. */}
        <div className="mx-auto w-full max-w-[1180px] px-4 pb-28 pt-6 sm:px-6 lg:pb-6 xl:max-w-[1360px] 2xl:max-w-[1600px] 2xl:px-8">
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

      <MobileNav onMoreClick={() => setDrawerOpen(true)} menuOpen={drawerOpen} />
    </div>
  );
}
