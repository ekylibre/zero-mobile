import { render } from '@testing-library/react-native';

import { MapView } from '../MapView';

describe('MapView', () => {
  it('rend la Map MapLibre et la Camera (mocks)', () => {
    const { getByTestId } = render(<MapView />);
    expect(getByTestId('maplibre-map')).toBeTruthy();
    expect(getByTestId('maplibre-camera')).toBeTruthy();
  });
});
