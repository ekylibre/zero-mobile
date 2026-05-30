import { useTranslation } from 'react-i18next';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import type { Product, Variant } from '@core/db/models';
import type { SprayingInput } from '@domain/procedures/spraying';
import type { SprayingHandlerOption } from '@domain/procedures/spraying-handlers';
import { SelectField } from '@ui/index';

export interface InputsFieldArrayProps {
  value: SprayingInput[];
  onChange: (next: SprayingInput[]) => void;
  /** Catalogue produits matters (intrants phytosanitaires). */
  products: Product[];
  /** Catalogue variants filtré (côté parent) sur la catégorie pertinente. */
  variants: Variant[];
  /** Handlers (mesure + unité) issus de la définition de procédure. */
  handlers: SprayingHandlerOption[];
  /** Erreur agrégée Zod au niveau du tableau (« min 1 required »). */
  errorMessage?: string | null;
  testID?: string;
}

interface HandlerOption {
  value: string;
  label: string;
  /** Unité Ekylibre canonique appliquée quand ce handler est choisi. */
  unit: string;
}

export function InputsFieldArray({
  value,
  onChange,
  products,
  variants,
  handlers,
  errorMessage,
  testID,
}: InputsFieldArrayProps) {
  const { t } = useTranslation();

  const handlerOptions: HandlerOption[] = handlers.map((h) => ({
    value: h.name,
    label: t(h.labelKey),
    unit: h.unit,
  }));

  const updateRow = (index: number, patch: Partial<SprayingInput>) => {
    onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const removeRow = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const addRow = () => {
    onChange([
      ...value,
      {
        product_id: '',
        reference_name: 'plant_medicine',
        quantity_value: 0,
        quantity_handler: '',
        quantity_unit: '',
      },
    ]);
  };

  return (
    <View testID={testID}>
      {value.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{t('interventions.spraying.inputs.empty')}</Text>
        </View>
      ) : null}

      {value.map((row, index) => (
        <InputRow
          key={index}
          index={index}
          row={row}
          products={products}
          variants={variants}
          handlerOptions={handlerOptions}
          onUpdate={(patch) => updateRow(index, patch)}
          onRemove={() => removeRow(index)}
          testID={testID ? `${testID}-row-${index}` : undefined}
        />
      ))}

      {errorMessage ? (
        <Text style={styles.error} testID={testID ? `${testID}-error` : undefined}>
          {errorMessage}
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        onPress={addRow}
        style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
        testID={testID ? `${testID}-add` : undefined}
      >
        <Text style={styles.addButtonText}>{t('interventions.spraying.inputs.addAction')}</Text>
      </Pressable>
    </View>
  );
}

interface InputRowProps {
  index: number;
  row: SprayingInput;
  products: Product[];
  variants: Variant[];
  handlerOptions: HandlerOption[];
  onUpdate: (patch: Partial<SprayingInput>) => void;
  onRemove: () => void;
  testID?: string;
}

function InputRow({
  index,
  row,
  products,
  variants,
  handlerOptions,
  onUpdate,
  onRemove,
  testID,
}: InputRowProps) {
  const { t } = useTranslation();

  const selectedProduct = row.product_id
    ? (products.find((p) => p.id === row.product_id) ?? null)
    : null;
  const selectedVariant = row.variant_id
    ? (variants.find((v) => v.id === row.variant_id) ?? null)
    : null;
  const selectedHandler = row.quantity_handler
    ? (handlerOptions.find((h) => h.value === row.quantity_handler) ?? null)
    : null;

  return (
    <View style={styles.row}>
      <View style={styles.rowHeader}>
        <Text style={styles.rowTitle}>
          {t('interventions.spraying.inputs.rowTitle', { index: index + 1 })}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={onRemove}
          style={({ pressed }) => [styles.removeButton, pressed && styles.removeButtonPressed]}
          testID={testID ? `${testID}-remove` : undefined}
        >
          <Text style={styles.removeButtonText}>
            {t('interventions.spraying.inputs.removeAction')}
          </Text>
        </Pressable>
      </View>

      <SelectField<Product>
        label={t('interventions.spraying.inputs.productLabel')}
        items={products}
        value={selectedProduct}
        onChange={(p) => onUpdate({ product_id: p?.id ?? '' })}
        getKey={(p) => p.id}
        getLabel={(p) => p.name}
        getSubtitle={(p) => p.variety ?? null}
        placeholder={t('interventions.spraying.inputs.productPlaceholder')}
        emptyText={t('interventions.spraying.inputs.productEmpty')}
        testID={testID ? `${testID}-product` : undefined}
      />

      <SelectField<Variant>
        label={t('interventions.spraying.inputs.variantLabel')}
        items={variants}
        value={selectedVariant}
        onChange={(v) => onUpdate({ variant_id: v?.id ?? undefined })}
        getKey={(v) => v.id}
        getLabel={(v) => v.name}
        getSubtitle={(v) => v.unit ?? null}
        placeholder={t('interventions.spraying.inputs.variantPlaceholder')}
        emptyText={t('interventions.spraying.inputs.variantEmpty')}
        testID={testID ? `${testID}-variant` : undefined}
      />

      <View style={styles.quantityRow}>
        <View style={styles.quantityValue}>
          <Text style={styles.fieldLabel}>{t('interventions.spraying.inputs.quantityLabel')}</Text>
          <TextInput
            style={styles.numericInput}
            keyboardType="decimal-pad"
            value={row.quantity_value > 0 ? String(row.quantity_value) : ''}
            placeholder={t('interventions.spraying.inputs.quantityPlaceholder')}
            onChangeText={(text) => {
              // Accepte virgule ou point comme séparateur décimal (UX FR).
              const normalized = text.replace(',', '.');
              const parsed = Number.parseFloat(normalized);
              onUpdate({ quantity_value: Number.isFinite(parsed) ? parsed : 0 });
            }}
            testID={testID ? `${testID}-quantity` : undefined}
          />
        </View>

        <View style={styles.quantityHandler}>
          <SelectField<HandlerOption>
            label={t('interventions.spraying.inputs.handlerLabel')}
            items={handlerOptions}
            value={selectedHandler}
            onChange={(opt) =>
              onUpdate({ quantity_handler: opt?.value ?? '', quantity_unit: opt?.unit ?? '' })
            }
            getKey={(o) => o.value}
            getLabel={(o) => o.label}
            placeholder={t('interventions.spraying.inputs.handlerPlaceholder')}
            testID={testID ? `${testID}-handler` : undefined}
          />
        </View>
      </View>

      <View style={styles.unitWrap}>
        <Text style={styles.fieldLabel}>{t('interventions.spraying.inputs.unitLabel')}</Text>
        {/* Unité dérivée du handler choisi : affichage lecture seule, jamais
            saisie librement (sinon paire handler/unité incohérente côté API). */}
        <Text style={styles.unitValue} testID={testID ? `${testID}-unit` : undefined}>
          {row.quantity_unit ? row.quantity_unit : '—'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create<{
  empty: ViewStyle;
  emptyText: TextStyle;
  row: ViewStyle;
  rowHeader: ViewStyle;
  rowTitle: TextStyle;
  removeButton: ViewStyle;
  removeButtonPressed: ViewStyle;
  removeButtonText: TextStyle;
  quantityRow: ViewStyle;
  quantityValue: ViewStyle;
  quantityHandler: ViewStyle;
  fieldLabel: TextStyle;
  numericInput: TextStyle;
  unitWrap: ViewStyle;
  unitValue: TextStyle;
  addButton: ViewStyle;
  addButtonPressed: ViewStyle;
  addButtonText: TextStyle;
  error: TextStyle;
}>({
  empty: {
    backgroundColor: '#f5f5f5',
    borderRadius: 6,
    padding: 12,
    marginBottom: 8,
  },
  emptyText: { fontSize: 13, color: '#888', fontStyle: 'italic', textAlign: 'center' },
  row: {
    backgroundColor: '#fafafa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderColor: '#e5e5e5',
    borderWidth: 1,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  rowTitle: { fontSize: 14, fontWeight: '600', color: '#444' },
  removeButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  removeButtonPressed: { backgroundColor: '#fde6e6' },
  removeButtonText: { fontSize: 13, color: '#a3171c', fontWeight: '500' },
  quantityRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  quantityValue: { flex: 1 },
  quantityHandler: { flex: 2 },
  fieldLabel: { fontSize: 12, color: '#888', marginBottom: 4, marginTop: 4 },
  numericInput: {
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#222',
    backgroundColor: '#fff',
  },
  unitWrap: { marginTop: 4 },
  unitValue: {
    borderColor: '#eee',
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#555',
    backgroundColor: '#f5f5f5',
  },
  addButton: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 6,
    borderColor: '#0066cc',
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    marginTop: 4,
  },
  addButtonPressed: { backgroundColor: '#eef6ff' },
  addButtonText: { color: '#0066cc', fontSize: 14, fontWeight: '600' },
  error: { fontSize: 12, color: '#a3171c', marginTop: 4, marginBottom: 4 },
});
