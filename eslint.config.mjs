// Flat config ESLint 9+ — base Expo + Prettier
import expoConfig from 'eslint-config-expo/flat.js';
import prettierConfig from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';

export default [
  ...expoConfig,
  {
    ignores: [
      'node_modules/**',
      'ios/**',
      'android/**',
      '.expo/**',
      'dist/**',
      'coverage/**',
      'web-build/**',
      '*.config.js',
      'metro.config.js',
      'babel.config.js',
    ],
  },
  // Règles TS (le plugin @typescript-eslint est chargé par eslint-config-expo
  // uniquement pour ces extensions).
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
    },
  },
  // Règles transverses + Prettier
  {
    plugins: { prettier: prettierPlugin },
    rules: {
      'prettier/prettier': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  prettierConfig,
];
