import { fireEvent, render, screen } from '@testing-library/react-native';

import { initI18n } from '@core/i18n';

import { SelectField } from '../SelectField';

initI18n();

interface Item {
  id: string;
  name: string;
  variety?: string;
}

const items: Item[] = [
  { id: '1', name: 'Parcelle Nord', variety: '4 ha' },
  { id: '2', name: 'Parcelle Sud', variety: '2 ha' },
  { id: '3', name: 'Verger Est' },
];

function renderField(overrides: Partial<React.ComponentProps<typeof SelectField<Item>>> = {}) {
  const onChange = jest.fn();
  const utils = render(
    <SelectField<Item>
      label="Parcelle"
      items={items}
      value={null}
      onChange={onChange}
      getKey={(i) => i.id}
      getLabel={(i) => i.name}
      getSubtitle={(i) => i.variety ?? null}
      placeholder="Choisir…"
      testID="parcelle-select"
      {...overrides}
    />,
  );
  return { ...utils, onChange };
}

describe('SelectField', () => {
  it('affiche le placeholder quand value=null', () => {
    renderField();
    expect(screen.getByText('Choisir…')).toBeOnTheScreen();
  });

  it('affiche le label de la valeur sélectionnée', () => {
    renderField({ value: items[1]! });
    expect(screen.getByText('Parcelle Sud')).toBeOnTheScreen();
    expect(screen.getByText('2 ha')).toBeOnTheScreen();
  });

  it('ouvre la modal au tap et liste tous les items', () => {
    renderField();
    fireEvent.press(screen.getByTestId('parcelle-select'));

    expect(screen.getByTestId('parcelle-select-item-1')).toBeOnTheScreen();
    expect(screen.getByTestId('parcelle-select-item-2')).toBeOnTheScreen();
    expect(screen.getByTestId('parcelle-select-item-3')).toBeOnTheScreen();
  });

  it('filtre les items via la recherche (insensible à la casse)', () => {
    renderField();
    fireEvent.press(screen.getByTestId('parcelle-select'));

    fireEvent.changeText(screen.getByTestId('parcelle-select-search'), 'verg');
    expect(screen.queryByTestId('parcelle-select-item-1')).toBeNull();
    expect(screen.queryByTestId('parcelle-select-item-2')).toBeNull();
    expect(screen.getByTestId('parcelle-select-item-3')).toBeOnTheScreen();
  });

  it("appelle onChange et ferme la modal au tap d'un item", () => {
    const { onChange } = renderField();
    fireEvent.press(screen.getByTestId('parcelle-select'));

    fireEvent.press(screen.getByTestId('parcelle-select-item-2'));
    expect(onChange).toHaveBeenCalledWith(items[1]);
    // La modal est fermée → l'item n'est plus rendu.
    expect(screen.queryByTestId('parcelle-select-item-1')).toBeNull();
  });

  it("met une checkmark sur l'item actuellement sélectionné", () => {
    renderField({ value: items[1]! });
    fireEvent.press(screen.getByTestId('parcelle-select'));

    expect(screen.getByText('✓')).toBeOnTheScreen();
  });

  it('affiche le message vide quand items=[]', () => {
    renderField({ items: [], emptyText: 'Aucune parcelle.' });
    fireEvent.press(screen.getByTestId('parcelle-select'));

    expect(screen.getByText('Aucune parcelle.')).toBeOnTheScreen();
    // Pas de barre de recherche quand aucune entrée.
    expect(screen.queryByTestId('parcelle-select-search')).toBeNull();
  });

  it("affiche 'aucun résultat' quand le filtre ne matche rien", () => {
    renderField({ noResultsText: 'Rien trouvé.' });
    fireEvent.press(screen.getByTestId('parcelle-select'));
    fireEvent.changeText(screen.getByTestId('parcelle-select-search'), 'zzzzz');

    expect(screen.getByText('Rien trouvé.')).toBeOnTheScreen();
  });

  it('affiche errorMessage en rouge quand fourni', () => {
    renderField({ errorMessage: 'Parcelle requise.' });
    expect(screen.getByText('Parcelle requise.')).toBeOnTheScreen();
  });

  it('ferme la modal au tap sur Annuler sans changer la valeur', () => {
    const { onChange } = renderField();
    fireEvent.press(screen.getByTestId('parcelle-select'));

    fireEvent.press(screen.getByTestId('parcelle-select-close'));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByTestId('parcelle-select-item-1')).toBeNull();
  });
});
