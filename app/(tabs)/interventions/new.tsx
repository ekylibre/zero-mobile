import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import { useProcedures } from '@features/catalog/hooks';
import { ProcedurePickerView } from '@features/intervention/ProcedurePickerView';

export default function NewInterventionScreen() {
  const router = useRouter();
  const procedures = useProcedures();

  // V1 = uniquement spraying. Au lieu d'une route paramétrée, on dispatche
  // explicitement vers l'écran qui sait remplir le formulaire choisi.
  // `replace` plutôt que `push` pour que le bouton retour ramène à la liste,
  // pas au picker (sinon back → picker → back encore = retour à la liste,
  // sensation d'app qui patine).
  const onSelect = useCallback(
    (procedureName: string) => {
      if (procedureName === 'spraying') {
        router.replace('/(tabs)/interventions/spraying');
      }
    },
    [router],
  );

  return <ProcedurePickerView procedures={procedures} onSelect={onSelect} />;
}
