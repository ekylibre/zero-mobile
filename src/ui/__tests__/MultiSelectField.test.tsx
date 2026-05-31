import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { initI18n } from '@core/i18n';

import { MultiSelectField } from '../MultiSelectField';

initI18n();

interface Zone {
  id: string;
  name: string;
  area: number;
}

const zones: Zone[] = [
  { id: 'z1', name: 'La Renambrie', area: 4 },
  { id: 'z2', name: 'Myrmidon', area: 2 },
  { id: 'z3', name: 'Les Grands Pièces', area: 5 },
];

// Harness contrôlé : le parent détient la sélection ; MultiSelectField ne
// propage qu'au VALIDER.
function Harness({ initial = [] }: { initial?: Zone[] }) {
  const [selected, setSelected] = useState<Zone[]>(initial);
  return (
    <MultiSelectField<Zone>
      label="Parcelle"
      items={zones}
      selected={selected}
      onChange={setSelected}
      getKey={(z) => z.id}
      getLabel={(z) => z.name}
      getSubtitle={(z) => `${z.area} ha`}
      placeholder="Choisir des parcelles…"
      summary={(items) => `${items.length} cultures`}
      testID="targets"
    />
  );
}

describe('MultiSelectField', () => {
  it('affiche le placeholder quand rien n’est sélectionné', () => {
    render(<Harness />);
    expect(screen.getByText('Choisir des parcelles…')).toBeOnTheScreen();
  });

  it('ouvre la modal et liste les items', () => {
    render(<Harness />);
    fireEvent.press(screen.getByTestId('targets'));
    expect(screen.getByTestId('targets-item-z1')).toBeOnTheScreen();
    expect(screen.getByTestId('targets-item-z2')).toBeOnTheScreen();
    expect(screen.getByTestId('targets-item-z3')).toBeOnTheScreen();
  });

  it('sélectionne plusieurs items et propage au VALIDER', () => {
    render(<Harness />);
    fireEvent.press(screen.getByTestId('targets'));
    fireEvent.press(screen.getByTestId('targets-item-z1'));
    fireEvent.press(screen.getByTestId('targets-item-z3'));
    fireEvent.press(screen.getByTestId('targets-validate'));

    // Modal fermée, déclencheur reflète la sélection (résumé custom).
    expect(screen.queryByTestId('targets-item-z1')).toBeNull();
    expect(screen.getByText('2 cultures')).toBeOnTheScreen();
  });

  it('désélectionne un item déjà coché', () => {
    render(<Harness initial={[zones[0]!, zones[1]!]} />);
    fireEvent.press(screen.getByTestId('targets'));
    fireEvent.press(screen.getByTestId('targets-item-z1')); // décoche z1
    fireEvent.press(screen.getByTestId('targets-validate'));
    expect(screen.getByText('1 cultures')).toBeOnTheScreen();
  });

  it('abandonne le brouillon au tap sur Annuler (pas de propagation)', () => {
    render(<Harness initial={[zones[0]!]} />);
    fireEvent.press(screen.getByTestId('targets'));
    fireEvent.press(screen.getByTestId('targets-item-z2')); // coche z2 (brouillon)
    fireEvent.press(screen.getByTestId('targets-close')); // Annuler

    // La sélection initiale (1) est conservée, z2 non ajouté.
    expect(screen.getByText('1 cultures')).toBeOnTheScreen();
  });

  it('filtre les items via la recherche', () => {
    render(<Harness />);
    fireEvent.press(screen.getByTestId('targets'));
    fireEvent.changeText(screen.getByTestId('targets-search'), 'myrm');
    expect(screen.queryByTestId('targets-item-z1')).toBeNull();
    expect(screen.getByTestId('targets-item-z2')).toBeOnTheScreen();
  });
});
