'use client';

import { useCallback, useState } from 'react';
import { getErrorMessage } from '../utils/errorHelpers';

// Wraps a Convex mutation call with pending + error state so every
// button and form handles failures the same way.
export const useRunMutation = () => {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async <T>(fn: () => Promise<T>) => {
    setPending(true);
    setError(null);
    try {
      return await fn();
    } catch (caught) {
      setError(getErrorMessage(caught));
      return undefined;
    } finally {
      setPending(false);
    }
  }, []);

  return { run, pending, error, clearError: () => setError(null) };
};
