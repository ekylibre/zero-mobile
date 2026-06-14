import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';

import type { Product, Variant } from '@core/db/models';
import { initI18n } from '@core/i18n';
import type { SprayingInput } from '@domain/procedures/spraying';
import { parseSprayingHandlers } from '@domain/procedures/spraying-handlers';

import { InputsFieldArray } from '../InputsFieldArray';

initI18n();

// Handlers canoniques (population, net_volume, mass/volume_area_density…) tels
// qu'utilisés en production en l'absence de définition de procédure.
const HANDLERS = parseSprayingHandlers(undefined);

const products = [
  { id: 'p1', name: 'PRIAXOR EC', variety: null },
  { id: 'p2', name: 'OPUS', variety: null },
] as unknown as Product[];

const variants = [] as unknown as Variant[];

function row(overrides: Partial<SprayingInput> = {}): SprayingInput {
  return {
    product_id: 'p1',
    reference_name: 'plant_medicine',
    quantity_value: 0,
    quantity_handler: '',
    quantity_unit: '',
    ...overrides,
  };
}

// Harness contrôlé : InputsFieldArray est value/onChange, on lui adosse un état
// local pour observer add/remove/update comme en production.
function Harness({
  initial = [],
  totalAreaHectares = 0,
  productDefaultUnits,
}: {
  initial?: SprayingInput[];
  totalAreaHectares?: number;
  productDefaultUnits?: ReadonlyMap<string, string>;
}) {
  const [value, setValue] = useState<SprayingInput[]>(initial);
  return (
    <InputsFieldArray
      value={value}
      onChange={setValue}
      products={products}
      variants={variants}
      handlers={HANDLERS}
      totalAreaHectares={totalAreaHectares}
      productDefaultUnits={productDefaultUnits}
      testID="inputs"
    />
  );
}

describe('InputsFieldArray', () => {
  it('affiche l’état vide + le bouton ajouter quand aucune ligne', () => {
    render(<Harness />);
    expect(screen.getByText('Aucun intrant ajouté.')).toBeOnTheScreen();
    expect(screen.getByTestId('inputs-add')).toBeOnTheScreen();
    expect(screen.queryByTestId('inputs-row-0')).toBeNull();
  });

  it('ajoute une ligne au tap sur « + Ajouter un intrant »', () => {
    render(<Harness />);
    fireEvent.press(screen.getByTestId('inputs-add'));
    expect(screen.getByTestId('inputs-row-0')).toBeOnTheScreen();
  });

  it('supprime une ligne via la croix de la carte', () => {
    render(<Harness initial={[row()]} />);
    expect(screen.getByTestId('inputs-row-0')).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId('inputs-row-0-remove'));
    expect(screen.queryByTestId('inputs-row-0')).toBeNull();
  });

  it('utilise le nom du produit comme titre de carte', () => {
    render(<Harness initial={[row({ product_id: 'p1' })]} />);
    // Le nom apparaît à la fois en titre de carte et dans le déclencheur du
    // SelectField produit → on vérifie juste la présence.
    expect(screen.getAllByText('PRIAXOR EC').length).toBeGreaterThanOrEqual(1);
  });

  it('calcule le total à l’hectare (unité courte « l/ha »)', () => {
    render(
      <Harness
        initial={[
          row({
            quantity_value: 3,
            quantity_handler: 'volume_area_density',
            quantity_unit: 'l/ha',
          }),
        ]}
        totalAreaHectares={17.3}
      />,
    );
    // 3 l/ha × 17,3 ha = 51,9 l
    expect(screen.getByTestId('inputs-row-0-total')).toHaveTextContent('51,9 l au total');
  });

  it('calcule le total à l’hectare (unité canonique « liter_per_hectare »)', () => {
    render(
      <Harness
        initial={[
          row({
            quantity_value: 2,
            quantity_handler: 'volume_area_density',
            quantity_unit: 'liter_per_hectare',
          }),
        ]}
        totalAreaHectares={10}
      />,
    );
    // 2 × 10 = 20 ; l'unité de base est dérivée (« liter_per_hectare » → « liter »).
    expect(screen.getByTestId('inputs-row-0-total')).toHaveTextContent('20 liter au total');
  });

  it('n’affiche pas de total pour une quantité absolue (handler non surfacique)', () => {
    render(
      <Harness
        initial={[
          row({ quantity_value: 5, quantity_handler: 'net_volume', quantity_unit: 'liter' }),
        ]}
        totalAreaHectares={17.3}
      />,
    );
    expect(screen.queryByTestId('inputs-row-0-total')).toBeNull();
  });

  it('recalcule le total quand la quantité change (séparateur virgule)', () => {
    render(
      <Harness
        initial={[
          row({
            quantity_value: 0,
            quantity_handler: 'volume_area_density',
            quantity_unit: 'l/ha',
          }),
        ]}
        totalAreaHectares={10}
      />,
    );
    fireEvent.changeText(screen.getByTestId('inputs-row-0-quantity'), '2,5');
    expect(screen.getByTestId('inputs-row-0-total')).toHaveTextContent('25 l au total');
  });

  it('affiche l’unité en libellé FR court (liter_per_hectare → l/ha)', () => {
    render(
      <Harness
        initial={[
          row({
            quantity_value: 1,
            quantity_handler: 'volume_area_density',
            quantity_unit: 'liter_per_hectare',
          }),
        ]}
      />,
    );
    expect(screen.getByTestId('inputs-row-0-unit')).toHaveTextContent('l/ha');
  });

  it('garde la valeur brute si la clé i18n d’unité est absente (fallback)', () => {
    render(
      <Harness
        initial={[
          row({
            quantity_value: 1,
            quantity_handler: 'some_handler',
            quantity_unit: 'parsec',
          }),
        ]}
      />,
    );
    // Pas de clé `units.parsec` → fallback sur la valeur brute, on ne crash pas.
    expect(screen.getByTestId('inputs-row-0-unit')).toHaveTextContent('parsec');
  });

  it('pré-remplit handler + unité depuis productDefaultUnits au choix d’un produit', () => {
    render(
      <Harness
        initial={[row({ product_id: '', quantity_handler: '', quantity_unit: '' })]}
        productDefaultUnits={new Map([['p1', 'liter']])}
      />,
    );
    // Avant sélection : tiret d'unité.
    expect(screen.getByTestId('inputs-row-0-unit')).toHaveTextContent('—');

    // Ouvrir le sélecteur produit et choisir p1 (unité par défaut liter).
    fireEvent.press(screen.getByTestId('inputs-row-0-product'));
    fireEvent.press(screen.getByTestId('inputs-row-0-product-item-p1'));

    // L'unité passe à `l/ha` (handler volume_area_density pré-rempli).
    expect(screen.getByTestId('inputs-row-0-unit')).toHaveTextContent('l/ha');
  });

  it('écrase un handler choisi manuellement quand on change de produit', () => {
    render(
      <Harness
        initial={[
          row({
            product_id: 'p1',
            quantity_handler: 'net_volume',
            quantity_unit: 'liter',
          }),
        ]}
        productDefaultUnits={
          new Map([
            ['p1', 'liter'],
            ['p2', 'kilogram'],
          ])
        }
      />,
    );
    // État initial : unité brute « liter » (handler net_volume choisi à la main).
    expect(screen.getByTestId('inputs-row-0-unit')).toHaveTextContent('l');

    // Changer de produit → écrasement systématique avec la déduction (kg/ha).
    fireEvent.press(screen.getByTestId('inputs-row-0-product'));
    fireEvent.press(screen.getByTestId('inputs-row-0-product-item-p2'));
    expect(screen.getByTestId('inputs-row-0-unit')).toHaveTextContent('kg/ha');
  });

  it('laisse handler + unité vides si le produit choisi n’a pas d’unité connue', () => {
    render(<Harness initial={[row({ product_id: '' })]} productDefaultUnits={new Map([])} />);
    fireEvent.press(screen.getByTestId('inputs-row-0-product'));
    fireEvent.press(screen.getByTestId('inputs-row-0-product-item-p1'));
    // Aucun mapping → handler/unit restent vides.
    expect(screen.getByTestId('inputs-row-0-unit')).toHaveTextContent('—');
  });

  it('affiche errorMessage quand fourni', () => {
    render(
      <InputsFieldArray
        value={[]}
        onChange={jest.fn()}
        products={products}
        variants={variants}
        handlers={HANDLERS}
        errorMessage="Au moins 1 produit phytosanitaire requis."
        testID="inputs"
      />,
    );
    expect(screen.getByTestId('inputs-error')).toBeOnTheScreen();
    expect(screen.getByText('Au moins 1 produit phytosanitaire requis.')).toBeOnTheScreen();
  });
});
