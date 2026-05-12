import { fireEvent, render, screen } from '@testing-library/react-native';

import type { Procedure } from '@core/db/models';
import { initI18n } from '@core/i18n';

import { ProcedurePickerView } from '../ProcedurePickerView';

initI18n();

function makeProcedure(overrides: Partial<Procedure> & { name: string }): Procedure {
  return {
    labelFr: overrides.name,
    definition: {},
    updatedAtServer: 0,
    ...overrides,
  } as unknown as Procedure;
}

describe('ProcedurePickerView', () => {
  it('rend une ligne par procédure supportée v1 (spraying)', () => {
    const procedures = [
      makeProcedure({ name: 'spraying', labelFr: 'Pulvérisation' }),
      makeProcedure({ name: 'harvesting', labelFr: 'Récolte' }),
      makeProcedure({ name: 'sowing', labelFr: 'Semis' }),
    ];

    render(<ProcedurePickerView procedures={procedures} onSelect={jest.fn()} />);

    expect(screen.getByTestId('procedure-row-spraying')).toBeOnTheScreen();
    expect(screen.queryByTestId('procedure-row-harvesting')).toBeNull();
    expect(screen.queryByTestId('procedure-row-sowing')).toBeNull();
    expect(screen.getByText('Pulvérisation')).toBeOnTheScreen();
  });

  it('appelle onSelect avec le name de la procédure tapée', () => {
    const onSelect = jest.fn();
    render(
      <ProcedurePickerView
        procedures={[makeProcedure({ name: 'spraying', labelFr: 'Pulvérisation' })]}
        onSelect={onSelect}
      />,
    );

    fireEvent.press(screen.getByTestId('procedure-row-spraying'));
    expect(onSelect).toHaveBeenCalledWith('spraying');
  });

  it("affiche l'état vide quand aucune procédure supportée n'est dispo", () => {
    render(
      <ProcedurePickerView
        procedures={[makeProcedure({ name: 'harvesting', labelFr: 'Récolte' })]}
        onSelect={jest.fn()}
      />,
    );

    expect(screen.getByText(/Aucune procédure disponible/i)).toBeOnTheScreen();
  });

  it("affiche l'état vide quand la liste est totalement vide", () => {
    render(<ProcedurePickerView procedures={[]} onSelect={jest.fn()} />);

    expect(screen.getByText(/Aucune procédure disponible/i)).toBeOnTheScreen();
  });

  it('retombe sur le name si labelFr est vide', () => {
    render(
      <ProcedurePickerView
        procedures={[makeProcedure({ name: 'spraying', labelFr: '' })]}
        onSelect={jest.fn()}
      />,
    );

    expect(screen.getByText('spraying')).toBeOnTheScreen();
  });
});
