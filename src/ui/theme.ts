// Design tokens centralisés (Phase A — refonte UI saisie d'intervention).
// Calés sur la charte de l'ancienne app `zero-android-v3` : vert Ekylibre pour
// les actions positives (validation, « + AJOUTER », dates relatives), bleu pour
// la toolbar et les titres de section. On migre progressivement les hex en dur
// éparpillés dans les écrans vers ces tokens (cf. workflow Phase G).

export const colors = {
  // Marque
  green: '#7CB342', // actions positives, validation, « + AJOUTER », dates récentes
  greenDark: '#558B2F',
  greenSoft: '#eef6e6', // fond pressé / sélection légère
  blue: '#2196F3', // toolbar, titres de section, liens
  blueDark: '#1976D2',
  blueSoft: '#eef6ff',

  // Texte
  textPrimary: '#222222',
  textSecondary: '#666666',
  textMuted: '#888888',
  textOnBrand: '#ffffff',

  // Surfaces
  background: '#ffffff',
  surface: '#fafafa',
  surfaceAlt: '#f5f5f5',
  border: '#e5e5e5',
  borderStrong: '#dddddd',
  divider: '#eeeeee',

  // États (alignés sur SyncBadge existant)
  danger: '#a3171c',
  dangerText: '#5a0c10',
  dangerBg: '#fde6e6',
  dangerSoft: '#fff0f0',
  warning: '#7a4f00',
  warningBg: '#fff7e6',
  warningBorder: '#f0c36d',
  success: '#0c6b2c',
  successBg: '#e6f9ee',
  info: '#1d4f9e',
  infoBg: '#e6f1ff',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 4,
  md: 6,
  lg: 8,
  pill: 999,
} as const;

export const fontSize = {
  xs: 11,
  sm: 12,
  md: 13,
  base: 14,
  lg: 16,
  xl: 22,
} as const;

export const theme = { colors, spacing, radius, fontSize } as const;

export type Theme = typeof theme;
