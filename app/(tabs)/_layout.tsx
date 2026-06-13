import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { usePendingInterventionCount } from '@features/catalog/hooks';
import { CogIcon, LandParcelIcon, TractorIcon } from '@ui/icons/TabBarIcons';

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
          tabBarIcon: ({ color, size }) => <TractorIcon color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: t('tabs.map'),
          tabBarIcon: ({ color, size }) => <LandParcelIcon color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
          tabBarIcon: ({ color, size }) => <CogIcon color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
