// RNTL v13+ : matchers exposés via /matchers (l'ancien
// @testing-library/jest-native est déprécié).
import '@testing-library/react-native/matchers';

// Silence le warning Reanimated en environnement Jest.
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
