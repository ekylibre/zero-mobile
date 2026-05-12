import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo } from 'react';
import { Controller, useForm, type SubmitHandler } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import type { CultivableZone, Product, Variant } from '@core/db/models';
import { sprayingInterventionSchema, type SprayingIntervention } from '@domain/procedures/spraying';
import { DateTimeField, SelectField } from '@ui/index';

import { InputsFieldArray } from './InputsFieldArray';

export interface SprayingFormViewProps {
  /** Catalogue de parcelles cultivables (target). */
  cultivableZones: CultivableZone[];
  /** Catalogue des produits de type `workers` (doer = driver). */
  workers: Product[];
  /** Catalogue des produits de type `equipments` (tool = sprayer). */
  equipments: Product[];
  /** Catalogue des produits de type `matters` (intrants phytosanitaires). */
  matters: Product[];
  /** Variants déjà filtrés sur la catégorie pertinente (côté parent). */
  variants: Variant[];
  onSubmit: SubmitHandler<SprayingIntervention>;
  submitting?: boolean;
  /** Erreur top-level affichée en bandeau (échec persistance, etc.). */
  submitError?: string | null;
}

export function SprayingFormView({
  cultivableZones,
  workers,
  equipments,
  matters,
  variants,
  onSubmit,
  submitting = false,
  submitError = null,
}: SprayingFormViewProps) {
  const { t } = useTranslation();

  const defaultValues = useMemo<SprayingIntervention>(() => {
    const now = new Date();
    const inOneHour = new Date(now.getTime() + 60 * 60 * 1000);
    return {
      procedure_name: 'spraying',
      started_at: now,
      stopped_at: inOneHour,
      description: '',
      doers: [],
      inputs: [],
      targets: [],
      tools: [],
    };
  }, []);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SprayingIntervention>({
    resolver: zodResolver(sprayingInterventionSchema),
    defaultValues,
    mode: 'onSubmit',
  });

  // RHF empêche d'appeler onSubmit tant que la validation Zod échoue.
  // Le bandeau « incomplet » s'affiche tant qu'un tableau requis est vide
  // (parcelle, conducteur, ≥1 intrant phyto, ≥1 pulvérisateur).
  const incomplete = hasArrayErrors(errors);
  const isBusy = submitting || isSubmitting;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Section title={t('interventions.spraying.sections.dates')}>
        <Controller
          control={control}
          name="started_at"
          render={({ field: { value, onChange }, fieldState: { error } }) => (
            <DateTimeField
              label={t('interventions.spraying.fields.startedAt')}
              value={value}
              onChange={onChange}
              testID="spraying-started-at"
              errorMessage={error?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="stopped_at"
          render={({ field: { value, onChange }, fieldState: { error } }) => (
            <DateTimeField
              label={t('interventions.spraying.fields.stoppedAt')}
              value={value}
              onChange={onChange}
              testID="spraying-stopped-at"
              errorMessage={error?.message}
            />
          )}
        />
      </Section>

      <Section title={t('interventions.spraying.sections.target')}>
        <Controller
          control={control}
          name="targets"
          render={({ field: { value, onChange }, fieldState: { error } }) => {
            const currentId = value[0]?.cultivable_zone_id;
            const selected = currentId
              ? (cultivableZones.find((z) => z.id === currentId) ?? null)
              : null;
            return (
              <SelectField<CultivableZone>
                label={t('interventions.spraying.fields.target')}
                items={cultivableZones}
                value={selected}
                onChange={(zone) =>
                  onChange(
                    zone ? [{ cultivable_zone_id: zone.id, reference_name: 'cultivation' }] : [],
                  )
                }
                getKey={(z) => z.id}
                getLabel={(z) => z.name}
                getSubtitle={(z) =>
                  z.areaHectares != null
                    ? t('interventions.spraying.areaHectares', {
                        value: formatHectares(z.areaHectares),
                      })
                    : null
                }
                placeholder={t('interventions.spraying.selects.targetPlaceholder')}
                emptyText={t('interventions.spraying.selects.targetEmpty')}
                errorMessage={error?.message}
                testID="spraying-target-select"
              />
            );
          }}
        />
      </Section>

      <Section title={t('interventions.spraying.sections.doer')}>
        <Controller
          control={control}
          name="doers"
          render={({ field: { value, onChange }, fieldState: { error } }) => {
            const currentId = value[0]?.product_id;
            const selected = currentId ? (workers.find((w) => w.id === currentId) ?? null) : null;
            return (
              <SelectField<Product>
                label={t('interventions.spraying.fields.doer')}
                items={workers}
                value={selected}
                onChange={(worker) =>
                  onChange(worker ? [{ product_id: worker.id, reference_name: 'driver' }] : [])
                }
                getKey={(p) => p.id}
                getLabel={(p) => p.name}
                placeholder={t('interventions.spraying.selects.doerPlaceholder')}
                emptyText={t('interventions.spraying.selects.doerEmpty')}
                errorMessage={error?.message}
                testID="spraying-doer-select"
              />
            );
          }}
        />
      </Section>

      <Section title={t('interventions.spraying.sections.inputs')}>
        <Controller
          control={control}
          name="inputs"
          render={({ field: { value, onChange }, fieldState: { error } }) => (
            <InputsFieldArray
              value={value}
              onChange={onChange}
              products={matters}
              variants={variants}
              errorMessage={error?.message}
              testID="spraying-inputs"
            />
          )}
        />
      </Section>

      <Section title={t('interventions.spraying.sections.tool')}>
        <Controller
          control={control}
          name="tools"
          render={({ field: { value, onChange }, fieldState: { error } }) => {
            const currentId = value[0]?.product_id;
            const selected = currentId
              ? (equipments.find((e) => e.id === currentId) ?? null)
              : null;
            return (
              <SelectField<Product>
                label={t('interventions.spraying.fields.tool')}
                items={equipments}
                value={selected}
                onChange={(equipment) =>
                  onChange(
                    equipment ? [{ product_id: equipment.id, reference_name: 'sprayer' }] : [],
                  )
                }
                getKey={(p) => p.id}
                getLabel={(p) => p.name}
                getSubtitle={(p) => p.variety ?? null}
                placeholder={t('interventions.spraying.selects.toolPlaceholder')}
                emptyText={t('interventions.spraying.selects.toolEmpty')}
                errorMessage={error?.message}
                testID="spraying-tool-select"
              />
            );
          }}
        />
      </Section>

      <Section title={t('interventions.spraying.sections.description')}>
        <Controller
          control={control}
          name="description"
          render={({ field: { onBlur, onChange, value } }) => (
            <TextInput
              style={styles.textArea}
              multiline
              numberOfLines={3}
              placeholder={t('interventions.spraying.fields.descriptionPlaceholder')}
              onBlur={onBlur}
              onChangeText={onChange}
              value={value ?? ''}
              testID="spraying-description-input"
            />
          )}
        />
      </Section>

      {submitError ? (
        <View style={styles.errorBanner} testID="spraying-submit-error">
          <Text style={styles.errorTitle}>{t('interventions.spraying.errorTitle')}</Text>
          <Text style={styles.errorMessage}>{submitError}</Text>
        </View>
      ) : null}

      {incomplete ? (
        <View style={styles.warningBanner} testID="spraying-incomplete-warning">
          <Text style={styles.warningText}>{t('interventions.spraying.errorIncomplete')}</Text>
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        onPress={handleSubmit(onSubmit)}
        disabled={isBusy}
        style={({ pressed }) => [
          styles.saveButton,
          (pressed || isBusy) && styles.saveButtonPressed,
        ]}
        testID="spraying-save-button"
      >
        <Text style={styles.saveButtonText}>
          {isBusy ? t('interventions.spraying.saving') : t('interventions.spraying.save')}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

function Section({ title, children }: SectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

// Affiche les hectares avec 2 décimales max, sans zéro inutile (« 4,5 ha »).
function formatHectares(value: number): string {
  return value.toLocaleString('fr-FR', { maximumFractionDigits: 2, minimumFractionDigits: 0 });
}

// Zod nous renvoie des erreurs de niveau « tableau » (ex: doers.root) quand
// une `min(1)` échoue. On agrège ces erreurs pour décider si le bandeau
// « formulaire incomplet » doit apparaître. On ignore les erreurs sur
// description (champ texte purement optionnel).
function hasArrayErrors(errors: Record<string, unknown>): boolean {
  const arrayKeys = ['doers', 'inputs', 'targets', 'tools'];
  return arrayKeys.some((key) => errors[key] !== undefined);
}

const styles = StyleSheet.create<{
  container: ViewStyle;
  content: ViewStyle;
  section: ViewStyle;
  sectionTitle: TextStyle;
  textArea: TextStyle;
  errorBanner: ViewStyle;
  errorTitle: TextStyle;
  errorMessage: TextStyle;
  warningBanner: ViewStyle;
  warningText: TextStyle;
  saveButton: ViewStyle;
  saveButtonPressed: ViewStyle;
  saveButtonText: TextStyle;
}>({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16, paddingBottom: 48 },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  textArea: {
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 6,
    padding: 12,
    fontSize: 14,
    color: '#222',
    minHeight: 84,
    textAlignVertical: 'top',
  },
  errorBanner: {
    backgroundColor: '#fde6e6',
    borderColor: '#a3171c',
    borderWidth: 1,
    borderRadius: 6,
    padding: 12,
    marginBottom: 16,
  },
  errorTitle: { fontSize: 14, fontWeight: '600', color: '#a3171c', marginBottom: 4 },
  errorMessage: { fontSize: 13, color: '#5a0c10' },
  warningBanner: {
    backgroundColor: '#fff7e6',
    borderColor: '#f0c36d',
    borderWidth: 1,
    borderRadius: 6,
    padding: 12,
    marginBottom: 16,
  },
  warningText: { fontSize: 13, color: '#7a4f00' },
  saveButton: {
    backgroundColor: '#0066cc',
    borderRadius: 6,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonPressed: { opacity: 0.85 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
