import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Procedure } from '@core/db/models';
import { EmptyState } from '@ui/index';

// V1 ne sait remplir qu'une seule procédure : `spraying`. On filtre en
// amont (au lieu de désactiver les autres) pour ne pas inviter
// l'utilisateur à taper un item sans suite. Au moment où on saura
// remplir d'autres procédures (P-v1.5+), on étend ce set.
const SUPPORTED_PROCEDURES = new Set<string>(['spraying']);

export interface ProcedurePickerViewProps {
  procedures: Procedure[];
  onSelect: (procedureName: string) => void;
}

export function ProcedurePickerView({ procedures, onSelect }: ProcedurePickerViewProps) {
  const { t } = useTranslation();
  const supported = procedures.filter((p) => SUPPORTED_PROCEDURES.has(p.name));

  return (
    <View style={styles.container}>
      <Text style={styles.subtitle}>{t('interventions.new.subtitle')}</Text>

      <FlatList
        data={supported}
        keyExtractor={(item) => item.name}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => onSelect(item.name)}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            testID={`procedure-row-${item.name}`}
          >
            <Text style={styles.rowTitle}>{item.labelFr || item.name}</Text>
            <Text style={styles.rowChevron}>›</Text>
          </Pressable>
        )}
        ListEmptyComponent={<EmptyState title={t('interventions.new.empty')} />}
        contentContainerStyle={supported.length === 0 ? styles.emptyContent : undefined}
        testID="procedure-picker-list"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  subtitle: {
    fontSize: 13,
    color: '#666',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderBottomColor: '#eee',
    borderBottomWidth: StyleSheet.hairlineWidth,
    backgroundColor: '#fff',
  },
  rowPressed: { backgroundColor: '#fafafa' },
  rowTitle: { fontSize: 16, color: '#222', fontWeight: '500' },
  rowChevron: { fontSize: 22, color: '#999', lineHeight: 22 },
  emptyContent: { flexGrow: 1 },
});
