import type { ReactNode } from 'react';
import { SafetyBanner } from './SafetyBanner';

interface Props {
  title: string;
  purpose: string;
  dataSource: string;
  states?: string[];
  children?: ReactNode;
}

/** Shared shell for the scaffolded screens so each required state is documented. */
export function ScreenPlaceholder({ title, purpose, dataSource, states = [], children }: Props) {
  return (
    <section className="card" aria-labelledby={`${title}-heading`}>
      <h1 id={`${title}-heading`}>{title}</h1>
      <SafetyBanner />
      <p>{purpose}</p>
      <p className="meta">Data source: {dataSource}</p>
      {children}
      <h2>Required states</h2>
      <ul className="state-list">
        {[...states, 'loading', 'empty', 'error'].map((state) => (
          <li key={state}>{state}</li>
        ))}
      </ul>
    </section>
  );
}
