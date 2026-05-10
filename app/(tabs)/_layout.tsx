import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { usePendingInterventionCount } from '@features/catalog/hooks';

export default function TabsLayout() {
  const { t } = useTranslation();
  const pending = usePendingInterventionCount();

  return (
    <Tabs screenOptions={{ headerShown: true }}>
      <Tabs.Screen
        name="interventions"
        options={{
          title: t('tabs.interventions'),
          headerShown: false,
          tabBarBadge: pending > 0 ? pending : undefined,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: t('tabs.map'),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
        }}
      />
    </Tabs>
  );
}
