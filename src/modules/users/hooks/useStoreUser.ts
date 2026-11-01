'use client';

import { useConvexAuth, useMutation, useQuery } from 'convex/react';
import { useEffect, useState } from 'react';
import { userApi } from '../api/user.api';

// Makes sure a Convex user row exists for the signed-in Clerk user,
// then returns it (with its server-side role).
export const useStoreUser = () => {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const store = useMutation(userApi.store);
  const [stored, setStored] = useState(false);
  const me = useQuery(userApi.me, isAuthenticated && stored ? {} : 'skip');

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    store({})
      .then(() => !cancelled && setStored(true))
      .catch((error) => console.error('Failed to sync user', error));
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, store]);

  return {
    isLoading: isLoading || (isAuthenticated && me === undefined),
    isAuthenticated,
    user: me ?? null,
  };
};
