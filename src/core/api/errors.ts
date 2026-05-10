// Hiérarchie d'erreurs typées pour le client API Ekylibre v2.

export class NetworkError extends Error {
  constructor(message = 'Erreur réseau') {
    super(message);
    this.name = 'NetworkError';
  }
}

export class ApiError extends Error {
  public readonly status: number;
  public readonly body: string | undefined;

  constructor(status: number, message: string, body?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

export class AuthError extends ApiError {
  constructor(message = 'Identifiants invalides') {
    super(401, message);
    this.name = 'AuthError';
  }
}
