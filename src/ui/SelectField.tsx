import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from './theme';

export interface SelectFieldProps<T> {
  label: string;
  /** Items proposés. Filtrés via `getLabel(item)` au moment de la recherche. */
  items: T[];
  value: T | null;
  onChange: (next: T | null) => void;
  getKey: (item: T) => string;
  getLabel: (item: T) => string;
  getSubtitle?: (item: T) => string | null;
  /** Texte placeholder du déclencheur (« Choisir une parcelle… »). */
  placeholder: string;
  /** Texte vide au cas où `items.length === 0` (« Aucune parcelle disponible »). */
  emptyText?: string;
  searchHint?: string;
  noResultsText?: string;
  errorMessage?: string;
  testID?: string;
}

// Sélecteur générique. Approche : Pressable affichant la valeur courante,
// au tap ouvre une Modal avec un TextInput de recherche + FlatList des items
// filtrés. Tap sur un item → onChange + close.
//
// Note : on évite le Picker natif RN (limité, UX différente iOS/Android,
// pas de recherche). La Modal est uniforme et testable.
export function SelectField<T>({
  label,
  items,
  value,
  onChange,
  getKey,
  getLabel,
  getSubtitle,
  placeholder,
  emptyText,
  searchHint,
  noResultsText,
  errorMessage,
  testID,
}: SelectFieldProps<T>) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const needle = query.trim().toLowerCase();
    return items.filter((item) => getLabel(item).toLowerCase().includes(needle));
  }, [items, query, getLabel]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  const select = (item: T) => {
    onChange(item);
    close();
  };

  const triggerLabel = value ? getLabel(value) : placeholder;
  const triggerSubtitle = value && getSubtitle ? getSubtitle(value) : null;

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.trigger,
          errorMessage ? styles.triggerError : null,
          pressed ? styles.triggerPressed : null,
        ]}
        testID={testID}
      >
        <View style={styles.triggerTextWrap}>
          <Text style={styles.triggerLabel}>{label}</Text>
          <Text style={value ? styles.triggerValue : styles.triggerPlaceholder} numberOfLines={1}>
            {triggerLabel}
          </Text>
          {triggerSubtitle ? (
            <Text style={styles.triggerSubtitle} numberOfLines={1}>
              {triggerSubtitle}
            </Text>
          ) : null}
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={close}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{label}</Text>
            <Pressable
              onPress={close}
              accessibilityRole="button"
              testID={testID ? `${testID}-close` : undefined}
              style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}
            >
              <Text style={styles.closeButtonText}>{t('common.cancel')}</Text>
            </Pressable>
          </View>

          {items.length > 0 ? (
            <TextInput
              style={styles.search}
              value={query}
              onChangeText={setQuery}
              placeholder={searchHint ?? t('select.searchHint')}
              autoCorrect={false}
              autoCapitalize="none"
              testID={testID ? `${testID}-search` : undefined}
            />
          ) : null}

          <FlatList
            data={filtered}
            keyExtractor={(item) => getKey(item)}
            renderItem={({ item }) => {
              const subtitle = getSubtitle?.(item);
              const isSelected = value !== null && getKey(item) === getKey(value);
              return (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => select(item)}
                  style={({ pressed }) => [
                    styles.row,
                    isSelected && styles.rowSelected,
                    pressed && styles.rowPressed,
                  ]}
                  testID={testID ? `${testID}-item-${getKey(item)}` : undefined}
                >
                  <View style={styles.rowTextWrap}>
                    <Text style={styles.rowLabel}>{getLabel(item)}</Text>
                    {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
                  </View>
                  {isSelected ? <Text style={styles.checkmark}>✓</Text> : null}
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyText}>
                  {items.length === 0
                    ? (emptyText ?? t('select.empty'))
                    : (noResultsText ?? t('select.noResults'))}
                </Text>
              </View>
            }
            keyboardShouldPersistTaps="handled"
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create<{
  container: ViewStyle;
  trigger: ViewStyle;
  triggerPressed: ViewStyle;
  triggerError: ViewStyle;
  triggerTextWrap: ViewStyle;
  triggerLabel: TextStyle;
  triggerValue: TextStyle;
  triggerPlaceholder: TextStyle;
  triggerSubtitle: TextStyle;
  chevron: TextStyle;
  error: TextStyle;
  modalContainer: ViewStyle;
  modalHeader: ViewStyle;
  modalTitle: TextStyle;
  closeButton: ViewStyle;
  closeButtonPressed: ViewStyle;
  closeButtonText: TextStyle;
  search: TextStyle;
  row: ViewStyle;
  rowSelected: ViewStyle;
  rowPressed: ViewStyle;
  rowTextWrap: ViewStyle;
  rowLabel: TextStyle;
  rowSubtitle: TextStyle;
  checkmark: TextStyle;
  empty: ViewStyle;
  emptyText: TextStyle;
}>({
  container: { marginVertical: 4 },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderColor: colors.borderStrong,
    borderWidth: 1,
    borderRadius: 6,
    backgroundColor: colors.background,
    gap: 8,
  },
  triggerPressed: { backgroundColor: colors.surface },
  triggerError: { borderColor: colors.danger },
  triggerTextWrap: { flex: 1 },
  triggerLabel: { fontSize: 12, color: colors.textMuted, marginBottom: 2 },
  triggerValue: { fontSize: 14, color: colors.textPrimary, fontWeight: '500' },
  triggerPlaceholder: { fontSize: 14, color: colors.textMuted },
  triggerSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  chevron: { fontSize: 22, color: colors.textMuted, lineHeight: 22 },
  error: { fontSize: 12, color: colors.danger, marginTop: 4 },
  modalContainer: { flex: 1, backgroundColor: colors.background },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomColor: colors.divider,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  closeButton: { paddingVertical: 6, paddingHorizontal: 10 },
  closeButtonPressed: { opacity: 0.6 },
  closeButtonText: { color: colors.blue, fontSize: 14, fontWeight: '500' },
  search: {
    borderColor: colors.borderStrong,
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    margin: 16,
    fontSize: 14,
    color: colors.textPrimary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomColor: colors.divider,
    borderBottomWidth: StyleSheet.hairlineWidth,
    backgroundColor: colors.background,
    gap: 8,
  },
  rowSelected: { backgroundColor: colors.blueSoft },
  rowPressed: { backgroundColor: colors.surface },
  rowTextWrap: { flex: 1 },
  rowLabel: { fontSize: 15, color: colors.textPrimary },
  rowSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  checkmark: { fontSize: 18, color: colors.blue, fontWeight: '600' },
  empty: { padding: 32, alignItems: 'center' },
  emptyText: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
});
