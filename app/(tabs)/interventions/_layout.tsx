import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function InterventionsLayout() {
  const { t } = useTranslation();

  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: t('interventions.list.title') }} />
      <Stack.Screen name="new" options={{ title: t('interventions.new.title') }} />
      <Stack.Screen name="[id]" options={{ title: t('interventions.detail.title') }} />
    </Stack>
  );
}
