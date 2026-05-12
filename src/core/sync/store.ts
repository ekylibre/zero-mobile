import { create } from 'zustand';

// Statut éphémère du cycle de sync. Les compteurs durables (pendingCount,
// last_pulled_at, sync_state par intervention) restent dans WatermelonDB,
// observés via les hooks dédiés (`usePendingInterventionCount`, etc.).
// Le store ne porte que le « est-ce qu'un cycle tourne là maintenant ?
// si oui dans quelle phase ? si non, quelle erreur ? ».
export type SyncStatus = 'idle' | 'pulling' | 'pushing' | 'error';

export interface SyncStoreState {
  status: SyncStatus;
  /**
   * Message d'erreur global au cycle de sync (réseau down, push complet
   * échoué, etc.). Pas l'erreur par intervention — celle-là est dans
   * `intervention.sync_error_message`.
   */
  lastError: string | null;
  /**
   * Timestamp ms du dernier cycle terminé (succès comme erreur), pour
   * l'horodatage UI « Dernière sync : il y a 3 min ». null tant qu'aucun
   * cycle n'a tourné depuis le démarrage de l'app.
   */
  lastSyncAt: number | null;
}

export interface SyncStoreActions {
  setStatus: (status: SyncStatus) => void;
  /**
   * Pose `lastError` et bascule `status` à 'error' si non null, sinon 'idle'.
   * Utilisé par le moteur en fin de cycle.
   */
  setError: (message: string | null) => void;
  /** Marque la fin d'un cycle (succès ou erreur) avec le timestamp courant. */
  markCompleted: () => void;
  /** Réinitialise (utilisé au logout pour repartir propre). */
  reset: () => void;
}

export type SyncStore = SyncStoreState & SyncStoreActions;

const INITIAL_STATE: SyncStoreState = {
  status: 'idle',
  lastError: null,
  lastSyncAt: null,
};

export const useSyncStore = create<SyncStore>((set) => ({
  ...INITIAL_STATE,
  setStatus: (status) => set({ status }),
  setError: (message) =>
    set((s) => ({
      lastError: message,
      status: message ? 'error' : s.status === 'error' ? 'idle' : s.status,
    })),
  markCompleted: () => set({ lastSyncAt: Date.now() }),
  reset: () => set({ ...INITIAL_STATE }),
}));
