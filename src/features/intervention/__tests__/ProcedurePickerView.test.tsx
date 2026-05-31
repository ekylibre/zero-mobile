import { fireEvent, render, screen } from '@testing-library/react-native';

import { initI18n } from '@core/i18n';
import type { Procedure } from '@core/db/models';

import { ProcedurePickerView } from '../ProcedurePickerView';

initI18n();

// On ne s'appuie que sur `name` + `labelFr` (seuls champs lus par la vue).
const procedures = [
  { name: 'spraying', labelFr: 'Pulvérisation' },
  { name: 'sowing', labelFr: 'Semis' },
  { name: 'harvesting', labelFr: 'Récolte' },
] as unknown as Procedure[];

describe('ProcedurePickerView', () => {
  it('affiche une tuile par procédure du catalogue (grille complète)', () => {
    render(<ProcedurePickerView procedures={procedures} onSelect={() => {}} />);
    expect(screen.getByTestId('procedure-tile-spraying')).toBeOnTheScreen();
    expect(screen.getByTestId('procedure-tile-sowing')).toBeOnTheScreen();
    expect(screen.getByTestId('procedure-tile-harvesting')).toBeOnTheScreen();
  });

  it('rend la procédure supportée cliquable et déclenche onSelect', () => {
    const onSelect = jest.fn();
    render(<ProcedurePickerView procedures={procedures} onSelect={onSelect} />);
    fireEvent.press(screen.getByTestId('procedure-tile-spraying'));
    expect(onSelect).toHaveBeenCalledWith('spraying');
  });

  it('grise + désactive les procédures non supportées et affiche « Bientôt »', () => {
    render(<ProcedurePickerView procedures={procedures} onSelect={() => {}} />);
    const sowing = screen.getByTestId('procedure-tile-sowing');
    expect(sowing.props.accessibilityState.disabled).toBe(true);
    // Une mention « Bientôt » par tuile non supportée (sowing + harvesting).
    expect(screen.getAllByText('Bientôt')).toHaveLength(2);
  });

  it('rend la procédure supportée non désactivée', () => {
    render(<ProcedurePickerView procedures={procedures} onSelect={() => {}} />);
    const spraying = screen.getByTestId('procedure-tile-spraying');
    expect(spraying.props.accessibilityState.disabled).toBe(false);
  });

  it('affiche un état vide quand aucune procédure', () => {
    render(<ProcedurePickerView procedures={[]} onSelect={() => {}} />);
    expect(screen.queryByTestId('procedure-picker-grid')).toBeNull();
    expect(
      screen.getByText(
        'Aucune procédure disponible. Lancez une synchronisation depuis Paramètres.',
      ),
    ).toBeOnTheScreen();
  });
});
