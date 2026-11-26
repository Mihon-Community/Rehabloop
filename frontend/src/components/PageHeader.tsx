import type { ReactNode } from 'react';

/** Shared page heading for dashboard screens: context first, actions on the right. */
export function PageHeader({
  eyebrow,
  title,
  description,
  icon,
  badge,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3">
        {icon ? <span className="icon-chip icon-chip-lg mt-0.5">{icon}</span> : null}
        <div className="min-w-0">
          <p className="section-kicker">{eyebrow}</p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-[1.75rem]">{title}</h1>
          <p className="screen-intro mb-0">{description}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {badge}
        {actions}
      </div>
    </header>
  );
}
