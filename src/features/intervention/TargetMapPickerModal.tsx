import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import type { CultivableZone } from '@core/db/models';
import { MapView } from '@features/map/MapView';
import { toFeatureCollection } from '@features/map/geo';

export interface TargetMapPickerModalProps {
  visible: boolean;
  zones: CultivableZone[];
  /** Ids locaux WDB des parcelles initialement sélectionnées. */
  initialSelectedIds: string[];
  onConfirm: (selectedIds: string[]) => void;
  onCancel: () => void;
}

export function TargetMapPickerModal({
  visible,
  zones,
  initialSelectedIds,
  onConfirm,
  onCancel,
}: TargetMapPickerModalProps) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialSelectedIds));

  // Rejouer la sélection à chaque ouverture — le parent peut avoir édité la
  // liste via le picker textuel entre deux ouvertures.
  useEffect(() => {
    if (visible) setSelected(new Set(initialSelectedIds));
  }, [visible, initialSelectedIds]);

  const parcels = useMemo(
    () => toFeatureCollection(zones, (id) => selected.has(id)),
    [zones, selected],
  );
  const hasGeometry = parcels.features.length > 0;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const count = selected.size;

  return (
    <Modal
      visible={visible}
      onRequestClose={onCancel}
      animationType="slide"
      presentationStyle="fullScreen"
      testID="target-map-picker-modal"
    >
      <View style={styles.container}>
        <MapView parcels={parcels} onParcelPress={toggle} />

        {!hasGeometry ? (
          <View style={styles.banner} pointerEvents="none">
            <Text style={styles.bannerTitle}>{t('map.emptyTitle')}</Text>
            <Text style={styles.bannerBody}>{t('map.emptyBody')}</Text>
          </View>
        ) : null}

        <View style={styles.actionBar}>
          <Pressable
            onPress={onCancel}
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
            style={({ pressed }) => [
              styles.actionButton,
              styles.actionButtonCancel,
              pressed && styles.actionButtonPressed,
            ]}
            testID="target-map-cancel"
          >
            <Text style={styles.actionButtonCancelText}>{t('common.cancel')}</Text>
          </Pressable>

          <Text style={styles.counter} numberOfLines={1}>
            {count === 0
              ? t('interventions.spraying.targetMap.none')
              : t('interventions.spraying.targetMap.count', { count })}
          </Text>

          <Pressable
            onPress={() => onConfirm(Array.from(selected))}
            accessibilityRole="button"
            accessibilityLabel={t('select.validate')}
            accessibilityHint={
              count === 0
                ? t('interventions.spraying.targetMap.none')
                : t('interventions.spraying.targetMap.count', { count })
            }
            style={({ pressed }) => [
              styles.actionButton,
              styles.actionButtonConfirm,
              pressed && styles.actionButtonPressed,
            ]}
            testID="target-map-confirm"
          >
            <Text style={styles.actionButtonConfirmText}>{t('select.validate')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
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

  // Barre d'actions flottante en bas de l'écran (au-dessus de la carte).
  // paddingBottom élevé pour rester au-dessus du home indicator iOS sans
  // dépendre de SafeAreaView (le modal en `presentationStyle: 'fullScreen'`
  // n'hérite pas systématiquement des insets selon les versions Expo).
  actionBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  counter: {
    flex: 1,
    textAlign: 'center',
    fontSize: 13,
    color: '#4b5563',
    paddingHorizontal: 8,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 88,
    alignItems: 'center',
  },
  actionButtonPressed: { opacity: 0.7 },
  actionButtonCancel: { backgroundColor: '#f3f4f6' },
  actionButtonCancelText: { fontSize: 14, fontWeight: '500', color: '#374151' },
  actionButtonConfirm: { backgroundColor: '#2563eb' },
  actionButtonConfirmText: { fontSize: 14, fontWeight: '600', color: '#fff' },
});
