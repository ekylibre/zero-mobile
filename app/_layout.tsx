import * as Sentry from '@sentry/react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthProvider, useAuth } from '@core/auth/AuthContext';
import { initI18n } from '@core/i18n';
import { initSentry } from '@core/observability/sentry';

initSentry();
initI18n();

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function RootNavigator() {
  const { state } = useAuth();

  useEffect(() => {
    if (state.status !== 'loading') {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [state.status]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}

function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="auto" />
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(RootLayout);
