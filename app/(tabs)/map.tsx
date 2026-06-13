import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { useCultivableZones } from '@features/catalog/hooks';
import { MapView } from '@features/map/MapView';
import { toFeatureCollection } from '@features/map/geo';

export default function MapScreen() {
  const { t } = useTranslation();
  const zones = useCultivableZones();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const parcels = useMemo(
    () => toFeatureCollection(zones, (id) => id === selectedId),
    [zones, selectedId],
  );
  const selectedZone = useMemo(
    () => (selectedId ? (zones.find((z) => z.id === selectedId) ?? null) : null),
    [zones, selectedId],
  );

  const hasGeometry = parcels.features.length > 0;

  return (
    <View style={styles.container}>
      <MapView parcels={parcels} onParcelPress={setSelectedId} />

      {!hasGeometry ? (
        <View style={styles.banner} pointerEvents="none">
          <Text style={styles.bannerTitle}>{t('map.emptyTitle')}</Text>
          <Text style={styles.bannerBody}>{t('map.emptyBody')}</Text>
        </View>
      ) : null}

      {selectedZone ? (
        <View style={styles.selection}>
          <Text style={styles.selectionName} numberOfLines={2}>
            {selectedZone.name}
          </Text>
          <Text style={styles.selectionMeta}>
            {selectedZone.kind === 'plant' ? t('map.kindPlant') : t('map.kindParcel')}
            {selectedZone.areaHectares != null
              ? ` • ${t('map.areaSuffix', { value: selectedZone.areaHectares.toFixed(2) })}`
              : ''}
          </Text>
        </View>
      ) : null}

      <View style={styles.attribution} pointerEvents="none">
        <Text style={styles.attributionText}>{t('map.attribution')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  attribution: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(255,255,255,0.8)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  attributionText: { fontSize: 10, color: '#333' },
  banner: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  bannerTitle: { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 4 },
  bannerBody: { fontSize: 12, color: '#4b5563' },
  selection: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  selectionName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  selectionMeta: { fontSize: 12, color: '#6b7280', marginTop: 2 },
});
