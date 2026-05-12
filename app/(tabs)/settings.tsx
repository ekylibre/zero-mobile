import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@core/auth/AuthContext';
import { usePendingInterventionCount } from '@features/catalog/hooks';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { state, logout } = useAuth();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const pendingCount = usePendingInterventionCount();

  const version = Constants.expoConfig?.version ?? '0.0.0';

  // Avertissement explicite si l'utilisateur s'apprête à perdre des
  // interventions saisies hors-ligne et jamais synchronisées (cf. brainstorm
  // §6 — la déconnexion purge les tables WDB locales).
  const handleLogoutPress = () => {
    const baseMessage = t('settings.logoutConfirmMessage');
    const warning =
      pendingCount > 0
        ? `${baseMessage}\n\n${t('settings.logoutPendingWarning', { count: pendingCount })}`
        : baseMessage;
    Alert.alert(t('settings.logoutConfirmTitle'), warning, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.logoutConfirm'),
        style: 'destructive',
        onPress: () => {
          void performLogout();
        },
      },
    ]);
  };

  const performLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      router.replace('/(auth)/login');
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('settings.title')}</Text>

      {state.status === 'authenticated' ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.account')}</Text>
          <Text style={styles.sectionItem}>
            {t('settings.signedInAs', { email: state.credentials.email })}
          </Text>
          <Text style={styles.sectionItem}>
            {t('settings.instance', { instanceUrl: state.credentials.instanceUrl })}
          </Text>
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        onPress={handleLogoutPress}
        disabled={loggingOut || state.status !== 'authenticated'}
        style={({ pressed }) => [
          styles.logoutButton,
          (loggingOut || state.status !== 'authenticated') && styles.logoutButtonDisabled,
          pressed && styles.logoutButtonPressed,
        ]}
        testID="settings-logout"
      >
        <Text style={styles.logoutButtonText}>
          {loggingOut ? t('settings.loggingOut') : t('settings.logoutAction')}
        </Text>
      </Pressable>

      <Text style={styles.version}>{t('settings.version', { version })}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 24 },
  section: { marginBottom: 32 },
  sectionTitle: { fontSize: 13, color: '#888', marginBottom: 8, textTransform: 'uppercase' },
  sectionItem: { fontSize: 15, color: '#222', marginBottom: 4 },
  logoutButton: {
    borderWidth: 1,
    borderColor: '#c22',
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  logoutButtonDisabled: { opacity: 0.5 },
  logoutButtonPressed: { backgroundColor: '#fff0f0' },
  logoutButtonText: { color: '#c22', fontSize: 16, fontWeight: '600' },
  version: { marginTop: 'auto', fontSize: 12, color: '#999', textAlign: 'center' },
});
