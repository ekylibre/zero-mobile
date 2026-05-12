import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { database } from '@core/db/database';
import { captureException } from '@core/observability/sentry';
import type { SprayingIntervention } from '@domain/procedures/spraying';
import { useCultivableZones, useProductsByType, useVariants } from '@features/catalog/hooks';
import { SprayingFormView } from '@features/intervention/SprayingFormView';
import { persistSprayingIntervention } from '@features/intervention/persister';

// Catégorie Ekylibre des variants compatibles avec un input `plant_medicine`.
// Si on ouvre les autres procédures (semis, récolte) en v1.5, on étendra le
// filtre — pour l'instant on shippe FR-FR phyto uniquement.
const PLANT_MEDICINE_CATEGORY = 'plant_medicine';

export default function SprayingFormScreen() {
  const router = useRouter();
  const { t } = useTranslation();
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

  const onSubmit = useCallback(
    async (input: SprayingIntervention) => {
      setSubmitting(true);
      setSubmitError(null);
      try {
        await persistSprayingIntervention(database, input);
        Alert.alert(t('interventions.spraying.title'), t('interventions.spraying.saved'));
        router.replace('/(tabs)/interventions');
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setSubmitError(message);
        captureException(error);
      } finally {
        setSubmitting(false);
      }
    },
    [router, t],
  );

  return (
    <SprayingFormView
      cultivableZones={cultivableZones}
      workers={workers}
      equipments={equipments}
      matters={matters}
      variants={phytoVariants}
      onSubmit={onSubmit}
      submitting={submitting}
      submitError={submitError}
    />
  );
}
