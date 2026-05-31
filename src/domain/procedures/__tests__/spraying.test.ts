import { sprayingInterventionSchema, type SprayingIntervention } from '../spraying';

function makeValidInput(overrides: Partial<SprayingIntervention> = {}): unknown {
  return {
    procedure_name: 'spraying',
    started_at: new Date('2026-04-12T08:00:00Z'),
    stopped_at: new Date('2026-04-12T10:30:00Z'),
    description: 'Traitement T2',
    doers: [{ product_id: 'wdb-driver-1', reference_name: 'driver' }],
    inputs: [
      {
        product_id: 'wdb-product-1',
        variant_id: 'wdb-variant-1',
        reference_name: 'plant_medicine',
        quantity_value: 1.5,
        quantity_handler: 'volume_area_density',
        quantity_unit: 'liter_per_hectare',
      },
    ],
    targets: [{ cultivable_zone_id: 'wdb-zone-1', reference_name: 'cultivation' }],
    tools: [{ product_id: 'wdb-sprayer-1', reference_name: 'sprayer' }],
    ...overrides,
  };
}

describe('sprayingInterventionSchema — happy path', () => {
  it('accepte un payload minimal valide', () => {
    const result = sprayingInterventionSchema.safeParse(makeValidInput());
    expect(result.success).toBe(true);
  });

  it('autorise plusieurs doers, inputs et tools', () => {
    const result = sprayingInterventionSchema.safeParse(
      makeValidInput({
        doers: [
          { product_id: 'a', reference_name: 'driver' },
          { product_id: 'b', reference_name: 'driver' },
        ],
        inputs: [
          {
            product_id: 'p1',
            reference_name: 'plant_medicine',
            quantity_value: 1,
            quantity_handler: 'population',
            quantity_unit: 'unity',
          },
          {
            product_id: 'p2',
            reference_name: 'plant_medicine',
            quantity_value: 2,
            quantity_handler: 'net_volume',
            quantity_unit: 'liter',
          },
        ],
        tools: [
          { product_id: 's1', reference_name: 'sprayer' },
          { product_id: 's2', reference_name: 'sprayer' },
        ],
      }),
    );
    expect(result.success).toBe(true);
  });

  it('rend description optionnelle', () => {
    const { description: _omit, ...rest } = makeValidInput() as Record<string, unknown>;
    const result = sprayingInterventionSchema.safeParse(rest);
    expect(result.success).toBe(true);
  });

  it('rend variant_id optionnel sur les inputs', () => {
    const result = sprayingInterventionSchema.safeParse(
      makeValidInput({
        inputs: [
          {
            product_id: 'p1',
            reference_name: 'plant_medicine',
            quantity_value: 1,
            quantity_handler: 'population',
            quantity_unit: 'unity',
          },
        ],
      }),
    );
    expect(result.success).toBe(true);
  });
});

describe('sprayingInterventionSchema — invalidations', () => {
  it("refuse si procedure_name n'est pas 'spraying'", () => {
    const result = sprayingInterventionSchema.safeParse(
      makeValidInput({ procedure_name: 'harvesting' as unknown as 'spraying' }),
    );
    expect(result.success).toBe(false);
  });

  it('refuse si stopped_at <= started_at', () => {
    const date = new Date('2026-04-12T10:00:00Z');
    const result = sprayingInterventionSchema.safeParse(
      makeValidInput({ started_at: date, stopped_at: date }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.join('.') === 'stopped_at');
      expect(issue?.message).toMatch(/après le début/);
    }
  });

  it('refuse si stopped_at < started_at', () => {
    const result = sprayingInterventionSchema.safeParse(
      makeValidInput({
        started_at: new Date('2026-04-12T11:00:00Z'),
        stopped_at: new Date('2026-04-12T10:00:00Z'),
      }),
    );
    expect(result.success).toBe(false);
  });

  it('refuse si pas de doer', () => {
    const result = sprayingInterventionSchema.safeParse(makeValidInput({ doers: [] }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => /conducteur requis/i.test(i.message))).toBe(true);
    }
  });

  it('refuse si pas de produit phyto', () => {
    const result = sprayingInterventionSchema.safeParse(makeValidInput({ inputs: [] }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => /phytosanitaire/i.test(i.message))).toBe(true);
    }
  });

  it('refuse si quantity_value <= 0', () => {
    const result = sprayingInterventionSchema.safeParse(
      makeValidInput({
        inputs: [
          {
            product_id: 'p1',
            reference_name: 'plant_medicine',
            quantity_value: 0,
            quantity_handler: 'population',
            quantity_unit: 'unity',
          },
        ],
      }),
    );
    expect(result.success).toBe(false);
  });

  it('refuse si quantity_value négatif', () => {
    const result = sprayingInterventionSchema.safeParse(
      makeValidInput({
        inputs: [
          {
            product_id: 'p1',
            reference_name: 'plant_medicine',
            quantity_value: -1,
            quantity_handler: 'population',
            quantity_unit: 'unity',
          },
        ],
      }),
    );
    expect(result.success).toBe(false);
  });

  it('refuse si quantity_handler vide', () => {
    const result = sprayingInterventionSchema.safeParse(
      makeValidInput({
        inputs: [
          {
            product_id: 'p1',
            reference_name: 'plant_medicine',
            quantity_value: 1,
            quantity_handler: '',
            quantity_unit: 'unity',
          },
        ],
      }),
    );
    expect(result.success).toBe(false);
  });

  it('refuse si quantity_unit vide (unité désormais requise)', () => {
    const result = sprayingInterventionSchema.safeParse(
      makeValidInput({
        inputs: [
          {
            product_id: 'p1',
            reference_name: 'plant_medicine',
            quantity_value: 1,
            quantity_handler: 'population',
            quantity_unit: '',
          },
        ],
      }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => /unité requise/i.test(i.message))).toBe(true);
    }
  });

  it('refuse une unité incohérente avec le handler (garde-fou ex-bug area_density/l)', () => {
    const result = sprayingInterventionSchema.safeParse(
      makeValidInput({
        inputs: [
          {
            product_id: 'p1',
            reference_name: 'plant_medicine',
            quantity_value: 1,
            quantity_handler: 'volume_area_density',
            quantity_unit: 'l',
          },
        ],
      }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some(
          (i) =>
            i.path.join('.') === 'inputs.0.quantity_unit' &&
            /attendu : liter_per_hectare/.test(i.message),
        ),
      ).toBe(true);
    }
  });

  it('refuse si product_id input vide', () => {
    const result = sprayingInterventionSchema.safeParse(
      makeValidInput({
        inputs: [
          {
            product_id: '',
            reference_name: 'plant_medicine',
            quantity_value: 1,
            quantity_handler: 'population',
            quantity_unit: 'unity',
          },
        ],
      }),
    );
    expect(result.success).toBe(false);
  });

  it('refuse si aucune cible', () => {
    const result = sprayingInterventionSchema.safeParse(makeValidInput({ targets: [] }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => /1 parcelle/i.test(i.message))).toBe(true);
    }
  });

  it('autorise plusieurs cibles (multi-cibles)', () => {
    const result = sprayingInterventionSchema.safeParse(
      makeValidInput({
        targets: [
          { cultivable_zone_id: 'z1', reference_name: 'cultivation' },
          { cultivable_zone_id: 'z2', reference_name: 'cultivation' },
        ],
      }),
    );
    expect(result.success).toBe(true);
  });

  it('refuse si pas de pulvérisateur', () => {
    const result = sprayingInterventionSchema.safeParse(makeValidInput({ tools: [] }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => /pulvérisateur/i.test(i.message))).toBe(true);
    }
  });

  it("refuse un reference_name doer autre que 'driver'", () => {
    const result = sprayingInterventionSchema.safeParse(
      makeValidInput({
        doers: [{ product_id: 'p', reference_name: 'pilot' as unknown as 'driver' }],
      }),
    );
    expect(result.success).toBe(false);
  });

  it("refuse un reference_name input autre que 'plant_medicine'", () => {
    const result = sprayingInterventionSchema.safeParse(
      makeValidInput({
        inputs: [
          {
            product_id: 'p1',
            reference_name: 'seed' as unknown as 'plant_medicine',
            quantity_value: 1,
            quantity_handler: 'population',
            quantity_unit: 'unity',
          },
        ],
      }),
    );
    expect(result.success).toBe(false);
  });

  it("refuse un reference_name target autre que 'cultivation'", () => {
    const result = sprayingInterventionSchema.safeParse(
      makeValidInput({
        targets: [{ cultivable_zone_id: 'z', reference_name: 'plot' as unknown as 'cultivation' }],
      }),
    );
    expect(result.success).toBe(false);
  });

  it("refuse un reference_name tool autre que 'sprayer'", () => {
    const result = sprayingInterventionSchema.safeParse(
      makeValidInput({
        tools: [{ product_id: 's', reference_name: 'tractor' as unknown as 'sprayer' }],
      }),
    );
    expect(result.success).toBe(false);
  });

  it("refuse si started_at est une string au lieu d'une Date", () => {
    const result = sprayingInterventionSchema.safeParse(
      makeValidInput({
        started_at: '2026-04-12T08:00:00Z' as unknown as Date,
      }),
    );
    expect(result.success).toBe(false);
  });
});
