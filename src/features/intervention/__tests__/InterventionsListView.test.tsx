import { fireEvent, render, screen } from '@testing-library/react-native';

import type { Intervention, InterventionSyncState } from '@core/db/models';
import { initI18n } from '@core/i18n';

import { InterventionsListView } from '../InterventionsListView';

initI18n();

function makeIntervention(
  overrides: Partial<Intervention> & { id: string; syncState: InterventionSyncState },
): Intervention {
  const base: Partial<Intervention> = {
    procedureName: 'spraying',
    startedAt: new Date('2025-04-12T08:00:00Z'),
    stoppedAt: new Date('2025-04-12T10:00:00Z'),
    description: null,
    syncErrorMessage: null,
    ...overrides,
  };
  return base as unknown as Intervention;
}

describe('InterventionsListView', () => {
  const noop = jest.fn();

  beforeEach(() => {
    noop.mockClear();
  });

  it('rend les 3 interventions avec leurs badges', () => {
    const interventions = [
      makeIntervention({ id: 'a', syncState: 'synced' }),
      makeIntervention({ id: 'b', syncState: 'pending' }),
      makeIntervention({ id: 'c', syncState: 'error', syncErrorMessage: 'boom' }),
    ];
    const labels = new Map([['spraying', 'Pulvérisation']]);

    render(
      <InterventionsListView
        interventions={interventions}
        procedureLabels={labels}
        pendingCount={2}
        refreshing={false}
        onRefresh={noop}
        onItemPress={noop}
        onNew={noop}
      />,
    );

    // 3 lignes de la liste, chacune avec son testID
    expect(screen.getByTestId('intervention-row-a')).toBeOnTheScreen();
    expect(screen.getByTestId('intervention-row-b')).toBeOnTheScreen();
    expect(screen.getByTestId('intervention-row-c')).toBeOnTheScreen();

    // Le label de la procédure est résolu via la map
    expect(screen.getAllByText('Pulvérisation').length).toBeGreaterThanOrEqual(3);

    // Les badges affichent les libellés FR (1 par ligne)
    expect(screen.getByText('Synchronisée')).toBeOnTheScreen();
    expect(screen.getByText('À synchroniser')).toBeOnTheScreen();
    expect(screen.getByText('Erreur')).toBeOnTheScreen();
  });

  it('affiche le bandeau "N à synchroniser" quand pendingCount > 0', () => {
    render(
      <InterventionsListView
        interventions={[makeIntervention({ id: 'a', syncState: 'pending' })]}
        procedureLabels={new Map()}
        pendingCount={2}
        refreshing={false}
        onRefresh={noop}
        onItemPress={noop}
        onNew={noop}
      />,
    );

    expect(screen.getByTestId('pending-banner')).toBeOnTheScreen();
    expect(screen.getByText(/2 interventions à synchroniser/)).toBeOnTheScreen();
  });

  it('singularise correctement le bandeau pour 1 intervention', () => {
    render(
      <InterventionsListView
        interventions={[makeIntervention({ id: 'a', syncState: 'pending' })]}
        procedureLabels={new Map()}
        pendingCount={1}
        refreshing={false}
        onRefresh={noop}
        onItemPress={noop}
        onNew={noop}
      />,
    );

    expect(screen.getByText(/1 intervention à synchroniser/)).toBeOnTheScreen();
    expect(screen.queryByText(/interventions à/)).toBeNull();
  });

  it('cache le bandeau quand pendingCount = 0', () => {
    render(
      <InterventionsListView
        interventions={[makeIntervention({ id: 'a', syncState: 'synced' })]}
        procedureLabels={new Map()}
        pendingCount={0}
        refreshing={false}
        onRefresh={noop}
        onItemPress={noop}
        onNew={noop}
      />,
    );

    expect(screen.queryByTestId('pending-banner')).toBeNull();
  });

  it("affiche l'EmptyState quand la liste est vide, avec le CTA", () => {
    const onNew = jest.fn();

    render(
      <InterventionsListView
        interventions={[]}
        procedureLabels={new Map()}
        pendingCount={0}
        refreshing={false}
        onRefresh={noop}
        onItemPress={noop}
        onNew={onNew}
      />,
    );

    expect(screen.getByText("Aucune intervention pour l'instant.")).toBeOnTheScreen();
    expect(screen.queryByTestId('interventions-new-fab')).toBeNull();

    fireEvent.press(screen.getByTestId('empty-new-action'));
    expect(onNew).toHaveBeenCalledTimes(1);
  });

  it("appelle onItemPress avec l'intervention quand on tape une ligne", () => {
    const onItemPress = jest.fn();
    const target = makeIntervention({ id: 'b', syncState: 'pending' });

    render(
      <InterventionsListView
        interventions={[target]}
        procedureLabels={new Map()}
        pendingCount={1}
        refreshing={false}
        onRefresh={noop}
        onItemPress={onItemPress}
        onNew={noop}
      />,
    );

    fireEvent.press(screen.getByTestId('intervention-row-b'));
    expect(onItemPress).toHaveBeenCalledWith(target);
  });

  it('affiche le FAB "+" quand la liste n\'est pas vide', () => {
    const onNew = jest.fn();

    render(
      <InterventionsListView
        interventions={[makeIntervention({ id: 'a', syncState: 'synced' })]}
        procedureLabels={new Map()}
        pendingCount={0}
        refreshing={false}
        onRefresh={noop}
        onItemPress={noop}
        onNew={onNew}
      />,
    );

    fireEvent.press(screen.getByTestId('interventions-new-fab'));
    expect(onNew).toHaveBeenCalledTimes(1);
  });
});
