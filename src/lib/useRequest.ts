'use client';

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { friendlyErrorMessage } from './api';

interface Settled<T> {
  /** The loader this result belongs to; a different loader means "stale". */
  load: () => Promise<T>;
  data: T | null;
  error: string | null;
}

export interface Request<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  /** Patch the loaded value in place (after a mutation) without refetching. */
  setData: (update: (current: T) => T) => void;
  /** Run the loader again, replacing the value when it settles. */
  reload: () => Promise<void>;
}

/**
 * Run `load` and store its outcome, unless the caller has moved on. Kept
 * outside the hook so every setState happens in a promise callback, which is
 * what the react-hooks rules want from an effect that talks to a server.
 */
const settle = <T>(
  load: () => Promise<T>,
  fallbackError: string,
  isCancelled: () => boolean,
  setSettled: Dispatch<SetStateAction<Settled<T> | null>>,
): Promise<void> =>
  load().then(
    (data) => {
      if (!isCancelled()) setSettled({ load, data, error: null });
    },
    (err: unknown) => {
      if (!isCancelled()) {
        setSettled({ load, data: null, error: friendlyErrorMessage(err, fallbackError) });
      }
    },
  );

/**
 * Load one value for the lifetime of a memoised loader.
 *
 * `load` must come from `useCallback` keyed on whatever the request depends
 * on (an id, a search term, a status tab): a new loader identity is what
 * starts a new request. "Loading" is derived -- the last settled result is
 * tagged with the loader that produced it, so a result from a previous
 * loader simply does not count -- which keeps every setState inside a
 * callback and none in the effect body itself.
 */
export function useRequest<T>(load: () => Promise<T>, fallbackError: string): Request<T> {
  const [settled, setSettled] = useState<Settled<T> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void settle(load, fallbackError, () => cancelled, setSettled);
    return () => {
      cancelled = true;
    };
  }, [load, fallbackError]);

  const current = settled !== null && settled.load === load ? settled : null;

  const setData = useCallback(
    (update: (value: T) => T) => {
      setSettled((previous) =>
        previous && previous.load === load && previous.data !== null
          ? { ...previous, data: update(previous.data) }
          : previous,
      );
    },
    [load],
  );

  const reload = useCallback(
    () => settle(load, fallbackError, () => false, setSettled),
    [load, fallbackError],
  );

  return {
    data: current?.data ?? null,
    error: current?.error ?? null,
    loading: current === null,
    setData,
    reload,
  };
}
