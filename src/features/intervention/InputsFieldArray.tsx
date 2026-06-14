import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TextInput, View, type TextStyle, type ViewStyle } from 'react-native';

import type { Product, Variant } from '@core/db/models';
import type { SprayingInput } from '@domain/procedures/spraying';
import {
  deriveHandlerFromBaseUnit,
  type SprayingHandlerOption,
} from '@domain/procedures/spraying-handlers';
import {
  InlineAddButton,
  ItemCard,
  SelectField,
  colors,
  fontSize,
  radius,
  spacing,
} from '@ui/index';

export interface InputsFieldArrayProps {
  value: SprayingInput[];
  onChange: (next: SprayingInput[]) => void;
  /** Catalogue produits matters (intrants phytosanitaires). */
  products: Product[];
  /** Catalogue variants filtré (côté parent) sur la catégorie pertinente. */
  variants: Variant[];
  /** Handlers (mesure + unité) issus de la définition de procédure. */
  handlers: SprayingHandlerOption[];
  /**
   * Surface totale des cibles (ha) — somme des cibles sélectionnées. Utilisée
   * pour calculer le « X l au total » des doses à l'hectare. 0 si non calculable.
   */
  totalAreaHectares?: number;
  /**
   * Unité de base de la variante par défaut de chaque produit (`liter`,
   * `kilogram`, `unity`). Sert à pré-remplir le handler quand l'utilisateur
   * sélectionne un produit. Map vide ou prop absente → pas de pré-remplissage.
   */
  productDefaultUnits?: ReadonlyMap<string, string>;
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
  totalAreaHectares = 0,
  productDefaultUnits,
  errorMessage,
  testID,
}: InputsFieldArrayProps) {
  const { t } = useTranslation();

  const handlerOptions: HandlerOption[] = handlers.map((h) => ({
    value: h.name,
    label: t(h.labelKey),
    unit: h.unit,
  }));

  // Dérivation handler par défaut à partir de l'unité de la variante du produit
  // (liter → volume_area_density / l/ha, kilogram → mass_area_density / kg/ha,
  // unity → population / unity). Override systématique au changement de produit
  // (cf. spec UX).
  const deriveDefaultHandler = (productId: string): SprayingHandlerOption | null =>
    deriveHandlerFromBaseUnit(productDefaultUnits?.get(productId), handlers);

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
          totalAreaHectares={totalAreaHectares}
          deriveDefaultHandler={deriveDefaultHandler}
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

      <InlineAddButton
        label={t('interventions.spraying.inputs.addAction')}
        onPress={addRow}
        testID={testID ? `${testID}-add` : undefined}
      />
    </View>
  );
}

interface InputRowProps {
  index: number;
  row: SprayingInput;
  products: Product[];
  variants: Variant[];
  handlerOptions: HandlerOption[];
  totalAreaHectares: number;
  deriveDefaultHandler: (productId: string) => SprayingHandlerOption | null;
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
  totalAreaHectares,
  deriveDefaultHandler,
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

  const total = computeAreaTotal(
    row.quantity_handler,
    row.quantity_unit,
    row.quantity_value,
    totalAreaHectares,
  );

  return (
    <ItemCard
      title={
        selectedProduct?.name ?? t('interventions.spraying.inputs.rowTitle', { index: index + 1 })
      }
      subtitle={selectedVariant?.name ?? null}
      onRemove={onRemove}
      removeAccessibilityLabel={t('interventions.spraying.inputs.removeAction')}
      testID={testID}
    >
      <SelectField<Product>
        label={t('interventions.spraying.inputs.productLabel')}
        items={products}
        value={selectedProduct}
        onChange={(p) => {
          // Au changement de produit, on déduit aussi le handler par défaut
          // depuis l'unité de la variante du produit (override systématique :
          // le pré-remplissage prend le pas sur une sélection manuelle
          // précédente, alignée sur la spec UX).
          if (!p) {
            onUpdate({ product_id: '', quantity_handler: '', quantity_unit: '' });
            return;
          }
          const derived = deriveDefaultHandler(p.id);
          onUpdate({
            product_id: p.id,
            quantity_handler: derived?.name ?? '',
            quantity_unit: derived?.unit ?? '',
          });
        }}
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
            saisie librement (sinon paire handler/unité incohérente côté API).
            Libellé FR court (l/ha, kg/ha…), fallback sur la valeur brute si
            la clé i18n manque — la valeur envoyée au serveur reste l'unité
            Ekylibre canonique stockée dans `row.quantity_unit`. */}
        <Text style={styles.unitValue} testID={testID ? `${testID}-unit` : undefined}>
          {row.quantity_unit
            ? t(`interventions.spraying.units.${row.quantity_unit}`, {
                defaultValue: row.quantity_unit,
              })
            : '—'}
        </Text>
      </View>

      {total ? (
        <Text style={styles.total} testID={testID ? `${testID}-total` : undefined}>
          {t('interventions.spraying.inputs.total', {
            value: formatQuantity(total.value),
            unit: total.unit,
          })}
        </Text>
      ) : null}
    </ItemCard>
  );
}

// Total à l'hectare : ne s'applique qu'aux doses surfaciques. Une dose est
// surfacique si son handler est `*_area_density` OU si son unité est par
// hectare (forme courte API « l/ha » ou forme canonique « liter_per_hectare »).
// Pour une quantité absolue (« l », « kg », « unity ») le total = la quantité
// saisie : on n'affiche pas de ligne redondante.
//
// L'unité du total est l'unité de base (sans le « par hectare ») : « l/ha » →
// « l », « liter_per_hectare » → « liter ». On reste sur l'unité brute (comme
// le reste de l'app) ; une éventuelle jolification des unités est globale (P-G).
function computeAreaTotal(
  handlerName: string,
  unit: string | undefined,
  quantity: number,
  areaHectares: number,
): { value: number; unit: string } | null {
  const isAreaDensity = handlerName.endsWith('_area_density') || (unit?.endsWith('/ha') ?? false);
  if (!isAreaDensity) return null;
  if (!(quantity > 0) || !(areaHectares > 0)) return null;
  let base = unit ?? '';
  if (base.endsWith('_per_hectare')) base = base.slice(0, -'_per_hectare'.length);
  else if (base.endsWith('/ha')) base = base.slice(0, -3);
  return { value: quantity * areaHectares, unit: base };
}

function formatQuantity(value: number): string {
  return value.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
}

const styles = StyleSheet.create<{
  empty: ViewStyle;
  emptyText: TextStyle;
  quantityRow: ViewStyle;
  quantityValue: ViewStyle;
  quantityHandler: ViewStyle;
  fieldLabel: TextStyle;
  numericInput: TextStyle;
  unitWrap: ViewStyle;
  unitValue: TextStyle;
  total: TextStyle;
  error: TextStyle;
}>({
  empty: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  quantityRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  quantityValue: { flex: 1 },
  quantityHandler: { flex: 2 },
  fieldLabel: { fontSize: fontSize.sm, color: colors.textMuted, marginBottom: 4, marginTop: 4 },
  numericInput: {
    borderColor: colors.borderStrong,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: 14,
    fontSize: fontSize.base,
    color: colors.textPrimary,
    backgroundColor: colors.background,
  },
  unitWrap: { marginTop: spacing.xs },
  unitValue: {
    borderColor: colors.divider,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: 14,
    fontSize: fontSize.base,
    color: colors.textSecondary,
    backgroundColor: colors.surfaceAlt,
  },
  total: {
    marginTop: spacing.sm,
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'right',
  },
  error: { fontSize: fontSize.sm, color: colors.danger, marginTop: 4, marginBottom: 4 },
});
