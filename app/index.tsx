import { Redirect } from 'expo-router';

import { useAuth } from '@core/auth/AuthContext';

export default function Index() {
  const { state } = useAuth();

  if (state.status === 'loading') {
    // Le splash reste visible tant que AuthProvider n'a pas terminé l'hydratation.
    return null;
  }
  if (state.status === 'authenticated') {
    // L'écran initial-sync court-circuite si la sync est déjà OK.
    return <Redirect href="/(auth)/initial-sync" />;
  }
  return <Redirect href="/(auth)/login" />;
}
