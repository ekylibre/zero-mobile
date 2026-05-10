import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ApiError, AuthError, NetworkError } from '@core/api/errors';
import { useAuth } from '@core/auth/AuthContext';
import { loginSchema, type LoginFormValues } from '@core/auth/login-schema';

export default function LoginScreen() {
  const { t } = useTranslation();
  const { state, login } = useAuth();
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { instanceUrl: '', email: '', password: '' },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setSubmitError(null);
    try {
      await login(values.instanceUrl, values.email, values.password);
      router.replace('/(auth)/initial-sync');
    } catch (e) {
      if (e instanceof AuthError) {
        setSubmitError(t('login.errors.invalidCredentials'));
      } else if (e instanceof NetworkError) {
        setSubmitError(t('login.errors.network'));
      } else if (e instanceof ApiError) {
        setSubmitError(t('login.errors.server'));
      } else {
        setSubmitError(t('login.errors.server'));
      }
    }
  };

  const sessionExpiredBanner =
    state.status === 'unauthenticated' && state.reason === 'session-expired' ? (
      <View style={styles.banner} accessibilityRole="alert">
        <Text style={styles.bannerText}>{t('login.sessionExpired')}</Text>
      </View>
    ) : null;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{t('login.title')}</Text>
        <Text style={styles.subtitle}>{t('login.subtitle')}</Text>

        {sessionExpiredBanner}

        <Field
          label={t('login.instanceUrlLabel')}
          placeholder={t('login.instanceUrlPlaceholder')}
          autoCapitalize="none"
          keyboardType="url"
          autoCorrect={false}
          control={control}
          name="instanceUrl"
          error={errors.instanceUrl?.message ? t(errors.instanceUrl.message) : undefined}
          testID="login-instanceUrl"
        />
        <Field
          label={t('login.emailLabel')}
          placeholder={t('login.emailPlaceholder')}
          autoCapitalize="none"
          keyboardType="email-address"
          autoCorrect={false}
          control={control}
          name="email"
          error={errors.email?.message ? t(errors.email.message) : undefined}
          testID="login-email"
        />
        <Field
          label={t('login.passwordLabel')}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          control={control}
          name="password"
          error={errors.password?.message ? t(errors.password.message) : undefined}
          testID="login-password"
        />

        {submitError ? (
          <Text style={styles.submitError} accessibilityRole="alert">
            {submitError}
          </Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          onPress={handleSubmit(onSubmit)}
          disabled={isSubmitting}
          style={({ pressed }) => [
            styles.submitButton,
            isSubmitting && styles.submitButtonDisabled,
            pressed && styles.submitButtonPressed,
          ]}
          testID="login-submit"
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>{t('login.submit')}</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

interface FieldProps {
  label: string;
  placeholder?: string;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences';
  keyboardType?: 'default' | 'email-address' | 'url';
  autoCorrect?: boolean;
  control: ReturnType<typeof useForm<LoginFormValues>>['control'];
  name: keyof LoginFormValues;
  error?: string;
  testID?: string;
}

function Field({
  label,
  placeholder,
  secureTextEntry,
  autoCapitalize = 'sentences',
  keyboardType = 'default',
  autoCorrect = true,
  control,
  name,
  error,
  testID,
}: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Controller
        control={control}
        name={name}
        render={({ field: { value, onChange, onBlur } }) => (
          <TextInput
            style={[styles.input, error ? styles.inputError : undefined]}
            placeholder={placeholder}
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            secureTextEntry={secureTextEntry}
            autoCapitalize={autoCapitalize}
            keyboardType={keyboardType}
            autoCorrect={autoCorrect}
            testID={testID}
          />
        )}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { padding: 24, paddingTop: 64 },
  title: { fontSize: 24, fontWeight: '600', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 24 },
  banner: {
    backgroundColor: '#fff7e6',
    borderColor: '#f0c36d',
    borderWidth: 1,
    padding: 12,
    borderRadius: 6,
    marginBottom: 16,
  },
  bannerText: { color: '#7a4f00', fontSize: 13 },
  field: { marginBottom: 16 },
  label: { fontSize: 13, color: '#444', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  inputError: { borderColor: '#c22' },
  fieldError: { color: '#c22', fontSize: 12, marginTop: 4 },
  submitError: {
    color: '#c22',
    fontSize: 14,
    marginVertical: 12,
    textAlign: 'center',
  },
  submitButton: {
    backgroundColor: '#0066cc',
    paddingVertical: 14,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: { backgroundColor: '#7faedf' },
  submitButtonPressed: { opacity: 0.85 },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
