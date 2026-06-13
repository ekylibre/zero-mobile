// RNTL v13+ : matchers exposés via /matchers (l'ancien
// @testing-library/jest-native est déprécié).
import '@testing-library/react-native/matchers';

// Silence le warning Reanimated en environnement Jest.
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

// MapLibre RN charge des modules natifs (JSI) au import. Mock minimal — les
// tests ne doivent pas dépendre du rendu carto, ils vérifient le scaffolding.
jest.mock('@maplibre/maplibre-react-native', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  const passthrough = (testID: string) => {
    const Stub = ({ children }: { children?: unknown }) =>
      React.createElement(View, { testID }, children);
    Stub.displayName = `MapLibreMock(${testID})`;
    return Stub;
  };
  return {
    Map: passthrough('maplibre-map'),
    Camera: passthrough('maplibre-camera'),
  };
});
