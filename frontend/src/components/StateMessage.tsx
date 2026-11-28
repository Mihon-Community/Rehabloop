import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, LoaderCircle } from '@/components/icon';
import { Alert, AlertDescription, AlertTitle } from '@/components/base';

interface Props {
  kind: 'loading' | 'empty' | 'error' | 'success';
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}

/** Shared loading / empty / error panel with a visible status icon, not colour alone. */
export function StateMessage({ kind, title, children, action }: Props) {
  const icon =
    kind === 'loading' ? (
      <LoaderCircle className="size-5 animate-spin" />
    ) : kind === 'error' ? (
      <AlertCircle className="size-5" />
    ) : kind === 'success' ? (
      <CheckCircle2 className="size-5" />
    ) : (
      <CheckCircle2 className="size-5 opacity-60" />
    );

  return (
    <Alert
      variant={kind === 'error' ? 'destructive' : kind === 'empty' ? 'neutral' : 'info'}
      icon={icon}
      className={`state-message state-${kind === 'success' ? 'loading' : kind}`}
    >
      <AlertTitle>{title}</AlertTitle>
      {children ? <AlertDescription>{children}</AlertDescription> : null}
      {action ? <div className="pt-1">{action}</div> : null}
    </Alert>
  );
}
