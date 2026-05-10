module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'react' }]],
    plugins: [
      // WatermelonDB exige les decorators legacy.
      ['@babel/plugin-proposal-decorators', { legacy: true }],
      // Reanimated v4 : le plugin worklets est maintenant dans son
      // propre paquet (et doit être listé EN DERNIER).
      'react-native-worklets/plugin',
    ],
  };
};
