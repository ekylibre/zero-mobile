import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import type { CultivableZone, Product, Variant } from '@core/db/models';
import { initI18n } from '@core/i18n';
import { parseSprayingHandlers } from '@domain/procedures/spraying-handlers';

import { SprayingFormView } from '../SprayingFormView';

initI18n();

// Handlers canoniques : garantit que l'unité auto-assignée à la sélection d'une
// mesure correspond à `SPRAYING_HANDLER_UNITS` (sinon le superRefine Zod rejette
// et onSubmit n'est jamais appelé).
const handlers = parseSprayingHandlers(undefined);

const cultivableZones = [
  { id: 'z1', name: 'La Renambrie', areaHectares: 4 },
  { id: 'z2', name: 'Myrmidon', areaHectares: 2 },
] as unknown as CultivableZone[];

const workers = [{ id: 'w1', name: 'Jean Tracteur', variety: null }] as unknown as Product[];
const equipments = [{ id: 'e1', name: 'Pulvé 2000', variety: null }] as unknown as Product[];
const matters = [{ id: 'm1', name: 'PRIAXOR EC', variety: null }] as unknown as Product[];
const variants = [] as unknown as Variant[];

function renderForm(overrides: Partial<React.ComponentProps<typeof SprayingFormView>> = {}) {
  const onSubmit = jest.fn();
  const onCancel = jest.fn();
  const utils = render(
    <SprayingFormView
      cultivableZones={cultivableZones}
      workers={workers}
      equipments={equipments}
      matters={matters}
      variants={variants}
      handlers={handlers}
      onSubmit={onSubmit}
      onCancel={onCancel}
      {...overrides}
    />,
  );
  return { ...utils, onSubmit, onCancel };
}

describe('SprayingFormView', () => {
  it('rend les en-têtes de toutes les sections', () => {
    renderForm();
    expect(screen.getByText('Dates')).toBeOnTheScreen();
    expect(screen.getByText('Parcelle cible')).toBeOnTheScreen();
    // « Conducteur » / « Pulvérisateur » apparaissent en titre de section ET en
    // label du SelectField (section dépliée par défaut).
    expect(screen.getAllByText('Conducteur').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Produits phytosanitaires')).toBeOnTheScreen();
    expect(screen.getAllByText('Pulvérisateur').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Notes')).toBeOnTheScreen();
  });

  it('replie « Dates » par défaut et la déplie au tap', () => {
    renderForm();
    expect(screen.queryByTestId('spraying-started-at')).toBeNull();
    fireEvent.press(screen.getByTestId('spraying-section-dates-header'));
    expect(screen.getByTestId('spraying-started-at')).toBeOnTheScreen();
  });

  it('déplie « Parcelle cible » par défaut (champ requis visible)', () => {
    renderForm();
    expect(screen.getByTestId('spraying-target-select')).toBeOnTheScreen();
  });

  it('met à jour le résumé de la section cible après sélection', () => {
    renderForm();
    fireEvent.press(screen.getByTestId('spraying-target-select'));
    fireEvent.press(screen.getByTestId('spraying-target-select-item-z1'));
    fireEvent.press(screen.getByTestId('spraying-target-select-validate'));
    // Le résumé apparaît dans l'en-tête de section ET dans le déclencheur du champ.
    expect(screen.getAllByText('1 culture • 4 ha').length).toBeGreaterThanOrEqual(1);
  });

  it('résume plusieurs cibles (multi-cibles) avec surface cumulée', () => {
    renderForm();
    fireEvent.press(screen.getByTestId('spraying-target-select'));
    fireEvent.press(screen.getByTestId('spraying-target-select-item-z1')); // 4 ha
    fireEvent.press(screen.getByTestId('spraying-target-select-item-z2')); // 2 ha
    fireEvent.press(screen.getByTestId('spraying-target-select-validate'));
    expect(screen.getAllByText('2 cultures • 6 ha').length).toBeGreaterThanOrEqual(1);
  });

  it('appelle onCancel au tap sur Annuler', () => {
    const { onCancel } = renderForm();
    fireEvent.press(screen.getByTestId('spraying-cancel-button'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('désactive Enregistrer quand submitting', () => {
    renderForm({ submitting: true });
    expect(screen.getByTestId('spraying-save-button').props.accessibilityState?.disabled).toBe(
      true,
    );
    expect(screen.getByText('Enregistrement…')).toBeOnTheScreen();
  });

  it('affiche le bandeau d’erreur quand submitError est fourni', () => {
    renderForm({ submitError: 'Disque plein' });
    expect(screen.getByTestId('spraying-submit-error')).toBeOnTheScreen();
    expect(screen.getByText('Disque plein')).toBeOnTheScreen();
  });

  it('affiche le bandeau « incomplet » à la soumission d’un formulaire vide', async () => {
    const { onSubmit } = renderForm();
    fireEvent.press(screen.getByTestId('spraying-save-button'));
    expect(await screen.findByTestId('spraying-incomplete-warning')).toBeOnTheScreen();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('soumet une intervention complète via onSubmit', async () => {
    const { onSubmit } = renderForm();

    // Cible (modal multi : sélectionner puis valider)
    fireEvent.press(screen.getByTestId('spraying-target-select'));
    fireEvent.press(screen.getByTestId('spraying-target-select-item-z1'));
    fireEvent.press(screen.getByTestId('spraying-target-select-validate'));

    // Conducteur
    fireEvent.press(screen.getByTestId('spraying-doer-select'));
    fireEvent.press(screen.getByTestId('spraying-doer-select-item-w1'));

    // Intrant : ajouter une ligne, choisir produit + mesure + quantité
    fireEvent.press(screen.getByTestId('spraying-inputs-add'));
    fireEvent.press(screen.getByTestId('spraying-inputs-row-0-product'));
    fireEvent.press(screen.getByTestId('spraying-inputs-row-0-product-item-m1'));
    fireEvent.press(screen.getByTestId('spraying-inputs-row-0-handler'));
    fireEvent.press(screen.getByTestId('spraying-inputs-row-0-handler-item-volume_area_density'));
    fireEvent.changeText(screen.getByTestId('spraying-inputs-row-0-quantity'), '3');

    // Pulvérisateur
    fireEvent.press(screen.getByTestId('spraying-tool-select'));
    fireEvent.press(screen.getByTestId('spraying-tool-select-item-e1'));

    fireEvent.press(screen.getByTestId('spraying-save-button'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const submitted = onSubmit.mock.calls[0][0];
    expect(submitted).toEqual(
      expect.objectContaining({
        procedure_name: 'spraying',
        targets: [{ cultivable_zone_id: 'z1', reference_name: 'cultivation' }],
        doers: [{ product_id: 'w1', reference_name: 'driver' }],
        tools: [{ product_id: 'e1', reference_name: 'sprayer' }],
      }),
    );
    expect(submitted.inputs).toHaveLength(1);
    expect(submitted.inputs[0]).toEqual(
      expect.objectContaining({
        product_id: 'm1',
        quantity_value: 3,
        quantity_handler: 'volume_area_density',
      }),
    );
  });
});
