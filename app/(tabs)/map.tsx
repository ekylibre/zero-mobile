import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { MapView } from '@features/map/MapView';

export default function MapScreen() {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <MapView />
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
});
