// Override léger d'`app.json` pour injecter des valeurs sensibles depuis
// l'environnement EAS au build time. Expo charge ce fichier **à la place**
// d'app.json — la fonction reçoit déjà `config` résolu depuis le JSON et on
// le patche.
//
// Variables EAS attendues (cf. docs/P0-checklist.md) :
//   - SENTRY_DSN          : DSN du projet zero-mobile (env dev/pilot)
//   - SENTRY_AUTH_TOKEN   : utilisé par le plugin @sentry/react-native pour
//                            uploader les sourcemaps après chaque build
//
// En dev sans SENTRY_DSN défini, `initSentry()` détecte le PLACEHOLDER et
// no-op silencieusement (cf. src/core/observability/sentry.ts).
module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    sentryDsn: process.env.SENTRY_DSN || config.extra.sentryDsn,
  },
});
