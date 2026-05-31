import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from './theme';

export type DateTimeMode = 'date' | 'time' | 'datetime';

export interface DateTimeFieldProps {
  label: string;
  value: Date;
  onChange: (next: Date) => void;
  mode?: DateTimeMode;
  minimumDate?: Date;
  maximumDate?: Date;
  testID?: string;
  errorMessage?: string;
}

// iOS = picker inline déclenché à l'écran (mode "default" dans une overlay).
// Android = pas de mode "datetime" natif → on enchaîne picker date puis
// picker heure pour rester cohérent. Sur iOS, mode datetime est natif.
export function DateTimeField({
  label,
  value,
  onChange,
  mode = 'datetime',
  minimumDate,
  maximumDate,
  testID,
  errorMessage,
}: DateTimeFieldProps) {
  const { i18n } = useTranslation();
  // 'date' → on affiche le picker date ; 'time' → picker heure ;
  // 'datetime' Android → on suit la séquence date puis time.
  const [shown, setShown] = useState<null | 'date' | 'time'>(null);

  const formatter = useMemo(() => {
    const opts: Intl.DateTimeFormatOptions = {};
    if (mode !== 'time') {
      opts.day = '2-digit';
      opts.month = 'short';
      opts.year = 'numeric';
    }
    if (mode !== 'date') {
      opts.hour = '2-digit';
      opts.minute = '2-digit';
    }
    return new Intl.DateTimeFormat(i18n.language || 'fr', opts);
  }, [mode, i18n.language]);

  const open = () => {
    if (mode === 'time') setShown('time');
    else setShown('date');
  };

  const handleChange = (event: DateTimePickerEvent, picked?: Date) => {
    // Android : event.type peut être 'dismissed' (annulation). On ferme et
    // on n'écrit pas la valeur. iOS : type est 'set' à chaque drag, on
    // applique au fil de l'eau.
    if (Platform.OS === 'android') {
      const next = picked && event.type === 'set' ? picked : null;
      if (!next) {
        setShown(null);
        return;
      }
      if (mode === 'datetime' && shown === 'date') {
        // Reporte l'heure d'origine sur la nouvelle date.
        const merged = new Date(next);
        merged.setHours(value.getHours(), value.getMinutes(), 0, 0);
        onChange(merged);
        setShown('time');
        return;
      }
      if (shown === 'time') {
        const merged = new Date(value);
        merged.setHours(next.getHours(), next.getMinutes(), 0, 0);
        onChange(merged);
      } else {
        onChange(next);
      }
      setShown(null);
      return;
    }

    // iOS : pas de Modal explicite, le picker reste affiché tant que
    // l'utilisateur ne tape pas en dehors. On applique à chaque event.
    if (picked) onChange(picked);
  };

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        onPress={open}
        style={({ pressed }) => [
          styles.trigger,
          errorMessage ? styles.triggerError : null,
          pressed ? styles.triggerPressed : null,
        ]}
        testID={testID}
      >
        <Text style={styles.triggerLabel}>{label}</Text>
        <Text style={styles.triggerValue}>{formatter.format(value)}</Text>
      </Pressable>

      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

      {shown && Platform.OS === 'ios' ? (
        <DateTimePicker
          value={value}
          mode={shown === 'time' ? 'time' : mode}
          display="default"
          onChange={handleChange}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
        />
      ) : null}

      {shown && Platform.OS === 'android' ? (
        <DateTimePicker
          value={value}
          mode={shown}
          onChange={handleChange}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginVertical: 4 },
  trigger: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderColor: colors.borderStrong,
    borderWidth: 1,
    borderRadius: 6,
    backgroundColor: colors.background,
  },
  triggerPressed: { backgroundColor: colors.surface },
  triggerError: { borderColor: colors.danger },
  triggerLabel: { fontSize: 14, color: colors.textSecondary },
  triggerValue: { fontSize: 14, color: colors.textPrimary, fontWeight: '500' },
  error: { fontSize: 12, color: colors.danger, marginTop: 4 },
});
