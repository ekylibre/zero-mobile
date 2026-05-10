import { mapProcedureDto } from '../procedure';

describe('mapProcedureDto', () => {
  it('mappe les champs minimaux', () => {
    expect(
      mapProcedureDto({
        name: 'spraying',
      }),
    ).toEqual({
      name: 'spraying',
      labelFr: 'spraying',
      definition: { parameters: [] },
      updatedAtServer: 0,
    });
  });

  it('préfère label_fr puis label puis name', () => {
    expect(mapProcedureDto({ name: 'spraying', label_fr: 'Pulvérisation' }).labelFr).toBe(
      'Pulvérisation',
    );
    expect(mapProcedureDto({ name: 'sowing', label: 'Sowing' }).labelFr).toBe('Sowing');
    expect(mapProcedureDto({ name: 'harvesting' }).labelFr).toBe('harvesting');
  });

  it('parse updated_at en epoch ms', () => {
    const result = mapProcedureDto({
      name: 'spraying',
      updated_at: '2025-04-12T10:30:00Z',
    });
    expect(result.updatedAtServer).toBe(Date.UTC(2025, 3, 12, 10, 30, 0));
  });

  it('retourne 0 si updated_at est invalide', () => {
    expect(mapProcedureDto({ name: 'x', updated_at: 'pas-une-date' }).updatedAtServer).toBe(0);
  });

  it("garde le tableau parameters s'il existe", () => {
    const result = mapProcedureDto({
      name: 'spraying',
      parameters: [{ name: 'plant_medicine' }],
    });
    expect(result.definition.parameters).toEqual([{ name: 'plant_medicine' }]);
  });
});
