import { mapInterventionDto } from '../intervention';

describe('mapInterventionDto', () => {
  it('utilise provider.id comme client_uuid si disponible', () => {
    const result = mapInterventionDto(
      {
        id: 100,
        procedure_name: 'spraying',
        started_at: '2025-04-12T08:00:00Z',
        stopped_at: '2025-04-12T10:00:00Z',
        provider: { vendor: 'ekylibre-mobile', id: 'uuid-from-provider' },
      },
      'fallback-uuid',
    );

    expect(result.clientUuid).toBe('uuid-from-provider');
    expect(result.serverId).toBe(100);
    expect(result.syncState).toBe('synced');
  });

  it('utilise le fallback UUID si provider absent', () => {
    const result = mapInterventionDto(
      {
        id: 200,
        procedure_name: 'spraying',
        started_at: '2025-04-12T08:00:00Z',
        stopped_at: '2025-04-12T10:00:00Z',
      },
      'fallback-uuid',
    );

    expect(result.clientUuid).toBe('fallback-uuid');
  });

  it('calcule whole/working duration depuis started_at/stopped_at si non fournis', () => {
    const result = mapInterventionDto(
      {
        id: 1,
        procedure_name: 'spraying',
        started_at: '2025-04-12T08:00:00Z',
        stopped_at: '2025-04-12T10:00:00Z',
      },
      'u',
    );
    // 2 heures = 7200 secondes
    expect(result.wholeDurationSeconds).toBe(7200);
    expect(result.workingDurationSeconds).toBe(7200);
  });

  it('respecte whole_duration et working_duration explicites', () => {
    const result = mapInterventionDto(
      {
        id: 1,
        procedure_name: 'spraying',
        started_at: '2025-04-12T08:00:00Z',
        stopped_at: '2025-04-12T10:00:00Z',
        whole_duration: 7000,
        working_duration: 3600,
      },
      'u',
    );
    expect(result.wholeDurationSeconds).toBe(7000);
    expect(result.workingDurationSeconds).toBe(3600);
  });
});
