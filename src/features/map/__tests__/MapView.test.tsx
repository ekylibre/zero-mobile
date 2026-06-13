import { fireEvent, render } from '@testing-library/react-native';

import { MapView } from '../MapView';
import type { ParcelFeatureProps } from '../geo';

type FC = GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon, ParcelFeatureProps>;

function makeFC(): FC {
  const geometry: GeoJSON.Polygon = {
    type: 'Polygon',
    coordinates: [
      [
        [2, 48],
        [3, 48],
        [3, 49],
        [2, 48],
      ],
    ],
  };
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        id: 'wdb-1',
        properties: { id: 'wdb-1', serverId: 1, name: 'P1', kind: 'land_parcel', selected: false },
        geometry,
      },
    ],
  };
}

describe('MapView', () => {
  it('rend Map + Camera sans couche parcels par défaut', () => {
    const { getByTestId, queryByTestId } = render(<MapView />);
    expect(getByTestId('maplibre-map')).toBeTruthy();
    expect(getByTestId('maplibre-camera')).toBeTruthy();
    expect(queryByTestId('maplibre-source')).toBeNull();
  });

  it('rend la GeoJSONSource + 2 layers quand parcels fourni', () => {
    const { getByTestId, getAllByTestId } = render(<MapView parcels={makeFC()} />);
    expect(getByTestId('maplibre-source')).toBeTruthy();
    expect(getAllByTestId('maplibre-layer')).toHaveLength(2);
  });

  it('appelle onParcelPress avec l’id local au tap', () => {
    const onParcelPress = jest.fn();
    const { getByTestId } = render(<MapView parcels={makeFC()} onParcelPress={onParcelPress} />);
    fireEvent(getByTestId('maplibre-source'), 'press', {
      nativeEvent: { features: [{ properties: { id: 'wdb-1' } }] },
    });
    expect(onParcelPress).toHaveBeenCalledWith('wdb-1');
  });

  it('ignore un tap sans feature', () => {
    const onParcelPress = jest.fn();
    const { getByTestId } = render(<MapView parcels={makeFC()} onParcelPress={onParcelPress} />);
    fireEvent(getByTestId('maplibre-source'), 'press', { nativeEvent: { features: [] } });
    expect(onParcelPress).not.toHaveBeenCalled();
  });
});
