import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, View } from 'react-native';

import { database } from '@core/db/database';
import { captureException } from '@core/observability/sentry';
import type { SprayingIntervention } from '@domain/procedures/spraying';
import { parseSprayingHandlers } from '@domain/procedures/spraying-handlers';
import {
  useCultivableZones,
  useInterventionById,
  useProcedureByName,
  useProductsByType,
  useVariants,
} from '@features/catalog/hooks';
import { SprayingFormView } from '@features/intervention/SprayingFormView';
import {
  persistSprayingIntervention,
  updateSprayingIntervention,
} from '@features/intervention/persister';

const PLANT_MEDICINE_CATEGORY = 'plant_medicine';

export default function SprayingFormScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = typeof id === 'string' && id.length > 0;

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const cultivableZones = useCultivableZones();
  const workers = useProductsByType('workers');
  const equipments = useProductsByType('equipments');
  const matters = useProductsByType('matters');
  const allVariants = useVariants();
  const phytoVariants = useMemo(
    () => allVariants.filter((v) => v.category === PLANT_MEDICINE_CATEGORY),
    [allVariants],
  );

  const sprayingProcedure = useProcedureByName('spraying');
  const handlers = useMemo(
    () => parseSprayingHandlers(sprayingProcedure?.definition),
    [sprayingProcedure],
  );

  // Mode édition : on charge l'intervention + ses relations (ids locaux WDB) et
  // on reconstruit la forme du formulaire. Le hook est appelé inconditionnellement
  // (id undefined → renvoie un détail vide) pour respecter les règles des hooks.
  const detail = useInterventionById(isEdit ? id : undefined);

  const initialValues = useMemo<SprayingIntervention | undefined>(() => {
    if (!isEdit || !detail.intervention) return undefined;
    return toFormValues(detail);
  }, [isEdit, detail]);

  const onSubmit = useCallback(
    async (input: SprayingIntervention) => {
      setSubmitting(true);
      setSubmitError(null);
      try {
        if (isEdit && id) {
          await updateSprayingIntervention(database, id, input);
          Alert.alert(t('interventions.edit.title'), t('interventions.edit.saved'));
        } else {
          await persistSprayingIntervention(database, input);
          Alert.alert(t('interventions.spraying.title'), t('interventions.spraying.saved'));
        }
        router.replace('/(tabs)/interventions');
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setSubmitError(message);
        captureException(error);
      } finally {
        setSubmitting(false);
      }
    },
    [isEdit, id, router, t],
  );

  // En édition, on attend que l'intervention ET ses relations soient chargées
  // avant de monter le formulaire. `useInterventionById` charge l'intervention
  // et ses enfants (doers/targets/inputs/tools) via des souscriptions WDB
  // distinctes qui émettent de façon asynchrone : si on montait dès que
  // `intervention` arrive, RHF figerait des tableaux encore vides (defaultValues
  // est capturé au montage) → perte des cibles/intrants. Une intervention
  // spraying valide a toujours ≥1 de chaque relation (garanti par le schéma Zod
  // à la création), donc on peut attendre qu'elles soient toutes non vides.
  const childrenLoaded =
    detail.doers.length > 0 &&
    detail.targets.length > 0 &&
    detail.inputs.length > 0 &&
    detail.tools.length > 0;
  if (isEdit && (!initialValues || !childrenLoaded)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <SprayingFormView
      // `key` distinct en édition : garantit un montage propre avec les
      // initialValues une fois l'intervention chargée.
      key={isEdit ? `edit-${id}` : 'create'}
      cultivableZones={cultivableZones}
      workers={workers}
      equipments={equipments}
      matters={matters}
      variants={phytoVariants}
      handlers={handlers}
      initialValues={initialValues}
      onSubmit={onSubmit}
      onCancel={() => router.back()}
      submitting={submitting}
      submitError={submitError}
    />
  );
}

// Convertit l'intervention chargée (modèles WDB) vers la forme attendue par le
// formulaire / le schéma Zod. Les `reference_name` sont garantis par le schéma
// de création initial — on les ré-affirme via le typage du domaine.
function toFormValues(detail: ReturnType<typeof useInterventionById>): SprayingIntervention {
  const intervention = detail.intervention!;
  return {
    procedure_name: 'spraying',
    started_at: intervention.startedAt,
    stopped_at: intervention.stoppedAt,
    description: intervention.description ?? '',
    doers: detail.doers.map((d) => ({
      product_id: d.productId,
      reference_name: 'driver' as const,
    })),
    inputs: detail.inputs.map((i) => ({
      product_id: i.productId,
      variant_id: i.variantId ?? undefined,
      reference_name: 'plant_medicine' as const,
      quantity_value: i.quantityValue,
      quantity_handler: i.quantityHandler,
      quantity_unit: i.quantityUnit ?? '',
    })),
    targets: detail.targets.map((tg) => ({
      cultivable_zone_id: tg.cultivableZoneId,
      reference_name: 'cultivation' as const,
    })),
    tools: detail.tools.map((tl) => ({
      product_id: tl.productId,
      reference_name: 'sprayer' as const,
    })),
  };
}
