import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';

import type { Product, Variant } from '@core/db/models';
import { initI18n } from '@core/i18n';
import type { SprayingInput } from '@domain/procedures/spraying';
import { parseSprayingHandlers } from '@domain/procedures/spraying-handlers';

import { InputsFieldArray } from '../InputsFieldArray';

initI18n();

// Liste canonique (population, net_mass, net_volume, mass/volume_area_density…).
const HANDLERS = parseSprayingHandlers(undefined);

function makeProduct(id: string, name: string): Product {
  return {
    id,
    name,
    serverId: Number(id.replace(/\D/g, '')) || 0,
    productType: 'matters',
    variantId: null,
    variety: null,
    updatedAtServer: 0,
  } as unknown as Product;
}

function makeVariant(id: string, name: string, unit?: string): Variant {
  return {
    id,
    name,
    serverId: Number(id.replace(/\D/g, '')) || 0,
    category: 'plant_medicine',
    unit: unit ?? null,
    updatedAtServer: 0,
  } as unknown as Variant;
}

const products: Product[] = [
  makeProduct('prod-1', 'Bouillie bordelaise'),
  makeProduct('prod-2', 'Glyphosate'),
];

const variants: Variant[] = [
  makeVariant('var-1', 'Bouillie 20%', 'l'),
  makeVariant('var-2', 'Bouillie 50%'),
];

// Harnais stateful : on simule le parent RHF en gérant la valeur via
// useState. C'est ce dont InputsFieldArray a besoin pour fonctionner
// (composant contrôlé) — sans ça, le composant garde la prop initiale au
// re-render et les interactions chaînées ne reflètent pas les changements.
function renderField(initial: SprayingInput[] = []) {
  const captured = { value: initial };
  function Harness() {
    const [value, setValue] = useState<SprayingInput[]>(initial);
    return (
      <InputsFieldArray
        value={value}
        onChange={(next) => {
          captured.value = next;
          setValue(next);
        }}
        products={products}
        variants={variants}
        handlers={HANDLERS}
        testID="inputs"
      />
    );
  }
  const utils = render(<Harness />);
  return Object.assign(utils, { captured });
}

describe('InputsFieldArray', () => {
  it("affiche l'état vide quand aucun intrant", () => {
    renderField();
    expect(screen.getByText(/Aucun intrant ajouté/i)).toBeOnTheScreen();
  });

  it("ajoute une ligne au tap sur 'Ajouter un intrant'", () => {
    const view = renderField();
    fireEvent.press(screen.getByTestId('inputs-add'));

    expect(view.captured.value).toHaveLength(1);
    expect(view.captured.value[0]).toMatchObject({
      product_id: '',
      reference_name: 'plant_medicine',
      quantity_value: 0,
      quantity_handler: '',
      quantity_unit: '',
    });
  });

  it('rend une ligne par intrant existant avec testIDs indexés', () => {
    renderField([
      {
        product_id: 'prod-1',
        reference_name: 'plant_medicine',
        quantity_value: 1,
        quantity_handler: 'population',
        quantity_unit: 'unity',
      },
      {
        product_id: 'prod-2',
        reference_name: 'plant_medicine',
        quantity_value: 2,
        quantity_handler: 'net_volume',
        quantity_unit: 'liter',
      },
    ]);

    expect(screen.getByText('Intrant 1')).toBeOnTheScreen();
    expect(screen.getByText('Intrant 2')).toBeOnTheScreen();
    expect(screen.getByTestId('inputs-row-0-product')).toBeOnTheScreen();
    expect(screen.getByTestId('inputs-row-1-product')).toBeOnTheScreen();
  });

  it('retire une ligne au tap sur Retirer', () => {
    const view = renderField([
      {
        product_id: 'prod-1',
        reference_name: 'plant_medicine',
        quantity_value: 1,
        quantity_handler: 'population',
        quantity_unit: 'unity',
      },
      {
        product_id: 'prod-2',
        reference_name: 'plant_medicine',
        quantity_value: 2,
        quantity_handler: 'net_volume',
        quantity_unit: 'liter',
      },
    ]);

    fireEvent.press(screen.getByTestId('inputs-row-0-remove'));
    expect(view.captured.value).toHaveLength(1);
    expect(view.captured.value[0]?.product_id).toBe('prod-2');
  });

  it('met à jour quantity_value via la saisie numérique (point ou virgule)', () => {
    const view = renderField([
      {
        product_id: 'prod-1',
        reference_name: 'plant_medicine',
        quantity_value: 0,
        quantity_handler: 'population',
        quantity_unit: 'unity',
      },
    ]);

    fireEvent.changeText(screen.getByTestId('inputs-row-0-quantity'), '2,5');
    expect(view.captured.value[0]?.quantity_value).toBe(2.5);

    fireEvent.changeText(screen.getByTestId('inputs-row-0-quantity'), '3.75');
    expect(view.captured.value[0]?.quantity_value).toBe(3.75);
  });

  it("remet quantity_value à 0 si la saisie n'est pas un nombre", () => {
    const view = renderField([
      {
        product_id: 'prod-1',
        reference_name: 'plant_medicine',
        quantity_value: 5,
        quantity_handler: 'population',
        quantity_unit: 'unity',
      },
    ]);

    fireEvent.changeText(screen.getByTestId('inputs-row-0-quantity'), 'abc');
    expect(view.captured.value[0]?.quantity_value).toBe(0);
  });

  it("permet de sélectionner un produit, et l'affiche dans le déclencheur", () => {
    const view = renderField([
      {
        product_id: '',
        reference_name: 'plant_medicine',
        quantity_value: 0,
        quantity_handler: '',
        quantity_unit: '',
      },
    ]);

    fireEvent.press(screen.getByTestId('inputs-row-0-product'));
    fireEvent.press(screen.getByTestId('inputs-row-0-product-item-prod-2'));

    expect(view.captured.value[0]?.product_id).toBe('prod-2');
  });

  it('sélectionner un handler fixe automatiquement le quantity_handler ET son unité', () => {
    const view = renderField([
      {
        product_id: 'prod-1',
        reference_name: 'plant_medicine',
        quantity_value: 1,
        quantity_handler: '',
        quantity_unit: '',
      },
    ]);

    fireEvent.press(screen.getByTestId('inputs-row-0-handler'));
    fireEvent.press(screen.getByTestId('inputs-row-0-handler-item-volume_area_density'));

    expect(view.captured.value[0]?.quantity_handler).toBe('volume_area_density');
    expect(view.captured.value[0]?.quantity_unit).toBe('liter_per_hectare');
  });

  it("affiche l'unité du handler en lecture seule (pas de saisie libre)", () => {
    renderField([
      {
        product_id: 'prod-1',
        reference_name: 'plant_medicine',
        quantity_value: 1,
        quantity_handler: 'mass_area_density',
        quantity_unit: 'kilogram_per_hectare',
      },
    ]);

    const unit = screen.getByTestId('inputs-row-0-unit');
    expect(unit).toBeOnTheScreen();
    expect(unit.props.children).toBe('kilogram_per_hectare');
    // Le champ n'est plus un TextInput éditable.
    expect(unit.props.onChangeText).toBeUndefined();
  });

  it('affiche un tiret quand aucune unité (handler non encore choisi)', () => {
    renderField([
      {
        product_id: 'prod-1',
        reference_name: 'plant_medicine',
        quantity_value: 1,
        quantity_handler: '',
        quantity_unit: '',
      },
    ]);

    expect(screen.getByTestId('inputs-row-0-unit').props.children).toBe('—');
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
