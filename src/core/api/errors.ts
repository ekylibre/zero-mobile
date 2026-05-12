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

/**
 * 412 / 422 — l'API a rejeté le payload. Porte la liste d'erreurs serveur
 * pour que le sync engine la stocke dans `intervention.sync_error_message`.
 * Les codes/details exacts dépendent d'Ekylibre v2 ; on capture ce qu'on peut
 * et on garde le body brut en fallback (`body` hérité d'ApiError).
 */
export class ValidationError extends ApiError {
  public readonly errors: string[];

  constructor(status: number, message: string, errors: string[] = [], body?: string) {
    super(status, message, body);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}
