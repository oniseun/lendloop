'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useStoreUser } from '../hooks/useStoreUser';

type CurrentUser = ReturnType<typeof useStoreUser>;

const CurrentUserContext = createContext<CurrentUser>({
  isLoading: true,
  isAuthenticated: false,
  user: null,
});

export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const value = useStoreUser();
  return (
    <CurrentUserContext.Provider value={value}>
      {children}
    </CurrentUserContext.Provider>
  );
}

export const useCurrentUser = () => useContext(CurrentUserContext);
