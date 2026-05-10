import * as SecureStore from 'expo-secure-store';

import { clearCredentials, loadCredentials, saveCredentials } from '../secure-storage';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const mockGet = SecureStore.getItemAsync as jest.MockedFunction<typeof SecureStore.getItemAsync>;
const mockSet = SecureStore.setItemAsync as jest.MockedFunction<typeof SecureStore.setItemAsync>;
const mockDelete = SecureStore.deleteItemAsync as jest.MockedFunction<
  typeof SecureStore.deleteItemAsync
>;

describe('secure-storage', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockSet.mockReset().mockResolvedValue();
    mockDelete.mockReset().mockResolvedValue();
  });

  it('round-trip save → load', async () => {
    const creds = {
      instanceUrl: 'https://farm.ekylibre.com',
      email: 'a@b.fr',
      token: 'tok',
    };
    await saveCredentials(creds);
    expect(mockSet).toHaveBeenCalledWith('eky.auth', JSON.stringify(creds));

    mockGet.mockResolvedValue(JSON.stringify(creds));
    expect(await loadCredentials()).toEqual(creds);
  });

  it('retourne null si la clé est absente', async () => {
    mockGet.mockResolvedValue(null);
    expect(await loadCredentials()).toBeNull();
  });

  it('retourne null si le JSON est corrompu', async () => {
    mockGet.mockResolvedValue('{ this is not json');
    expect(await loadCredentials()).toBeNull();
  });

  it('retourne null si le shape est incomplet', async () => {
    mockGet.mockResolvedValue(JSON.stringify({ email: 'a@b.fr' }));
    expect(await loadCredentials()).toBeNull();
  });

  it('clearCredentials supprime la clé', async () => {
    await clearCredentials();
    expect(mockDelete).toHaveBeenCalledWith('eky.auth');
  });
});
