// Types partagés du client API Ekylibre v2.
// Étendu progressivement (P3+ ajoutera les DTO catalogue/intervention).

export interface Credentials {
  instanceUrl: string;
  email: string;
  token: string;
}

export interface TokenResponse {
  token: string;
}
