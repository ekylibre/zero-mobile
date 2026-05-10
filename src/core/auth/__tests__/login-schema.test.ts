import { loginSchema } from '../login-schema';

describe('loginSchema', () => {
  const validInput = {
    instanceUrl: 'https://farm.ekylibre.com',
    email: 'a@b.fr',
    password: 'pwd',
  };

  it('accepte un input valide', () => {
    expect(loginSchema.parse(validInput)).toEqual(validInput);
  });

  it('trim les espaces sur instanceUrl et email', () => {
    const result = loginSchema.parse({
      instanceUrl: '  https://farm.ekylibre.com  ',
      email: '  a@b.fr  ',
      password: 'pwd',
    });
    expect(result.instanceUrl).toBe('https://farm.ekylibre.com');
    expect(result.email).toBe('a@b.fr');
  });

  it('rejette une URL vide', () => {
    const result = loginSchema.safeParse({ ...validInput, instanceUrl: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('login.errors.instanceUrlRequired');
    }
  });

  it('rejette une URL sans schéma', () => {
    const result = loginSchema.safeParse({ ...validInput, instanceUrl: 'farm.ekylibre.com' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('login.errors.instanceUrlInvalid');
    }
  });

  it('rejette une URL en http (non https)', () => {
    const result = loginSchema.safeParse({
      ...validInput,
      instanceUrl: 'http://farm.ekylibre.com',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('login.errors.instanceUrlNotHttps');
    }
  });

  it('rejette un email vide', () => {
    const result = loginSchema.safeParse({ ...validInput, email: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('login.errors.emailRequired');
    }
  });

  it('rejette un email mal formé', () => {
    const result = loginSchema.safeParse({ ...validInput, email: 'pas-un-email' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('login.errors.emailInvalid');
    }
  });

  it('rejette un mot de passe vide', () => {
    const result = loginSchema.safeParse({ ...validInput, password: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('login.errors.passwordRequired');
    }
  });
});
