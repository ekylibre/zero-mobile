import type { Database } from '@nozbe/watermelondb';
import { OfflineManager } from '@maplibre/maplibre-react-native';
import { Directory, File, Paths } from 'expo-file-system';

import type { CultivableZone } from '@core/db/models';
import { Tables } from '@core/db/schema';

import { computeBbox, expandBbox, toFeatureCollection, type Bbox } from './geo';
import { OSM_RASTER_STYLE } from './osm-style';

// Nom unique du pack — on en gère un seul (couvre toutes les cultivable_zones).
const PACK_NAME = 'zero-mobile-parcels';
// Buffer autour de la bbox des parcelles : ~5 km pour pouvoir naviguer un peu
// hors-zone sans hit réseau (workflow §8).
const BUFFER_KM = 5;
// Bornes zoom :
//   - min=8 → niveau département (vue d'ensemble)
//   - max=14 → niveau parcelle clairement lisible
// Plus haut = explosion du nombre de tuiles (chaque +1 = ×4) et des CGU OSM.
const MIN_ZOOM = 8;
const MAX_ZOOM = 14;

// Tolérance d'égalité de bbox pour éviter de re-créer un pack pour quelques
// mètres de drift (sélection de parcelles légèrement déplacée par le serveur).
const BBOX_EQ_EPSILON_DEG = 0.005; // ≈ 500 m

function bboxesAlmostEqual(a: Bbox, b: Bbox): boolean {
  for (let i = 0; i < 4; i++) {
    if (Math.abs(a[i]! - b[i]!) > BBOX_EQ_EPSILON_DEG) return false;
  }
  return true;
}

// Le pack stocke la bbox dans metadata — c'est la source de vérité pour
// décider create vs invalidate vs replace.
interface PackMetadata {
  bbox?: Bbox;
}

function readPackBbox(metadata: Record<string, unknown> | undefined): Bbox | null {
  const raw = metadata?.bbox;
  if (!Array.isArray(raw) || raw.length !== 4) return null;
  if (!raw.every((v) => typeof v === 'number')) return null;
  return raw as Bbox;
}

// Le style MapLibre est inline en TS (osm-style.ts) ; OfflineManager exige une
// URL (string). On le matérialise une fois sur disque (Paths.cache → wipé par
// le système si la place manque, mais regénérable instantanément).
let styleUriCache: string | null = null;

function ensureStyleFile(): string {
  if (styleUriCache) return styleUriCache;
  const dir = new Directory(Paths.cache, 'map');
  if (!dir.exists) dir.create({ intermediates: true });
  const file = new File(dir, 'osm-style.json');
  // Écrit (ou ré-écrit) à chaque cold start — c'est immédiat et garantit la
  // cohérence avec le code TS si on bump le style.
  file.write(JSON.stringify(OSM_RASTER_STYLE));
  styleUriCache = file.uri;
  return styleUriCache;
}

export interface RefreshOfflinePackResult {
  /** 'skipped' = pas de géométrie à cacher, 'unchanged' = bbox identique. */
  action: 'created' | 'invalidated' | 'replaced' | 'skipped' | 'unchanged';
  bbox: Bbox | null;
}

// Idempotent : appelable après chaque cycle de sync.
// Ne jette JAMAIS sauf erreur de programmation — les erreurs natives sont
// remontées par le callback errorListener du pack, pas par cette fonction
// (elles n'invalident pas la sync).
export async function refreshOfflinePack(
  zones: CultivableZone[],
): Promise<RefreshOfflinePackResult> {
  // Bbox des zones avec géométrie + buffer.
  const fc = toFeatureCollection(zones, () => false);
  const rawBbox = computeBbox(fc);
  if (!rawBbox) return { action: 'skipped', bbox: null };
  const bbox = expandBbox(rawBbox, BUFFER_KM);

  const styleUri = ensureStyleFile();
  const existing = (await OfflineManager.getPacks()).find(
    (p) => (p.metadata as PackMetadata | undefined)?.bbox !== undefined && nameMatches(p),
  );

  // Pas de pack existant → create.
  if (!existing) {
    await OfflineManager.createPack(
      {
        mapStyle: styleUri,
        bounds: bbox,
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        metadata: { name: PACK_NAME, bbox } satisfies Record<string, unknown>,
      },
      noopProgress,
      noopError,
    );
    return { action: 'created', bbox };
  }

  // Pack existe : bbox identique → just invalidate (re-télécharge les stales).
  const previousBbox = readPackBbox(existing.metadata as Record<string, unknown>);
  if (previousBbox && bboxesAlmostEqual(previousBbox, bbox)) {
    await OfflineManager.invalidatePack(existing.id);
    return { action: 'unchanged', bbox };
  }

  // Bbox a changé → delete + create.
  await OfflineManager.deletePack(existing.id);
  await OfflineManager.createPack(
    {
      mapStyle: styleUri,
      bounds: [
        [bbox[0], bbox[1]],
        [bbox[2], bbox[3]],
      ] as unknown as [number, number, number, number],
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      metadata: { name: PACK_NAME, bbox } satisfies Record<string, unknown>,
    },
    noopProgress,
    noopError,
  );
  return { action: 'replaced', bbox };
}

function nameMatches(pack: { metadata: Record<string, unknown> }): boolean {
  return pack.metadata?.name === PACK_NAME;
}

const noopProgress = () => {
  /* progress géré nativement, pas d'UI v1 */
};
const noopError = () => {
  /* erreurs réseau pendant le DL ne doivent pas casser la sync */
};

/**
 * Entrée à appeler depuis le sync-cycle (fire-and-forget). Charge les zones
 * depuis WDB et délègue à `refreshOfflinePack`. Avale toute erreur — un
 * problème de précache **ne doit pas** marquer le cycle de sync comme échec.
 */
export async function triggerOfflineRefresh(database: Database): Promise<void> {
  try {
    const zones = await database.collections
      .get<CultivableZone>(Tables.cultivableZones)
      .query()
      .fetch();
    await refreshOfflinePack(zones);
  } catch (error) {
    // Silent côté sync — un précache foireux n'invalide pas le pull/push.
    // On laisse un breadcrumb pour la trace, sans event Sentry (volume).
    try {
      const { addBreadcrumb } = await import('@core/observability/sentry');
      addBreadcrumb({
        category: 'offline-cache',
        level: 'warning',
        message: 'triggerOfflineRefresh failed',
        data: { error: error instanceof Error ? error.message : String(error) },
      });
    } catch {
      /* never throw from telemetry */
    }
  }
}
