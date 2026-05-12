import { ApiError, AuthError, NetworkError, ValidationError } from '../errors';
import { EkylibreApiClient } from '../client';
import type { CreateInterventionPayload, ProviderTag } from '../types';

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

const PROVIDER: ProviderTag = {
  vendor: 'ekylibre-mobile',
  name: 'zero-mobile',
  id: 'uuid-1',
  data: { app_version: '0.1.0', os: 'ios', locale: 'fr-FR' },
};

function makePayload(): CreateInterventionPayload {
  return {
    procedure_name: 'spraying',
    actions: [],
    provider: PROVIDER,
    working_periods_attributes: [
      { started_at: '2026-04-12T08:00:00.000Z', stopped_at: '2026-04-12T10:00:00.000Z' },
    ],
    doers_attributes: [{ product_id: 100, reference_name: 'driver' }],
    inputs_attributes: [
      {
        product_id: 200,
        reference_name: 'plant_medicine',
        quantity_value: 1.5,
        quantity_handler: 'population',
      },
    ],
    targets_attributes: [{ product_id: 4000, reference_name: 'cultivation' }],
    tools_attributes: [{ product_id: 300, reference_name: 'sprayer' }],
  };
}

function makeAuthClient(fetchMock: jest.Mock) {
  const client = new EkylibreApiClient(fetchMock);
  client.setCredentials({
    instanceUrl: 'https://farm.ekylibre.com',
    email: 'a@b.fr',
    token: 'tok',
  });
  return client;
}

describe('EkylibreApiClient.createIntervention', () => {
  it('appelle POST /api/v2/interventions avec le payload et retourne le DTO', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      makeResponse({
        id: 42,
        procedure_name: 'spraying',
        started_at: '2026-04-12T08:00:00Z',
        stopped_at: '2026-04-12T10:00:00Z',
      }),
    );
    const client = makeAuthClient(fetchMock);

    const dto = await client.createIntervention(makePayload());

    expect(dto.id).toBe(42);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://farm.ekylibre.com/api/v2/interventions');
    expect(init.method).toBe('POST');
    expect(init.headers.get('Authorization')).toBe('simple-token a@b.fr tok');
    expect(init.headers.get('Content-Type')).toBe('application/json');
    expect(JSON.parse(init.body).provider.id).toBe('uuid-1');
  });

  it('lève ValidationError sur 422 avec les errors[] parsés', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        makeResponse({ errors: ['Driver missing', 'Quantity must be positive'] }, { status: 422 }),
      );
    const client = makeAuthClient(fetchMock);

    await expect(client.createIntervention(makePayload())).rejects.toMatchObject({
      name: 'ValidationError',
      status: 422,
      errors: ['Driver missing', 'Quantity must be positive'],
    });
  });

  it('lève ValidationError sur 412 (precondition)', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(makeResponse({ errors: ['Stale data'] }, { status: 412 }));
    const client = makeAuthClient(fetchMock);

    await expect(client.createIntervention(makePayload())).rejects.toBeInstanceOf(ValidationError);
  });

  it('extrait les errors quand le serveur renvoie un object map', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        makeResponse(
          { errors: { doers: ['must be present'], quantity_value: ['must be positive'] } },
          { status: 422 },
        ),
      );
    const client = makeAuthClient(fetchMock);

    try {
      await client.createIntervention(makePayload());
      fail('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect((e as ValidationError).errors).toEqual(['must be present', 'must be positive']);
    }
  });

  it("conserve un errors[] vide si le body 422 n'est pas du JSON", async () => {
    const fetchMock = jest.fn().mockResolvedValue(makeResponse('boom plain text', { status: 422 }));
    const client = makeAuthClient(fetchMock);

    try {
      await client.createIntervention(makePayload());
      fail('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect((e as ValidationError).errors).toEqual([]);
      expect((e as ValidationError).body).toBe('boom plain text');
    }
  });

  it('lève ApiError sur 500 (pas une ValidationError)', async () => {
    const fetchMock = jest.fn().mockResolvedValue(makeResponse('boom', { status: 500 }));
    const client = makeAuthClient(fetchMock);

    await expect(client.createIntervention(makePayload())).rejects.toMatchObject({
      name: 'ApiError',
      status: 500,
    });
  });

  it('lève NetworkError quand fetch échoue', async () => {
    const fetchMock = jest.fn().mockRejectedValue(new TypeError('Network request failed'));
    const client = makeAuthClient(fetchMock);

    await expect(client.createIntervention(makePayload())).rejects.toBeInstanceOf(NetworkError);
  });

  it('relaie le 401 (AuthError) sans le transformer en ValidationError', async () => {
    const fetchMock = jest.fn().mockResolvedValue(makeResponse('expired', { status: 401 }));
    const client = makeAuthClient(fetchMock);

    await expect(client.createIntervention(makePayload())).rejects.toBeInstanceOf(AuthError);
  });
});

describe('EkylibreApiClient.updateIntervention', () => {
  it('appelle PUT /api/v2/interventions/{server_id}', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      makeResponse({
        id: 42,
        procedure_name: 'spraying',
        started_at: '2026-04-12T08:00:00Z',
        stopped_at: '2026-04-12T10:00:00Z',
      }),
    );
    const client = makeAuthClient(fetchMock);

    const dto = await client.updateIntervention(42, {
      procedure_name: 'spraying',
      actions: [],
      working_periods_attributes: [
        { started_at: '2026-04-12T08:00:00.000Z', stopped_at: '2026-04-12T10:00:00.000Z' },
      ],
      doers_attributes: [{ product_id: 100, reference_name: 'driver' }],
      inputs_attributes: [
        {
          product_id: 200,
          reference_name: 'plant_medicine',
          quantity_value: 1,
          quantity_handler: 'population',
        },
      ],
      targets_attributes: [{ product_id: 4000, reference_name: 'cultivation' }],
      tools_attributes: [{ product_id: 300, reference_name: 'sprayer' }],
    });

    expect(dto.id).toBe(42);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://farm.ekylibre.com/api/v2/interventions/42');
    expect(init.method).toBe('PUT');
  });

  it('lève ValidationError sur 422 (même mécanique que create)', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(makeResponse({ errors: ['nope'] }, { status: 422 }));
    const client = makeAuthClient(fetchMock);

    await expect(
      client.updateIntervention(99, {
        procedure_name: 'spraying',
        actions: [],
        working_periods_attributes: [],
        doers_attributes: [],
        inputs_attributes: [],
        targets_attributes: [],
        tools_attributes: [],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
