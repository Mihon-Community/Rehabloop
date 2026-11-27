import { useCallback, useEffect, useState, type DependencyList } from 'react';
import type { DataResult, DataSource } from '../types';

export interface AsyncState<T> {
  status: 'loading' | 'ready' | 'error';
  data?: T;
  source?: DataSource;
  error?: string;
}

/** Minimal async loader that keeps loading / empty / error explicit in the UI. */
export function useAsync<T>(loader: () => Promise<DataResult<T>>, deps: DependencyList = []) {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' });

  // The caller owns the dependency list; the loader itself is intentionally not
  // a dependency so inline arrow loaders don't restart the request every render.
  const reload = useCallback(() => {
    setState({ status: 'loading' });
    loader()
      .then((result) => setState({ status: 'ready', data: result.data, source: result.source }))
      .catch((error: unknown) =>
        setState({
          status: 'error',
          error: error instanceof Error ? error.message : 'Could not load this data',
        }),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    reload();
  }, [reload]);

  return { ...state, reload };
}
