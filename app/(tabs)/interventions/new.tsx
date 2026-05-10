import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

// Placeholder P1 — picker de procédure (v1 = uniquement spraying) livré en P5.
export default function NewInterventionScreen() {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('interventions.new.placeholder')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { fontSize: 16, color: '#666' },
});
