import { fireEvent, render } from '@testing-library/react-native';

import type { CultivableZone } from '@core/db/models';
import { initI18n } from '@core/i18n';

import { TargetMapPickerModal } from '../TargetMapPickerModal';

initI18n();

function makeZone(id: string, withGeometry = true): CultivableZone {
  return {
    id,
    serverId: Number(id.replace(/\D/g, '')) || 1,
    name: `Zone ${id}`,
    kind: 'land_parcel',
    geometry: withGeometry
      ? {
          type: 'Polygon',
          coordinates: [
            [
              [0, 0],
              [1, 0],
              [1, 1],
              [0, 0],
            ],
          ],
        }
      : null,
    areaHectares: 1,
    deadAt: null,
    shapeSvg: null,
    updatedAtServer: 0,
  } as unknown as CultivableZone;
}

describe('TargetMapPickerModal', () => {
  it('ne rend rien quand visible=false', () => {
    const { queryByTestId } = render(
      <TargetMapPickerModal
        visible={false}
        zones={[makeZone('z1')]}
        initialSelectedIds={[]}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    expect(queryByTestId('target-map-picker-modal')).toBeNull();
  });

  it('renvoie la sélection initiale au tap sur Valider sans modif', () => {
    const onConfirm = jest.fn();
    const { getByTestId } = render(
      <TargetMapPickerModal
        visible
        zones={[makeZone('z1'), makeZone('z2')]}
        initialSelectedIds={['z2']}
        onConfirm={onConfirm}
        onCancel={jest.fn()}
      />,
    );
    fireEvent.press(getByTestId('target-map-confirm'));
    expect(onConfirm).toHaveBeenCalledWith(['z2']);
  });

  it('appelle onCancel sur Annuler', () => {
    const onCancel = jest.fn();
    const { getByTestId } = render(
      <TargetMapPickerModal
        visible
        zones={[makeZone('z1')]}
        initialSelectedIds={[]}
        onConfirm={jest.fn()}
        onCancel={onCancel}
      />,
    );
    fireEvent.press(getByTestId('target-map-cancel'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('toggle au tap sur une parcelle (ajoute puis retire)', () => {
    const onConfirm = jest.fn();
    const { getByTestId } = render(
      <TargetMapPickerModal
        visible
        zones={[makeZone('z1')]}
        initialSelectedIds={[]}
        onConfirm={onConfirm}
        onCancel={jest.fn()}
      />,
    );
    fireEvent(getByTestId('maplibre-source'), 'press', {
      nativeEvent: { features: [{ properties: { id: 'z1' } }] },
    });
    fireEvent.press(getByTestId('target-map-confirm'));
    expect(onConfirm).toHaveBeenCalledWith(['z1']);
  });
});
