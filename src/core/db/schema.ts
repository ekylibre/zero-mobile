import { appSchema, tableSchema } from '@nozbe/watermelondb';

// Schéma WatermelonDB v1 (cf. docs/architecture.md §3).
// Toute évolution → bump de version + migration dans migrations.ts.
export const schema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'procedures',
      columns: [
        { name: 'name', type: 'string', isIndexed: true },
        { name: 'label_fr', type: 'string' },
        { name: 'definition_json', type: 'string' },
        { name: 'updated_at_server', type: 'number' },
      ],
    }),

    tableSchema({
      name: 'products',
      columns: [
        { name: 'server_id', type: 'number', isIndexed: true },
        { name: 'product_type', type: 'string', isIndexed: true },
        { name: 'name', type: 'string' },
        { name: 'variant_id', type: 'number', isOptional: true },
        { name: 'variety', type: 'string', isOptional: true },
        { name: 'updated_at_server', type: 'number' },
      ],
    }),

    tableSchema({
      name: 'variants',
      columns: [
        { name: 'server_id', type: 'number', isIndexed: true },
        { name: 'name', type: 'string' },
        { name: 'category', type: 'string' },
        { name: 'unit', type: 'string', isOptional: true },
        { name: 'updated_at_server', type: 'number' },
      ],
    }),

    tableSchema({
      name: 'cultivable_zones',
      columns: [
        { name: 'server_id', type: 'number', isIndexed: true },
        { name: 'name', type: 'string' },
        { name: 'geometry_geojson', type: 'string' },
        { name: 'area_hectares', type: 'number', isOptional: true },
        { name: 'updated_at_server', type: 'number' },
      ],
    }),

    tableSchema({
      name: 'interventions',
      columns: [
        { name: 'client_uuid', type: 'string', isIndexed: true },
        { name: 'server_id', type: 'number', isOptional: true, isIndexed: true },
        { name: 'procedure_name', type: 'string' },
        { name: 'started_at', type: 'number' },
        { name: 'stopped_at', type: 'number' },
        { name: 'whole_duration_seconds', type: 'number' },
        { name: 'working_duration_seconds', type: 'number' },
        { name: 'description', type: 'string', isOptional: true },
        { name: 'sync_state', type: 'string', isIndexed: true },
        { name: 'sync_error_message', type: 'string', isOptional: true },
        { name: 'sync_attempt_count', type: 'number' },
        { name: 'last_synced_at', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    tableSchema({
      name: 'intervention_doers',
      columns: [
        { name: 'intervention_id', type: 'string', isIndexed: true },
        { name: 'product_id', type: 'string' },
        { name: 'reference_name', type: 'string' },
      ],
    }),

    tableSchema({
      name: 'intervention_inputs',
      columns: [
        { name: 'intervention_id', type: 'string', isIndexed: true },
        { name: 'product_id', type: 'string' },
        { name: 'variant_id', type: 'string', isOptional: true },
        { name: 'reference_name', type: 'string' },
        { name: 'quantity_value', type: 'number' },
        { name: 'quantity_handler', type: 'string' },
        { name: 'quantity_unit', type: 'string', isOptional: true },
      ],
    }),

    tableSchema({
      name: 'intervention_targets',
      columns: [
        { name: 'intervention_id', type: 'string', isIndexed: true },
        { name: 'cultivable_zone_id', type: 'string' },
        { name: 'reference_name', type: 'string' },
      ],
    }),

    tableSchema({
      name: 'intervention_tools',
      columns: [
        { name: 'intervention_id', type: 'string', isIndexed: true },
        { name: 'product_id', type: 'string' },
        { name: 'reference_name', type: 'string' },
      ],
    }),

    tableSchema({
      name: 'intervention_working_periods',
      columns: [
        { name: 'intervention_id', type: 'string', isIndexed: true },
        { name: 'started_at', type: 'number' },
        { name: 'stopped_at', type: 'number' },
        { name: 'duration_seconds', type: 'number' },
        { name: 'nature', type: 'string' },
      ],
    }),

    // Singleton (1 seule ligne) qui pilote la sync.
    tableSchema({
      name: 'sync_state',
      columns: [
        { name: 'last_pulled_at', type: 'number', isOptional: true },
        { name: 'last_pull_status', type: 'string' },
        { name: 'last_pull_error', type: 'string', isOptional: true },
        { name: 'current_step', type: 'string', isOptional: true },
      ],
    }),
  ],
});

// Tables exposées comme constantes pour éviter les chaînes magiques ailleurs.
export const Tables = {
  procedures: 'procedures',
  products: 'products',
  variants: 'variants',
  cultivableZones: 'cultivable_zones',
  interventions: 'interventions',
  interventionDoers: 'intervention_doers',
  interventionInputs: 'intervention_inputs',
  interventionTargets: 'intervention_targets',
  interventionTools: 'intervention_tools',
  interventionWorkingPeriods: 'intervention_working_periods',
  syncState: 'sync_state',
} as const;

export type TableName = (typeof Tables)[keyof typeof Tables];
