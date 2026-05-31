import { fireEvent, render, screen } from '@testing-library/react-native';

import type { Intervention } from '@core/db/models';
import { initI18n } from '@core/i18n';

import { InterventionListItem, relativeDateLabel } from '../InterventionListItem';

initI18n();

function makeIntervention(overrides: Partial<Intervention> = {}): Intervention {
  return {
    id: 'iv-1',
    procedureName: 'spraying',
    startedAt: new Date(),
    description: null,
    syncState: 'pending',
    ...overrides,
  } as unknown as Intervention;
}

describe('relativeDateLabel', () => {
  const t = (key: string) => key; // identité : on vérifie la clé choisie

  it('retourne la clé « today » le jour même', () => {
    const now = new Date('2026-05-31T12:00:00');
    const date = new Date('2026-05-31T08:00:00');
    expect(relativeDateLabel(date, now, 'fr', t)).toBe('interventions.list.today');
  });

  it('retourne la clé « yesterday » la veille', () => {
    const now = new Date('2026-05-31T12:00:00');
    const date = new Date('2026-05-30T22:00:00');
    expect(relativeDateLabel(date, now, 'fr', t)).toBe('interventions.list.yesterday');
  });

  it('retourne une date formatée au-delà de la veille', () => {
    const now = new Date('2026-05-31T12:00:00');
    const date = new Date('2026-04-12T09:00:00');
    const label = relativeDateLabel(date, now, 'fr', t);
    expect(label).not.toBe('interventions.list.today');
    expect(label).not.toBe('interventions.list.yesterday');
    expect(label).toMatch(/2026/);
  });
});

describe('InterventionListItem', () => {
  it('affiche le libellé de procédure et la date relative « aujourd’hui »', () => {
    render(
      <InterventionListItem intervention={makeIntervention()} procedureLabel="Pulvérisation" />,
    );
    expect(screen.getByText('Pulvérisation')).toBeOnTheScreen();
    expect(screen.getByText("aujourd'hui")).toBeOnTheScreen();
  });

  it('affiche le résumé des cibles quand fourni', () => {
    render(
      <InterventionListItem
        intervention={makeIntervention()}
        procedureLabel="Pulvérisation"
        targetSummary="2 cultures • 4,3 ha"
      />,
    );
    expect(screen.getByText('2 cultures • 4,3 ha')).toBeOnTheScreen();
  });

  it('montre « Supprimer » sur une intervention non synchronisée et déclenche onDelete', () => {
    const onDelete = jest.fn();
    render(
      <InterventionListItem
        intervention={makeIntervention({ syncState: 'pending' })}
        onDelete={onDelete}
      />,
    );
    fireEvent.press(screen.getByTestId('intervention-row-iv-1-delete'));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('masque « Supprimer » sur une intervention synchronisée', () => {
    render(
      <InterventionListItem
        intervention={makeIntervention({ syncState: 'synced' })}
        onDelete={jest.fn()}
      />,
    );
    expect(screen.queryByTestId('intervention-row-iv-1-delete')).toBeNull();
  });

  it('déclenche onPress au tap sur la ligne', () => {
    const onPress = jest.fn();
    render(<InterventionListItem intervention={makeIntervention()} onPress={onPress} />);
    fireEvent.press(screen.getByTestId('intervention-row-iv-1'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
