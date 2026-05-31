import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useSyncCycle } from '@core/sync/use-sync-cycle';
import {
  useCultivableZonesAll,
  useInterventionById,
  useProcedureByName,
  useProductsAll,
  useVariants,
} from '@features/catalog/hooks';
import {
  ItemCard,
  ParcelShape,
  ProcedureIcon,
  SyncBadge,
  colors,
  fontSize,
  radius,
  spacing,
} from '@ui/index';

import { database } from '@core/db/database';
import type { Intervention } from '@core/db/models';
import { Tables } from '@core/db/schema';

export default function InterventionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();

  const detail = useInterventionById(id);
  const procedure = useProcedureByName(detail.intervention?.procedureName);
  const { startSync, isBusy: syncBusy } = useSyncCycle();

  // Résolution des noms : les relations (doers/inputs/tools/targets) stockent
  // des ids locaux WDB → on les mappe vers les modèles catalogue.
  const products = useProductsAll();
  const zones = useCultivableZonesAll();
  const variants = useVariants();
  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const zoneById = useMemo(() => new Map(zones.map((z) => [z.id, z])), [zones]);
  const variantById = useMemo(() => new Map(variants.map((v) => [v.id, v])), [variants]);

  // Surface totale des cibles (somme), pour le total des intrants à l'hectare.
  const totalAreaHectares = useMemo(
    () =>
      detail.targets.reduce((sum, target) => {
        const zone = zoneById.get(target.cultivableZoneId);
        return sum + (zone?.areaHectares ?? 0);
      }, 0),
    [detail.targets, zoneById],
  );

  if (!detail.intervention) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{t('interventions.detail.notFound')}</Text>
      </View>
    );
  }

  const intervention = detail.intervention;
  const dateFormatter = new Intl.DateTimeFormat(i18n.language || 'fr', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const durationLabel = formatDuration(intervention.workingDurationSeconds, t);

  const onRetry = async () => {
    // Repasse l'intervention en `pending` pour qu'elle soit re-tentée, puis
    // déclenche immédiatement un cycle de sync. L'utilisateur s'attend à ce
    // que le tap « Réessayer » envoie tout de suite — pas à attendre le
    // prochain cycle manuel.
    await database.write(async () => {
      const collection = database.collections.get<Intervention>(Tables.interventions);
      const fresh = await collection.find(intervention.id);
      await fresh.update((m) => {
        m.syncState = 'pending';
        m.syncErrorMessage = null;
      });
    });
    void startSync().catch(() => {
      // L'erreur est déjà stockée dans le store + sur l'intervention si
      // elle re-échoue. Pas de remontée locale ici.
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <ProcedureIcon procedureName={intervention.procedureName} size={44} />
        <Text style={styles.heading} numberOfLines={1}>
          {procedure?.labelFr ?? intervention.procedureName}
        </Text>
        <SyncBadge state={intervention.syncState} />
      </View>

      {intervention.syncState === 'error' && intervention.syncErrorMessage ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorTitle}>{t('interventions.detail.errorTitle')}</Text>
          <Text style={styles.errorMessage}>{intervention.syncErrorMessage}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={onRetry}
            disabled={syncBusy}
            style={({ pressed }) => [
              styles.retryButton,
              (pressed || syncBusy) && styles.retryButtonPressed,
            ]}
            testID="intervention-retry"
          >
            <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
          </Pressable>
        </View>
      ) : null}

      <Section title={t('interventions.detail.dates')}>
        <Row
          label={t('interventions.detail.startedAt')}
          value={dateFormatter.format(intervention.startedAt)}
        />
        <Row
          label={t('interventions.detail.stoppedAt')}
          value={dateFormatter.format(intervention.stoppedAt)}
        />
        <Row label={t('interventions.detail.duration')} value={durationLabel} />
      </Section>

      {intervention.description ? (
        <Section title={t('interventions.detail.description')}>
          <Text style={styles.bodyText}>{intervention.description}</Text>
        </Section>
      ) : null}

      <Section title={t('interventions.detail.targets')}>
        {detail.targets.length === 0 ? (
          <Text style={styles.muted}>{t('interventions.detail.emptyList')}</Text>
        ) : (
          detail.targets.map((target) => {
            const zone = zoneById.get(target.cultivableZoneId);
            return (
              <ItemCard
                key={target.id}
                leading={<ParcelShape svg={zone?.shapeSvg ?? null} />}
                title={zone?.name ?? t('interventions.detail.unknownItem')}
                subtitle={
                  zone?.areaHectares != null
                    ? t('interventions.spraying.areaHectares', {
                        value: formatHectares(zone.areaHectares),
                      })
                    : null
                }
                testID={`detail-target-${target.id}`}
              />
            );
          })
        )}
      </Section>

      <Section title={t('interventions.detail.doers')}>
        {detail.doers.length === 0 ? (
          <Text style={styles.muted}>{t('interventions.detail.emptyList')}</Text>
        ) : (
          detail.doers.map((doer) => (
            <ItemCard
              key={doer.id}
              title={productById.get(doer.productId)?.name ?? t('interventions.detail.unknownItem')}
              testID={`detail-row-${doer.id}`}
            />
          ))
        )}
      </Section>

      <Section title={t('interventions.detail.inputs')}>
        {detail.inputs.length === 0 ? (
          <Text style={styles.muted}>{t('interventions.detail.emptyList')}</Text>
        ) : (
          detail.inputs.map((input) => {
            const product = productById.get(input.productId);
            const variant = input.variantId ? variantById.get(input.variantId) : null;
            const quantity =
              `${formatQuantity(input.quantityValue)} ${input.quantityUnit ?? ''}`.trim();
            const total = inputAreaTotal(
              input.quantityHandler,
              input.quantityUnit,
              input.quantityValue,
              totalAreaHectares,
            );
            return (
              <ItemCard
                key={input.id}
                title={product?.name ?? t('interventions.detail.unknownItem')}
                subtitle={`${quantity}${variant ? ` · ${variant.name}` : ''}`}
                testID={`detail-input-${input.id}`}
              >
                {total ? (
                  <Text style={styles.total}>
                    {t('interventions.spraying.inputs.total', {
                      value: formatQuantity(total.value),
                      unit: total.unit,
                    })}
                  </Text>
                ) : null}
              </ItemCard>
            );
          })
        )}
      </Section>

      <Section title={t('interventions.detail.tools')}>
        {detail.tools.length === 0 ? (
          <Text style={styles.muted}>{t('interventions.detail.emptyList')}</Text>
        ) : (
          detail.tools.map((tool) => (
            <ItemCard
              key={tool.id}
              title={productById.get(tool.productId)?.name ?? t('interventions.detail.unknownItem')}
              testID={`detail-row-${tool.id}`}
            />
          ))
        )}
      </Section>
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

// Hectares avec 2 décimales max, sans zéro inutile (« 4,5 ha »).
function formatHectares(value: number): string {
  return value.toLocaleString('fr-FR', { maximumFractionDigits: 2, minimumFractionDigits: 0 });
}

function formatQuantity(value: number): string {
  return value.toLocaleString('fr-FR', { maximumFractionDigits: 3 });
}

// Total à l'hectare — miroir lecture seule de `InputsFieldArray.computeAreaTotal`
// (doses surfaciques : handler `*_area_density` ou unité par hectare).
function inputAreaTotal(
  handlerName: string,
  unit: string | null,
  quantity: number,
  areaHectares: number,
): { value: number; unit: string } | null {
  const isAreaDensity = handlerName.endsWith('_area_density') || (unit?.endsWith('/ha') ?? false);
  if (!isAreaDensity || !(quantity > 0) || !(areaHectares > 0)) return null;
  let base = unit ?? '';
  if (base.endsWith('_per_hectare')) base = base.slice(0, -'_per_hectare'.length);
  else if (base.endsWith('/ha')) base = base.slice(0, -3);
  return { value: quantity * areaHectares, unit: base };
}

function formatDuration(
  seconds: number,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  if (seconds <= 0) return t('interventions.detail.durationNone');
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return t('interventions.detail.durationMinutes', { minutes });
  if (minutes === 0) return t('interventions.detail.durationHours', { hours });
  return t('interventions.detail.durationHoursMinutes', { hours, minutes });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  muted: { color: colors.textMuted },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  heading: { flex: 1, fontSize: fontSize.xl, fontWeight: '600', color: colors.textPrimary },
  errorBanner: {
    backgroundColor: colors.dangerBg,
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  errorTitle: { fontSize: fontSize.base, fontWeight: '600', color: colors.danger, marginBottom: 4 },
  errorMessage: { fontSize: fontSize.md, color: colors.dangerText, marginBottom: spacing.md },
  retryButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.danger,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
  },
  retryButtonPressed: { opacity: 0.85 },
  retryButtonText: { color: colors.textOnBrand, fontSize: fontSize.base, fontWeight: '600' },
  section: { marginBottom: spacing.xl },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs },
  rowLabel: { fontSize: fontSize.base, color: colors.textSecondary },
  rowValue: { fontSize: fontSize.base, color: colors.textPrimary, fontWeight: '500' },
  bodyText: { fontSize: fontSize.base, color: colors.textPrimary, lineHeight: 20 },
  total: { fontSize: fontSize.md, color: colors.textSecondary, textAlign: 'right' },
});
