import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { apiClient } from '@core/api/client';
import { AuthError } from '@core/api/errors';
import type { Credentials } from '@core/api/types';
import { captureMessage } from '@core/observability/sentry';

import { clearCredentials, loadCredentials, saveCredentials } from './secure-storage';

export type AuthState =
  | { status: 'loading' }
  | { status: 'unauthenticated'; reason?: 'session-expired' }
  | { status: 'authenticated'; credentials: Credentials };

export interface AuthContextValue {
  state: AuthState;
  login: (instanceUrl: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  const stateRef = useRef(state);
  stateRef.current = state;

  // Hydratation au montage : récupère les credentials du Keychain/Keystore.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const stored = await loadCredentials();
      if (cancelled) return;
      if (stored) {
        apiClient.setCredentials(stored);
        setState({ status: 'authenticated', credentials: stored });
      } else {
        setState({ status: 'unauthenticated' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Gestion centralisée du 401 : purge locale + repli sur Login.
  useEffect(() => {
    apiClient.setUnauthorizedHandler(() => {
      if (stateRef.current.status !== 'authenticated') return;
      void clearCredentials();
      apiClient.setCredentials(null);
      setState({ status: 'unauthenticated', reason: 'session-expired' });
      captureMessage('Auth: 401 reçu, session purgée', { level: 'warning' });
    });
    return () => apiClient.setUnauthorizedHandler(null);
  }, []);

  const login = useCallback(async (instanceUrl: string, email: string, password: string) => {
    const trimmedUrl = instanceUrl.replace(/\/+$/, '');
    const { token } = await apiClient.login(trimmedUrl, email, password);
    const credentials: Credentials = { instanceUrl: trimmedUrl, email, token };
    await saveCredentials(credentials);
    apiClient.setCredentials(credentials);
    setState({ status: 'authenticated', credentials });
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiClient.logout();
    } catch {
      // best-effort, cf. apiClient.logout
    }
    await clearCredentials();
    apiClient.setCredentials(null);
    setState({ status: 'unauthenticated' });
  }, []);

  const value = useMemo<AuthContextValue>(() => ({ state, login, logout }), [state, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth doit être appelé à l'intérieur d'un <AuthProvider>");
  }
  return ctx;
}

// Réexport utile aux écrans qui veulent s'interroger sur le type d'erreur.
export { AuthError };
