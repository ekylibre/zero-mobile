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
import { ParcelShape, SyncBadge } from '@ui/index';

import { database } from '@core/db/database';
import type { Intervention, Product } from '@core/db/models';
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
        <Text style={styles.heading}>{procedure?.labelFr ?? intervention.procedureName}</Text>
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
              <View key={target.id} style={styles.parcelItem} testID={`detail-target-${target.id}`}>
                <ParcelShape svg={zone?.shapeSvg ?? null} />
                <View style={styles.parcelInfo}>
                  <Text style={styles.itemName}>
                    {zone?.name ?? t('interventions.detail.unknownItem')}
                  </Text>
                  {zone?.areaHectares != null ? (
                    <Text style={styles.itemSub}>
                      {t('interventions.spraying.areaHectares', {
                        value: formatHectares(zone.areaHectares),
                      })}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          })
        )}
      </Section>

      <Section title={t('interventions.detail.doers')}>
        <ProductList
          rows={detail.doers}
          productById={productById}
          emptyLabel={t('interventions.detail.emptyList')}
          unknownLabel={t('interventions.detail.unknownItem')}
        />
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
            return (
              <View key={input.id} style={styles.listItem} testID={`detail-input-${input.id}`}>
                <Text style={styles.itemName}>
                  {product?.name ?? t('interventions.detail.unknownItem')}
                </Text>
                <Text style={styles.itemSub}>
                  {quantity}
                  {variant ? ` · ${variant.name}` : ''}
                </Text>
              </View>
            );
          })
        )}
      </Section>

      <Section title={t('interventions.detail.tools')}>
        <ProductList
          rows={detail.tools}
          productById={productById}
          emptyLabel={t('interventions.detail.emptyList')}
          unknownLabel={t('interventions.detail.unknownItem')}
        />
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

function ProductList({
  rows,
  productById,
  emptyLabel,
  unknownLabel,
}: {
  rows: { id: string; productId: string }[];
  productById: Map<string, Product>;
  emptyLabel: string;
  unknownLabel: string;
}) {
  if (rows.length === 0) return <Text style={styles.muted}>{emptyLabel}</Text>;
  return (
    <>
      {rows.map((row) => (
        <View key={row.id} style={styles.listItem} testID={`detail-row-${row.id}`}>
          <Text style={styles.itemName}>
            {productById.get(row.productId)?.name ?? unknownLabel}
          </Text>
        </View>
      ))}
    </>
  );
}

// Hectares avec 2 décimales max, sans zéro inutile (« 4,5 ha »).
function formatHectares(value: number): string {
  return value.toLocaleString('fr-FR', { maximumFractionDigits: 2, minimumFractionDigits: 0 });
}

function formatQuantity(value: number): string {
  return value.toLocaleString('fr-FR', { maximumFractionDigits: 3 });
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
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16, paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  muted: { color: '#888' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  heading: { flex: 1, fontSize: 22, fontWeight: '600', color: '#222' },
  errorBanner: {
    backgroundColor: '#fde6e6',
    borderColor: '#a3171c',
    borderWidth: 1,
    borderRadius: 6,
    padding: 12,
    marginBottom: 16,
  },
  errorTitle: { fontSize: 14, fontWeight: '600', color: '#a3171c', marginBottom: 4 },
  errorMessage: { fontSize: 13, color: '#5a0c10', marginBottom: 12 },
  retryButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#a3171c',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  retryButtonPressed: { opacity: 0.85 },
  retryButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  rowLabel: { fontSize: 14, color: '#666' },
  rowValue: { fontSize: 14, color: '#222', fontWeight: '500' },
  bodyText: { fontSize: 14, color: '#222', lineHeight: 20 },
  parcelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderTopColor: '#eee',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  parcelInfo: { flex: 1 },
  listItem: {
    paddingVertical: 8,
    borderTopColor: '#eee',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  itemName: { fontSize: 14, color: '#222', fontWeight: '500' },
  itemSub: { fontSize: 13, color: '#666', marginTop: 2 },
});
