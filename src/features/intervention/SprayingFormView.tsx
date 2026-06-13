import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
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
import {
  parseSprayingHandlers,
  type SprayingHandlerOption,
} from '@domain/procedures/spraying-handlers';
import {
  AccordionSection,
  BottomActionBar,
  DateTimeField,
  MultiSelectField,
  SelectField,
  colors,
  fontSize,
  radius,
  spacing,
} from '@ui/index';

import { InputsFieldArray } from './InputsFieldArray';
import { TargetMapPickerModal } from './TargetMapPickerModal';

// Liste canonique (miroir spraying.xml) utilisée tant que la définition de
// procédure n'a pas été passée (ex. catalogue pas encore resynchronisé).
const DEFAULT_SPRAYING_HANDLERS = parseSprayingHandlers(undefined);

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
  /** Handlers (mesure + unité) issus de la définition de procédure spraying. */
  handlers?: SprayingHandlerOption[];
  onSubmit: SubmitHandler<SprayingIntervention>;
  /** Annulation (barre basse) — typiquement `router.back()`. */
  onCancel?: () => void;
  submitting?: boolean;
  /** Erreur top-level affichée en bandeau (échec persistance, etc.). */
  submitError?: string | null;
  /**
   * Valeurs initiales du formulaire (mode édition). Si fourni, le form est
   * pré-rempli ; sinon, valeurs par défaut (mode création). La forme des
   * tableaux `[{...}]` est conservée à l'identique (cf. RHF reset).
   */
  initialValues?: SprayingIntervention;
}

type SectionKey = 'dates' | 'target' | 'doer' | 'inputs' | 'tool' | 'description';

export function SprayingFormView({
  cultivableZones,
  workers,
  equipments,
  matters,
  variants,
  handlers = DEFAULT_SPRAYING_HANDLERS,
  onSubmit,
  onCancel,
  submitting = false,
  submitError = null,
  initialValues,
}: SprayingFormViewProps) {
  const { t, i18n } = useTranslation();

  const defaultValues = useMemo<SprayingIntervention>(() => {
    if (initialValues) return initialValues;
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
    // `initialValues` est figé au montage (l'écran remonte le form sur edit via
    // une `key` distincte) — pas besoin de le mettre en dépendance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SprayingIntervention>({
    resolver: zodResolver(sprayingInterventionSchema),
    defaultValues,
    mode: 'onSubmit',
  });

  // État d'ouverture par section. Les sections requises (cibles, conducteur,
  // intrants, pulvérisateur) sont ouvertes par défaut ; dates (valeurs par
  // défaut sensées) et notes (optionnel) sont repliées. Une section en erreur
  // est forcée ouverte (cf. `isOpen`) pour ne jamais masquer un message.
  const [expanded, setExpanded] = useState<Record<SectionKey, boolean>>({
    dates: false,
    target: true,
    doer: true,
    inputs: true,
    tool: true,
    description: false,
  });
  const toggle = (key: SectionKey) => setExpanded((s) => ({ ...s, [key]: !s[key] }));

  // Modal carto pour la sélection des cibles. Lifte ici (et non dans le
  // Controller) pour que le state survive un re-render des fields voisins.
  const [mapPickerOpen, setMapPickerOpen] = useState(false);

  // RHF empêche d'appeler onSubmit tant que la validation Zod échoue.
  // Le bandeau « incomplet » s'affiche tant qu'un tableau requis est vide
  // (parcelle, conducteur, ≥1 intrant phyto, ≥1 pulvérisateur).
  const incomplete = hasArrayErrors(errors);
  const isBusy = submitting || isSubmitting;

  // Valeurs courantes pour les résumés repliés (re-render à chaque saisie).
  const values = watch();
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(i18n.language || 'fr', { day: '2-digit', month: 'short' }),
    [i18n.language],
  );

  // Surface totale des cibles = somme des hectares (multi-cibles). Sert au
  // résumé « N cultures • X ha » ET au calcul du total des intrants à l'hectare.
  const totalAreaHectares = useMemo(() => {
    const byId = new Map(cultivableZones.map((z) => [z.id, z]));
    return (values.targets ?? []).reduce((sum, target) => {
      const zone = byId.get(target.cultivable_zone_id);
      return sum + (zone?.areaHectares ?? 0);
    }, 0);
  }, [values.targets, cultivableZones]);

  const targetCount = values.targets?.length ?? 0;
  const targetsSummary =
    targetCount === 0
      ? t('interventions.spraying.summaries.empty')
      : t('interventions.spraying.summaries.targets', {
          count: targetCount,
          area: formatHectares(totalAreaHectares),
        });

  const datesSummary = t('interventions.spraying.summaries.dates', {
    date: dateFormatter.format(values.started_at ?? defaultValues.started_at),
    duration: formatDuration(values.started_at, values.stopped_at, t),
  });

  const doerName = values.doers?.[0]?.product_id
    ? (workers.find((w) => w.id === values.doers[0]?.product_id)?.name ?? null)
    : null;
  const toolName = values.tools?.[0]?.product_id
    ? (equipments.find((e) => e.id === values.tools[0]?.product_id)?.name ?? null)
    : null;
  const inputsCount = values.inputs?.length ?? 0;
  const inputsSummary =
    inputsCount === 0
      ? t('interventions.spraying.summaries.empty')
      : t('interventions.spraying.summaries.inputs', { count: inputsCount });
  const emptySummary = t('interventions.spraying.summaries.empty');

  const isOpen = (key: SectionKey, hasError: boolean) => expanded[key] || hasError;

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <AccordionSection
          title={t('interventions.spraying.sections.dates')}
          summary={datesSummary}
          expanded={isOpen('dates', Boolean(errors.started_at || errors.stopped_at))}
          onToggle={() => toggle('dates')}
          testID="spraying-section-dates"
        >
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
        </AccordionSection>

        <AccordionSection
          title={t('interventions.spraying.sections.target')}
          summary={targetsSummary}
          expanded={isOpen('target', Boolean(errors.targets))}
          onToggle={() => toggle('target')}
          testID="spraying-section-target"
        >
          <Controller
            control={control}
            name="targets"
            render={({ field: { value, onChange }, fieldState: { error } }) => {
              const selectedIds = value.map((t) => t.cultivable_zone_id);
              const selectedZones = cultivableZones.filter((z) => selectedIds.includes(z.id));
              const applyIds = (ids: string[]) =>
                onChange(
                  ids.map((id) => ({
                    cultivable_zone_id: id,
                    reference_name: 'cultivation' as const,
                  })),
                );
              return (
                <>
                  <Pressable
                    onPress={() => setMapPickerOpen(true)}
                    accessibilityRole="button"
                    accessibilityLabel={t('interventions.spraying.targetMap.openButton')}
                    style={({ pressed }) => [styles.mapButton, pressed && styles.mapButtonPressed]}
                    testID="spraying-target-map-open"
                  >
                    <Text style={styles.mapButtonText}>
                      {t('interventions.spraying.targetMap.openButton')}
                    </Text>
                  </Pressable>
                  <MultiSelectField<CultivableZone>
                    label={t('interventions.spraying.fields.target')}
                    items={cultivableZones}
                    selected={selectedZones}
                    onChange={(zones) => applyIds(zones.map((z) => z.id))}
                    getKey={(z) => z.id}
                    getLabel={(z) => z.name}
                    getSubtitle={(z) => targetSubtitle(z, t)}
                    summary={(zones) => summarizeTargets(zones, t)}
                    placeholder={t('interventions.spraying.selects.targetPlaceholder')}
                    emptyText={t('interventions.spraying.selects.targetEmpty')}
                    errorMessage={error?.message}
                    testID="spraying-target-select"
                  />
                  <TargetMapPickerModal
                    visible={mapPickerOpen}
                    zones={cultivableZones}
                    initialSelectedIds={selectedIds}
                    onCancel={() => setMapPickerOpen(false)}
                    onConfirm={(ids) => {
                      applyIds(ids);
                      setMapPickerOpen(false);
                    }}
                  />
                </>
              );
            }}
          />
        </AccordionSection>

        <AccordionSection
          title={t('interventions.spraying.sections.doer')}
          summary={doerName ?? emptySummary}
          expanded={isOpen('doer', Boolean(errors.doers))}
          onToggle={() => toggle('doer')}
          testID="spraying-section-doer"
        >
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
        </AccordionSection>

        <AccordionSection
          title={t('interventions.spraying.sections.inputs')}
          summary={inputsSummary}
          expanded={isOpen('inputs', Boolean(errors.inputs))}
          onToggle={() => toggle('inputs')}
          testID="spraying-section-inputs"
        >
          <Controller
            control={control}
            name="inputs"
            render={({ field: { value, onChange }, fieldState: { error } }) => (
              <InputsFieldArray
                value={value}
                onChange={onChange}
                products={matters}
                variants={variants}
                handlers={handlers}
                totalAreaHectares={totalAreaHectares}
                errorMessage={error?.message}
                testID="spraying-inputs"
              />
            )}
          />
        </AccordionSection>

        <AccordionSection
          title={t('interventions.spraying.sections.tool')}
          summary={toolName ?? emptySummary}
          expanded={isOpen('tool', Boolean(errors.tools))}
          onToggle={() => toggle('tool')}
          testID="spraying-section-tool"
        >
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
        </AccordionSection>

        <AccordionSection
          title={t('interventions.spraying.sections.description')}
          summary={values.description?.trim() ? values.description.trim() : emptySummary}
          expanded={isOpen('description', Boolean(errors.description))}
          onToggle={() => toggle('description')}
          testID="spraying-section-description"
        >
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
        </AccordionSection>

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
      </ScrollView>

      <BottomActionBar
        primary={{
          label: isBusy ? t('interventions.spraying.saving') : t('interventions.spraying.save'),
          onPress: handleSubmit(onSubmit),
          disabled: isBusy,
          testID: 'spraying-save-button',
        }}
        secondary={
          onCancel
            ? {
                label: t('common.cancel'),
                onPress: onCancel,
                disabled: isBusy,
                testID: 'spraying-cancel-button',
              }
            : undefined
        }
      />
    </View>
  );
}

// Affiche les hectares avec 2 décimales max, sans zéro inutile (« 4,5 ha »).
function formatHectares(value: number): string {
  return value.toLocaleString('fr-FR', { maximumFractionDigits: 2, minimumFractionDigits: 0 });
}

// Sous-titre d'une cible dans le picker : type (Parcelle | Culture) + surface.
// `kind` null = rows migrées avant le schéma v3 → traitées comme parcelles.
function targetSubtitle(
  zone: CultivableZone,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  const kindLabel =
    zone.kind === 'plant'
      ? t('interventions.spraying.targetKind.plant')
      : t('interventions.spraying.targetKind.landParcel');
  if (zone.areaHectares != null) {
    return `${kindLabel} · ${t('interventions.spraying.areaHectares', {
      value: formatHectares(zone.areaHectares),
    })}`;
  }
  return kindLabel;
}

// Résumé « N cultures • X ha » d'un ensemble de cibles (multi-cibles).
function summarizeTargets(
  zones: CultivableZone[],
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  const area = zones.reduce((sum, z) => sum + (z.areaHectares ?? 0), 0);
  return t('interventions.spraying.summaries.targets', {
    count: zones.length,
    area: formatHectares(area),
  });
}

// Durée travaillée formatée pour le résumé replié (« 3 h », « 45 min »,
// « 1 h 30 »). Tolère des bornes absentes (formulaire en cours d'init).
function formatDuration(
  start: Date | undefined,
  stop: Date | undefined,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  if (!start || !stop) return t('interventions.spraying.summaries.empty');
  const seconds = Math.max(0, Math.round((stop.getTime() - start.getTime()) / 1000));
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return t('interventions.spraying.summaries.durationMinutes', { minutes });
  if (minutes === 0) return t('interventions.spraying.summaries.durationHours', { hours });
  return t('interventions.spraying.summaries.durationHoursMinutes', { hours, minutes });
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
  root: ViewStyle;
  container: ViewStyle;
  content: ViewStyle;
  textArea: TextStyle;
  errorBanner: ViewStyle;
  errorTitle: TextStyle;
  errorMessage: TextStyle;
  warningBanner: ViewStyle;
  warningText: TextStyle;
  mapButton: ViewStyle;
  mapButtonPressed: ViewStyle;
  mapButtonText: TextStyle;
}>({
  root: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  textArea: {
    borderColor: colors.borderStrong,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: fontSize.base,
    color: colors.textPrimary,
    minHeight: 84,
    textAlignVertical: 'top',
  },
  errorBanner: {
    backgroundColor: colors.dangerBg,
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  errorTitle: { fontSize: fontSize.base, fontWeight: '600', color: colors.danger, marginBottom: 4 },
  errorMessage: { fontSize: fontSize.md, color: colors.dangerText },
  warningBanner: {
    backgroundColor: colors.warningBg,
    borderColor: colors.warningBorder,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  warningText: { fontSize: fontSize.md, color: colors.warning },
  mapButton: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  mapButtonPressed: { backgroundColor: colors.surfaceAlt },
  mapButtonText: { fontSize: fontSize.md, color: colors.textPrimary, fontWeight: '500' },
});
