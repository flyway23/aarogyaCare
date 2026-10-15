import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { clearAccessToken, setAccessToken } from '../api/client.js';
import { getMe } from '../api/auth.js';

const accessTokenKey = 'aarogyacare_access_token';
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [accessToken, setTokenState] = useState(() =>
    localStorage.getItem(accessTokenKey),
  );
  const meQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: getMe,
    enabled: Boolean(accessToken),
    retry: false,
    staleTime: 60_000,
  });

  const acceptSession = (session) => {
    setAccessToken(session.accessToken);
    setTokenState(session.accessToken);
    queryClient.setQueryData(['auth', 'me'], session.user);
  };

  const clearSession = () => {
    clearAccessToken();
    setTokenState(null);
    queryClient.removeQueries({ queryKey: ['auth', 'me'] });
  };

  useEffect(() => {
    const handleExpired = () => clearSession();
    const handleRefresh = () =>
      setTokenState(localStorage.getItem(accessTokenKey));
    window.addEventListener('aarogyacare:session-expired', handleExpired);
    window.addEventListener('aarogyacare:session-refreshed', handleRefresh);
    return () => {
      window.removeEventListener('aarogyacare:session-expired', handleExpired);
      window.removeEventListener(
        'aarogyacare:session-refreshed',
        handleRefresh,
      );
    };
  }, [queryClient]);

  const value = useMemo(
    () => ({
      accessToken,
      user: meQuery.data ?? null,
      loading: Boolean(accessToken) && meQuery.isPending,
      acceptSession,
      clearSession,
    }),
    [accessToken, meQuery.data, meQuery.isPending],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
};
