import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import type { CultivableZone, Product, Variant } from '@core/db/models';
import { initI18n } from '@core/i18n';

import { SprayingFormView } from '../SprayingFormView';

initI18n();

function makeZone(
  overrides: Partial<CultivableZone> & { id: string; name: string },
): CultivableZone {
  return {
    serverId: 1,
    geometry: null,
    areaHectares: null,
    updatedAtServer: 0,
    ...overrides,
  } as unknown as CultivableZone;
}

function makeMatter(id: string, name: string): Product {
  return {
    id,
    name,
    serverId: 0,
    productType: 'matters',
    variantId: null,
    variety: null,
    updatedAtServer: 0,
  } as unknown as Product;
}

const defaultProps = {
  cultivableZones: [] as CultivableZone[],
  workers: [] as Product[],
  equipments: [] as Product[],
  matters: [] as Product[],
  variants: [] as Variant[],
};

describe('SprayingFormView', () => {
  it('rend toutes les sections du formulaire', () => {
    render(<SprayingFormView {...defaultProps} onSubmit={jest.fn()} />);

    // Certains libellés (Conducteur, Parcelle, Pulvérisateur) apparaissent à
    // la fois comme titre de section et comme label du SelectField → on
    // accepte les occurrences multiples mais on vérifie la présence.
    expect(screen.getByText('Dates')).toBeOnTheScreen();
    expect(screen.getAllByText('Parcelle cible').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Conducteur').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Produits phytosanitaires')).toBeOnTheScreen();
    expect(screen.getAllByText('Pulvérisateur').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Notes')).toBeOnTheScreen();
  });

  it('rend les déclencheurs date début / date fin / picker parcelle / doer / tool', () => {
    render(<SprayingFormView {...defaultProps} onSubmit={jest.fn()} />);

    expect(screen.getByTestId('spraying-started-at')).toBeOnTheScreen();
    expect(screen.getByTestId('spraying-stopped-at')).toBeOnTheScreen();
    expect(screen.getByTestId('spraying-target-select')).toBeOnTheScreen();
    expect(screen.getByTestId('spraying-doer-select')).toBeOnTheScreen();
    expect(screen.getByTestId('spraying-tool-select')).toBeOnTheScreen();
  });

  it("rend la section intrants avec son bouton Ajouter et l'état vide", () => {
    render(<SprayingFormView {...defaultProps} onSubmit={jest.fn()} />);

    expect(screen.getByTestId('spraying-inputs-add')).toBeOnTheScreen();
    expect(screen.getByText(/Aucun intrant ajouté/i)).toBeOnTheScreen();
  });

  it('ajoute un intrant et permet de choisir un produit phytosanitaire', () => {
    const matters = [makeMatter('mat-1', 'Bouillie bordelaise')];
    render(<SprayingFormView {...defaultProps} matters={matters} onSubmit={jest.fn()} />);

    fireEvent.press(screen.getByTestId('spraying-inputs-add'));
    fireEvent.press(screen.getByTestId('spraying-inputs-row-0-product'));
    fireEvent.press(screen.getByTestId('spraying-inputs-row-0-product-item-mat-1'));

    expect(screen.getByText('Bouillie bordelaise')).toBeOnTheScreen();
  });

  it("permet d'éditer le champ Notes", () => {
    render(<SprayingFormView {...defaultProps} onSubmit={jest.fn()} />);

    const input = screen.getByTestId('spraying-description-input');
    fireEvent.changeText(input, 'Conditions humides');
    expect(input.props.value).toBe('Conditions humides');
  });

  it('permet de sélectionner une parcelle via le SelectField', () => {
    const zones = [
      makeZone({ id: 'zone-a', name: 'Parcelle Nord', areaHectares: 4.5 }),
      makeZone({ id: 'zone-b', name: 'Parcelle Sud' }),
    ];

    render(<SprayingFormView {...defaultProps} cultivableZones={zones} onSubmit={jest.fn()} />);

    fireEvent.press(screen.getByTestId('spraying-target-select'));
    fireEvent.press(screen.getByTestId('spraying-target-select-item-zone-a'));

    expect(screen.getByText('Parcelle Nord')).toBeOnTheScreen();
    expect(screen.getByText('4,5 ha')).toBeOnTheScreen();
  });

  it("propose le placeholder dédié quand aucune parcelle n'est dispo", () => {
    render(<SprayingFormView {...defaultProps} onSubmit={jest.fn()} />);

    fireEvent.press(screen.getByTestId('spraying-target-select'));
    expect(screen.getByText(/Aucune parcelle dans le catalogue/i)).toBeOnTheScreen();
  });

  it("affiche un bandeau d'incomplétion au tap sur Enregistrer (sections vides)", async () => {
    const onSubmit = jest.fn();
    render(<SprayingFormView {...defaultProps} onSubmit={onSubmit} />);

    await act(async () => {
      fireEvent.press(screen.getByTestId('spraying-save-button'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('spraying-incomplete-warning')).toBeOnTheScreen();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("affiche le bandeau d'erreur quand submitError est fourni", () => {
    render(<SprayingFormView {...defaultProps} onSubmit={jest.fn()} submitError="Disque plein" />);

    expect(screen.getByTestId('spraying-submit-error')).toBeOnTheScreen();
    expect(screen.getByText('Disque plein')).toBeOnTheScreen();
  });

  it('désactive le bouton Enregistrer quand submitting est vrai', () => {
    render(<SprayingFormView {...defaultProps} onSubmit={jest.fn()} submitting />);

    const button = screen.getByTestId('spraying-save-button');
    expect(button.props.accessibilityState?.disabled).toBe(true);
    expect(screen.getByText('Enregistrement…')).toBeOnTheScreen();
  });
});
