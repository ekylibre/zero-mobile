import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

// Placeholder P1 — carte MapLibre + tuiles OSM livrée en P7.
export default function MapScreen() {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('map.placeholder')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { fontSize: 16, color: '#666' },
});
