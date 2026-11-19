import { useEffect, useRef, useState, type DependencyList } from "react";

export type AsyncResource<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
};

/**
 * Controller helper: cancellable one-shot async load for View pages
 * (transparency, catalog, fixtures). Pass stable deps; the latest `loader`
 * is always invoked.
 */
export function useAsyncResource<T>(
  loader: () => Promise<T>,
  deps: DependencyList = [],
): AsyncResource<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void loaderRef
      .current()
      .then((value) => {
        if (cancelled) return;
        setData(value);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setData(null);
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller-owned deps
  }, deps);

  return { data, error, loading };
}
