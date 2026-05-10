import { ApiError, AuthError, NetworkError } from '../errors';
import { EkylibreApiClient } from '../client';

function makeResponse(body: unknown, init: { status?: number; ok?: boolean } = {}): Response {
  const status = init.status ?? 200;
  const ok = init.ok ?? (status >= 200 && status < 300);
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
    headers: new Headers(),
  } as unknown as Response;
}

describe('EkylibreApiClient.login', () => {
  it('appelle POST /api/v2/tokens et retourne le token', async () => {
    const fetchMock = jest.fn().mockResolvedValue(makeResponse({ token: 'abc123' }));
    const client = new EkylibreApiClient(fetchMock);

    const result = await client.login('https://farm.ekylibre.com/', 'a@b.fr', 'pwd');

    expect(result).toEqual({ token: 'abc123' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://farm.ekylibre.com/api/v2/tokens');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({ email: 'a@b.fr', password: 'pwd' });
  });

  it('lève AuthError sur 401', async () => {
    const fetchMock = jest.fn().mockResolvedValue(makeResponse('nope', { status: 401 }));
    const client = new EkylibreApiClient(fetchMock);

    await expect(client.login('https://x.fr', 'a@b.fr', 'pwd')).rejects.toBeInstanceOf(AuthError);
  });

  it('lève AuthError sur 403', async () => {
    const fetchMock = jest.fn().mockResolvedValue(makeResponse('forbidden', { status: 403 }));
    const client = new EkylibreApiClient(fetchMock);

    await expect(client.login('https://x.fr', 'a@b.fr', 'pwd')).rejects.toBeInstanceOf(AuthError);
  });

  it('lève ApiError sur 500', async () => {
    const fetchMock = jest.fn().mockResolvedValue(makeResponse('boom', { status: 500 }));
    const client = new EkylibreApiClient(fetchMock);

    await expect(client.login('https://x.fr', 'a@b.fr', 'pwd')).rejects.toMatchObject({
      name: 'ApiError',
      status: 500,
    });
  });

  it('lève NetworkError quand fetch échoue', async () => {
    const fetchMock = jest.fn().mockRejectedValue(new TypeError('Network request failed'));
    const client = new EkylibreApiClient(fetchMock);

    await expect(client.login('https://x.fr', 'a@b.fr', 'pwd')).rejects.toBeInstanceOf(
      NetworkError,
    );
  });

  it('lève ApiError si la réponse ne contient pas de token', async () => {
    const fetchMock = jest.fn().mockResolvedValue(makeResponse({ wrong: 'shape' }));
    const client = new EkylibreApiClient(fetchMock);

    await expect(client.login('https://x.fr', 'a@b.fr', 'pwd')).rejects.toBeInstanceOf(ApiError);
  });
});

describe('EkylibreApiClient.request', () => {
  it('injecte le header simple-token', async () => {
    const fetchMock = jest.fn().mockResolvedValue(makeResponse({ data: 'ok' }));
    const client = new EkylibreApiClient(fetchMock);
    client.setCredentials({
      instanceUrl: 'https://farm.ekylibre.com',
      email: 'a@b.fr',
      token: 'tok',
    });

    await client.request('/api/v2/profile');

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://farm.ekylibre.com/api/v2/profile');
    expect((init.headers as Headers).get('Authorization')).toBe('simple-token a@b.fr tok');
    expect((init.headers as Headers).get('Accept')).toBe('application/json');
  });

  it('lève AuthError sans credentials', async () => {
    const fetchMock = jest.fn();
    const client = new EkylibreApiClient(fetchMock);

    await expect(client.request('/api/v2/profile')).rejects.toBeInstanceOf(AuthError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('appelle le handler 401 et lève AuthError sur 401 serveur', async () => {
    const fetchMock = jest.fn().mockResolvedValue(makeResponse('nope', { status: 401 }));
    const client = new EkylibreApiClient(fetchMock);
    client.setCredentials({
      instanceUrl: 'https://x.fr',
      email: 'a@b.fr',
      token: 'tok',
    });
    const onUnauthorized = jest.fn();
    client.setUnauthorizedHandler(onUnauthorized);

    await expect(client.request('/api/v2/profile')).rejects.toBeInstanceOf(AuthError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
});

describe('EkylibreApiClient.logout', () => {
  it('appelle DELETE /api/v2/tokens/<token> avec auth header', async () => {
    const fetchMock = jest.fn().mockResolvedValue(makeResponse(null, { status: 204 }));
    const client = new EkylibreApiClient(fetchMock);
    client.setCredentials({
      instanceUrl: 'https://x.fr/',
      email: 'a@b.fr',
      token: 'tok',
    });

    await client.logout();

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://x.fr/api/v2/tokens/tok');
    expect(init.method).toBe('DELETE');
    expect(init.headers.Authorization).toBe('simple-token a@b.fr tok');
  });

  it('avale les erreurs (best-effort)', async () => {
    const fetchMock = jest.fn().mockRejectedValue(new TypeError('boom'));
    const client = new EkylibreApiClient(fetchMock);
    client.setCredentials({
      instanceUrl: 'https://x.fr',
      email: 'a@b.fr',
      token: 'tok',
    });

    await expect(client.logout()).resolves.toBeUndefined();
  });

  it('no-op sans credentials', async () => {
    const fetchMock = jest.fn();
    const client = new EkylibreApiClient(fetchMock);

    await client.logout();

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
