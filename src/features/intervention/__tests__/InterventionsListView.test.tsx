import { fireEvent, render, screen } from '@testing-library/react-native';

import type { Intervention, InterventionSyncState } from '@core/db/models';
import { initI18n } from '@core/i18n';

import { InterventionsListView, type InterventionsListViewProps } from '../InterventionsListView';

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

const noop = jest.fn();

function defaultProps(
  overrides: Partial<InterventionsListViewProps> = {},
): InterventionsListViewProps {
  return {
    interventions: [],
    procedureLabels: new Map(),
    pendingCount: 0,
    errorCount: 0,
    syncStatus: 'idle',
    syncError: null,
    syncBusy: false,
    lastSyncAt: null,
    refreshing: false,
    onRefresh: noop,
    onSync: noop,
    onItemPress: noop,
    onDelete: noop,
    onNew: noop,
    ...overrides,
  };
}

describe('InterventionsListView', () => {
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

    render(<InterventionsListView {...defaultProps({ interventions, procedureLabels: labels })} />);

    expect(screen.getByTestId('intervention-row-a')).toBeOnTheScreen();
    expect(screen.getByTestId('intervention-row-b')).toBeOnTheScreen();
    expect(screen.getByTestId('intervention-row-c')).toBeOnTheScreen();
    expect(screen.getAllByText('Pulvérisation').length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText('Synchronisée')).toBeOnTheScreen();
    expect(screen.getByText('À synchroniser')).toBeOnTheScreen();
    expect(screen.getByText('Erreur')).toBeOnTheScreen();
  });

  it('affiche le bandeau "N à synchroniser" quand pendingCount > 0', () => {
    render(
      <InterventionsListView
        {...defaultProps({
          interventions: [makeIntervention({ id: 'a', syncState: 'pending' })],
          pendingCount: 2,
        })}
      />,
    );

    expect(screen.getByTestId('pending-banner')).toBeOnTheScreen();
    expect(screen.getByText(/2 interventions à synchroniser/)).toBeOnTheScreen();
  });

  it('singularise correctement le bandeau pour 1 intervention', () => {
    render(
      <InterventionsListView
        {...defaultProps({
          interventions: [makeIntervention({ id: 'a', syncState: 'pending' })],
          pendingCount: 1,
        })}
      />,
    );

    expect(screen.getByText(/1 intervention à synchroniser/)).toBeOnTheScreen();
    expect(screen.queryByText(/interventions à/)).toBeNull();
  });

  it('cache le bandeau pending quand pendingCount = 0', () => {
    render(
      <InterventionsListView
        {...defaultProps({
          interventions: [makeIntervention({ id: 'a', syncState: 'synced' })],
        })}
      />,
    );

    expect(screen.queryByTestId('pending-banner')).toBeNull();
  });

  it("affiche l'EmptyState quand la liste est vide, avec le CTA", () => {
    const onNew = jest.fn();

    render(<InterventionsListView {...defaultProps({ onNew })} />);

    expect(screen.getByText("Aucune intervention pour l'instant.")).toBeOnTheScreen();
    expect(screen.queryByTestId('interventions-new-fab')).toBeNull();

    fireEvent.press(screen.getByTestId('empty-new-action'));
    expect(onNew).toHaveBeenCalledTimes(1);
  });

  it("appelle onItemPress avec l'intervention quand on tape une ligne", () => {
    const onItemPress = jest.fn();
    const target = makeIntervention({ id: 'b', syncState: 'pending' });

    render(<InterventionsListView {...defaultProps({ interventions: [target], onItemPress })} />);

    fireEvent.press(screen.getByTestId('intervention-row-b'));
    expect(onItemPress).toHaveBeenCalledWith(target);
  });

  it('affiche Supprimer pour une intervention non synchronisée et appelle onDelete', () => {
    const onDelete = jest.fn();
    const target = makeIntervention({ id: 'c', syncState: 'pending' });

    render(<InterventionsListView {...defaultProps({ interventions: [target], onDelete })} />);

    fireEvent.press(screen.getByTestId('intervention-row-c-delete'));
    expect(onDelete).toHaveBeenCalledWith(target);
  });

  it("n'affiche pas Supprimer pour une intervention synchronisée", () => {
    const target = makeIntervention({ id: 'd', syncState: 'synced' });

    render(<InterventionsListView {...defaultProps({ interventions: [target] })} />);

    expect(screen.queryByTestId('intervention-row-d-delete')).toBeNull();
  });

  it('affiche le FAB "+" quand la liste n\'est pas vide', () => {
    const onNew = jest.fn();

    render(
      <InterventionsListView
        {...defaultProps({
          interventions: [makeIntervention({ id: 'a', syncState: 'synced' })],
          onNew,
        })}
      />,
    );

    fireEvent.press(screen.getByTestId('interventions-new-fab'));
    expect(onNew).toHaveBeenCalledTimes(1);
  });

  // ---- P6.4 : header sync + bandeaux d'erreur ----

  it('affiche le header sync avec status idle et "jamais synchronisé"', () => {
    render(<InterventionsListView {...defaultProps()} />);

    expect(screen.getByTestId('sync-header')).toBeOnTheScreen();
    expect(screen.getByText('Prêt')).toBeOnTheScreen();
    expect(screen.getByText(/Jamais synchronisé/i)).toBeOnTheScreen();
    expect(screen.getByTestId('sync-button')).toBeOnTheScreen();
  });

  it('reflète le syncStatus dans le header (pulling, pushing, error)', () => {
    const { rerender } = render(
      <InterventionsListView {...defaultProps({ syncStatus: 'pulling' })} />,
    );
    expect(screen.getByText(/Téléchargement du catalogue/i)).toBeOnTheScreen();

    rerender(<InterventionsListView {...defaultProps({ syncStatus: 'pushing' })} />);
    expect(screen.getByText(/Envoi des interventions/i)).toBeOnTheScreen();

    rerender(<InterventionsListView {...defaultProps({ syncStatus: 'error' })} />);
    expect(screen.getByText(/Échec de la synchronisation/i)).toBeOnTheScreen();
  });

  it('affiche le timestamp formaté quand lastSyncAt est fourni', () => {
    const at = new Date('2026-04-12T08:30:00Z').getTime();
    render(<InterventionsListView {...defaultProps({ lastSyncAt: at })} />);
    expect(screen.getByText(/Dernière sync/i)).toBeOnTheScreen();
  });

  it('appelle onSync au tap sur le bouton Synchroniser', () => {
    const onSync = jest.fn();
    render(<InterventionsListView {...defaultProps({ onSync })} />);

    fireEvent.press(screen.getByTestId('sync-button'));
    expect(onSync).toHaveBeenCalledTimes(1);
  });

  it('désactive le bouton Synchroniser quand syncBusy=true', () => {
    render(<InterventionsListView {...defaultProps({ syncBusy: true })} />);

    const button = screen.getByTestId('sync-button');
    expect(button.props.accessibilityState?.disabled).toBe(true);
  });

  it("affiche le bandeau d'erreur persistant quand errorCount > 0", () => {
    render(<InterventionsListView {...defaultProps({ errorCount: 3 })} />);

    expect(screen.getByTestId('error-banner')).toBeOnTheScreen();
    expect(screen.getByText(/3 interventions en erreur/i)).toBeOnTheScreen();
  });

  it("singularise le bandeau d'erreur pour 1 intervention", () => {
    render(<InterventionsListView {...defaultProps({ errorCount: 1 })} />);

    expect(screen.getByText(/1 intervention en erreur/i)).toBeOnTheScreen();
  });

  it('affiche le bandeau de syncError quand fourni (échec de cycle)', () => {
    render(<InterventionsListView {...defaultProps({ syncError: 'Catalogue : offline' })} />);

    expect(screen.getByTestId('sync-error-banner')).toBeOnTheScreen();
    expect(screen.getByText('Catalogue : offline')).toBeOnTheScreen();
  });
});
