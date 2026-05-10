import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import type { ReactNode } from 'react';

import { apiClient } from '@core/api/client';
import { AuthError } from '@core/api/errors';

import { AuthProvider, useAuth } from '../AuthContext';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('@core/api/client', () => {
  const mockClient = {
    login: jest.fn(),
    logout: jest.fn(),
    setCredentials: jest.fn(),
    getCredentials: jest.fn(),
    setUnauthorizedHandler: jest.fn(),
    request: jest.fn(),
  };
  return { apiClient: mockClient, EkylibreApiClient: jest.fn() };
});

const mockGet = SecureStore.getItemAsync as jest.MockedFunction<typeof SecureStore.getItemAsync>;
const mockSet = SecureStore.setItemAsync as jest.MockedFunction<typeof SecureStore.setItemAsync>;
const mockDelete = SecureStore.deleteItemAsync as jest.MockedFunction<
  typeof SecureStore.deleteItemAsync
>;

const mockApi = apiClient as unknown as {
  login: jest.Mock;
  logout: jest.Mock;
  setCredentials: jest.Mock;
  setUnauthorizedHandler: jest.Mock;
};

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

describe('AuthContext', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockSet.mockReset().mockResolvedValue();
    mockDelete.mockReset().mockResolvedValue();
    mockApi.login.mockReset();
    mockApi.logout.mockReset().mockResolvedValue(undefined);
    mockApi.setCredentials.mockReset();
    mockApi.setUnauthorizedHandler.mockReset();
  });

  it('part en loading puis bascule unauthenticated quand le storage est vide', async () => {
    mockGet.mockResolvedValue(null);
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.state.status).toBe('loading');
    await waitFor(() => expect(result.current.state.status).toBe('unauthenticated'));
  });

  it('hydrate les credentials existants en authenticated', async () => {
    const stored = {
      instanceUrl: 'https://farm.ekylibre.com',
      email: 'a@b.fr',
      token: 'tok',
    };
    mockGet.mockResolvedValue(JSON.stringify(stored));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.state.status).toBe('authenticated'));
    if (result.current.state.status !== 'authenticated') {
      throw new Error('expected authenticated');
    }
    expect(result.current.state.credentials).toEqual(stored);
    expect(mockApi.setCredentials).toHaveBeenCalledWith(stored);
  });

  it('login() écrit en storage et passe en authenticated', async () => {
    mockGet.mockResolvedValue(null);
    mockApi.login.mockResolvedValue({ token: 'fresh-tok' });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.state.status).toBe('unauthenticated'));

    await act(async () => {
      await result.current.login('https://farm.ekylibre.com/', 'a@b.fr', 'pwd');
    });

    if (result.current.state.status !== 'authenticated') {
      throw new Error('expected authenticated');
    }
    expect(result.current.state.credentials).toEqual({
      instanceUrl: 'https://farm.ekylibre.com',
      email: 'a@b.fr',
      token: 'fresh-tok',
    });
    expect(mockSet).toHaveBeenCalledWith(
      'eky.auth',
      JSON.stringify(result.current.state.credentials),
    );
  });

  it("login() en échec laisse en unauthenticated et propage l'erreur", async () => {
    mockGet.mockResolvedValue(null);
    mockApi.login.mockRejectedValue(new AuthError());

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.state.status).toBe('unauthenticated'));

    await expect(
      act(async () => {
        await result.current.login('https://x.fr', 'a@b.fr', 'wrong');
      }),
    ).rejects.toBeInstanceOf(AuthError);

    expect(result.current.state.status).toBe('unauthenticated');
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('logout() purge le storage et bascule en unauthenticated', async () => {
    const stored = {
      instanceUrl: 'https://x.fr',
      email: 'a@b.fr',
      token: 'tok',
    };
    mockGet.mockResolvedValue(JSON.stringify(stored));

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.state.status).toBe('authenticated'));

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.state.status).toBe('unauthenticated');
    expect(mockApi.logout).toHaveBeenCalled();
    expect(mockDelete).toHaveBeenCalledWith('eky.auth');
    expect(mockApi.setCredentials).toHaveBeenLastCalledWith(null);
  });

  it('le handler 401 fait basculer en unauthenticated avec reason session-expired', async () => {
    const stored = {
      instanceUrl: 'https://x.fr',
      email: 'a@b.fr',
      token: 'tok',
    };
    mockGet.mockResolvedValue(JSON.stringify(stored));

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.state.status).toBe('authenticated'));

    // Récupère le handler enregistré par l'effet de AuthProvider.
    const lastCall = mockApi.setUnauthorizedHandler.mock.calls.find(
      (c) => typeof c[0] === 'function',
    );
    expect(lastCall).toBeDefined();
    const handler = lastCall![0] as () => void;

    await act(async () => {
      handler();
      // laisse passer la microtâche de clearCredentials()
      await Promise.resolve();
    });

    if (result.current.state.status !== 'unauthenticated') {
      throw new Error('expected unauthenticated');
    }
    expect(result.current.state.reason).toBe('session-expired');
  });
});
