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

import { colors, fontSize, radius, spacing } from './theme';

export interface MultiSelectFieldProps<T> {
  label: string;
  items: T[];
  /** Items actuellement sélectionnés (source de vérité, contrôlée par le parent). */
  selected: T[];
  onChange: (next: T[]) => void;
  getKey: (item: T) => string;
  getLabel: (item: T) => string;
  getSubtitle?: (item: T) => string | null;
  /** Texte du déclencheur quand rien n'est sélectionné. */
  placeholder: string;
  /** Texte vide si `items.length === 0`. */
  emptyText?: string;
  searchHint?: string;
  noResultsText?: string;
  /**
   * Résumé affiché dans le déclencheur (sélection courante) et dans la barre de
   * validation (sélection en cours d'édition). Ex. « 2 cultures • 4,3 ha ».
   */
  summary?: (items: T[]) => string;
  validateLabel?: string;
  errorMessage?: string;
  testID?: string;
}

// Sélecteur multi-cibles : déclencheur + modal de sélection multiple, repris de
// l'ancienne app (« Sélectionnez des cultures » : liste cochable + barre verte
// « N cultures • X ha · VALIDER »). On édite un brouillon (`draft`) figé à
// l'ouverture ; rien n'est propagé tant que VALIDER n'est pas tapé (Annuler /
// fermeture = abandon). Sélection à plat (les cultivable_zones de l'app ne sont
// pas hiérarchisées par parcelle).
export function MultiSelectField<T>({
  label,
  items,
  selected,
  onChange,
  getKey,
  getLabel,
  getSubtitle,
  placeholder,
  emptyText,
  searchHint,
  noResultsText,
  summary,
  validateLabel,
  errorMessage,
  testID,
}: MultiSelectFieldProps<T>) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const needle = query.trim().toLowerCase();
    return items.filter((item) => getLabel(item).toLowerCase().includes(needle));
  }, [items, query, getLabel]);

  const openModal = () => {
    setDraft(new Set(selected.map(getKey)));
    setQuery('');
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  const toggle = (key: string) => {
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const validate = () => {
    onChange(items.filter((item) => draft.has(getKey(item))));
    close();
  };

  const draftItems = items.filter((item) => draft.has(getKey(item)));
  const triggerText =
    selected.length > 0 ? (summary?.(selected) ?? defaultSummary(selected.length, t)) : placeholder;
  const footerText = summary?.(draftItems) ?? defaultSummary(draftItems.length, t);

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        onPress={openModal}
        style={({ pressed }) => [
          styles.trigger,
          errorMessage ? styles.triggerError : null,
          pressed ? styles.triggerPressed : null,
        ]}
        testID={testID}
      >
        <View style={styles.triggerTextWrap}>
          <Text style={styles.triggerLabel}>{label}</Text>
          <Text
            style={selected.length > 0 ? styles.triggerValue : styles.triggerPlaceholder}
            numberOfLines={1}
          >
            {triggerText}
          </Text>
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
              const key = getKey(item);
              const checked = draft.has(key);
              const subtitle = getSubtitle?.(item);
              return (
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked }}
                  onPress={() => toggle(key)}
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                  testID={testID ? `${testID}-item-${key}` : undefined}
                >
                  <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                    {checked ? <Text style={styles.checkmark}>✓</Text> : null}
                  </View>
                  <View style={styles.rowTextWrap}>
                    <Text style={styles.rowLabel}>{getLabel(item)}</Text>
                    {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
                  </View>
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

          <View style={styles.footer}>
            <Text style={styles.footerSummary} numberOfLines={1}>
              {footerText}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={validate}
              style={({ pressed }) => [styles.validate, pressed && styles.validatePressed]}
              testID={testID ? `${testID}-validate` : undefined}
            >
              <Text style={styles.validateText}>{validateLabel ?? t('select.validate')}</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

function defaultSummary(
  count: number,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  return t('select.selectedCount', { count });
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
  rowPressed: ViewStyle;
  checkbox: ViewStyle;
  checkboxChecked: ViewStyle;
  checkmark: TextStyle;
  rowTextWrap: ViewStyle;
  rowLabel: TextStyle;
  rowSubtitle: TextStyle;
  empty: ViewStyle;
  emptyText: TextStyle;
  footer: ViewStyle;
  footerSummary: TextStyle;
  validate: ViewStyle;
  validatePressed: ViewStyle;
  validateText: TextStyle;
}>({
  container: { marginVertical: spacing.xs },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: 14,
    borderColor: colors.borderStrong,
    borderWidth: 1,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    gap: spacing.sm,
  },
  triggerPressed: { backgroundColor: colors.surface },
  triggerError: { borderColor: colors.danger },
  triggerTextWrap: { flex: 1 },
  triggerLabel: { fontSize: fontSize.sm, color: colors.textMuted, marginBottom: 2 },
  triggerValue: { fontSize: fontSize.base, color: colors.textPrimary, fontWeight: '500' },
  triggerPlaceholder: { fontSize: fontSize.base, color: colors.textMuted },
  chevron: { fontSize: fontSize.xl, color: colors.textMuted, lineHeight: 22 },
  error: { fontSize: fontSize.sm, color: colors.danger, marginTop: 4 },
  modalContainer: { flex: 1, backgroundColor: colors.background },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.green,
  },
  modalTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.textOnBrand },
  closeButton: { paddingVertical: 6, paddingHorizontal: 10 },
  closeButtonPressed: { opacity: 0.6 },
  closeButtonText: { color: colors.textOnBrand, fontSize: fontSize.base, fontWeight: '600' },
  search: {
    borderColor: colors.borderStrong,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    margin: spacing.lg,
    fontSize: fontSize.base,
    color: colors.textPrimary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    borderBottomColor: colors.divider,
    borderBottomWidth: StyleSheet.hairlineWidth,
    backgroundColor: colors.background,
    gap: spacing.md,
  },
  rowPressed: { backgroundColor: colors.surface },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: colors.green, borderColor: colors.green },
  checkmark: { color: colors.textOnBrand, fontSize: fontSize.base, fontWeight: '700' },
  rowTextWrap: { flex: 1 },
  rowLabel: { fontSize: fontSize.lg, color: colors.textPrimary },
  rowSubtitle: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 },
  empty: { padding: spacing.xxl, alignItems: 'center' },
  emptyText: { fontSize: fontSize.base, color: colors.textMuted, textAlign: 'center' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.green,
    gap: spacing.md,
  },
  footerSummary: { flex: 1, color: colors.textOnBrand, fontSize: fontSize.base, fontWeight: '600' },
  validate: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  validatePressed: { opacity: 0.7 },
  validateText: { color: colors.greenDark, fontSize: fontSize.base, fontWeight: '700' },
});
