/**
 * The game's own technology pictures, for Future's lists (the plan). They are one big sprite sheet
 * on the game's CDN; the game's CSS places each tile. Future reads where each tile is when the
 * player opens a building, research, shipyard or defence page, and keeps it.
 *
 * COMPLIANCE: a read of the page the player opened (computed styles); no request of Future's own:
 * the picture is the one the game already loaded.
 */
import type { Store } from '../core/storage';

export interface TechIcon {
  url: string;
  /** Computed background-position and background-size of the game's tile. */
  pos: string;
  size: string;
  /** Tile side in px. */
  w: number;
}

export const TECH_ICONS_KEY = 'tech.icons';

/** Every technology tile on the page, by id. */
export function readTechIcons(doc: Document): Record<string, TechIcon> {
  const view = doc.defaultView;
  const out: Record<string, TechIcon> = {};
  if (!view) return out;
  for (const tech of doc.querySelectorAll<HTMLElement>('#technologies .technology[data-technology]')) {
    const tile = tech.querySelector<HTMLElement>('.icon');
    if (!tile) continue;
    const cs = view.getComputedStyle(tile);
    const url = /url\("?([^")]+)"?\)/.exec(cs.backgroundImage)?.[1];
    const w = parseFloat(cs.width);
    if (url && w > 0) out[tech.dataset.technology!] = { url, pos: cs.backgroundPosition, size: cs.backgroundSize, w };
  }
  return out;
}

/** Keeps the tiles of this page (one write, only when something changed). */
export function rememberTechIcons(doc: Document, store: Store): void {
  const seen = readTechIcons(doc);
  if (!Object.keys(seen).length) return;
  const known = store.get<Record<string, TechIcon>>(TECH_ICONS_KEY, {});
  if (Object.entries(seen).every(([id, i]) => JSON.stringify(known[id]) === JSON.stringify(i))) return;
  store.set(TECH_ICONS_KEY, { ...known, ...seen });
}

/** The game's CSS class of each base technology's tile (`.sprite_medium.<class>`, on every game page). */
const TILE_CLASS: Record<number, string> = {
  1: 'metalMine', 2: 'crystalMine', 3: 'deuteriumSynthesizer', 4: 'solarPlant', 12: 'fusionPlant',
  14: 'roboticsFactory', 15: 'naniteFactory', 21: 'shipyard', 22: 'metalStorage', 23: 'crystalStorage',
  24: 'deuteriumStorage', 31: 'researchLaboratory', 33: 'terraformer', 34: 'allianceDepot', 36: 'repairDock',
  41: 'moonbase', 42: 'sensorPhalanx', 43: 'jumpGate', 44: 'missileSilo', 45: 'iaScanner',
  106: 'espionageTechnology', 108: 'computerTechnology', 109: 'weaponsTechnology', 110: 'shieldingTechnology',
  111: 'armorTechnology', 113: 'energyTechnology', 114: 'hyperspaceTechnology', 115: 'combustionDriveTechnology',
  117: 'impulseDriveTechnology', 118: 'hyperspaceDriveTechnology', 120: 'laserTechnology', 121: 'ionTechnology',
  122: 'plasmaTechnology', 123: 'researchNetworkTechnology', 124: 'astrophysicsTechnology', 199: 'gravitonTechnology',
  202: 'transporterSmall', 203: 'transporterLarge', 204: 'fighterLight', 205: 'fighterHeavy', 206: 'cruiser',
  207: 'battleship', 208: 'colonyShip', 209: 'recycler', 210: 'espionageProbe', 211: 'bomber', 212: 'solarSatellite',
  213: 'destroyer', 214: 'deathstar', 215: 'interceptor', 217: 'resbuggy', 218: 'reaper', 219: 'explorer',
  401: 'rocketLauncher', 402: 'laserCannonLight', 403: 'laserCannonHeavy', 404: 'gaussCannon', 405: 'ionCannon',
  406: 'plasmaCannon', 407: 'shieldDomeSmall', 408: 'shieldDomeLarge', 502: 'missileInterceptor', 503: 'missileInterplanetary',
};

/** Every lifeform technology: species 1–4, buildings 1s101–1s112, research 1s201–1s218. */
const LF_IDS = [1, 2, 3, 4].flatMap((s) => [...Array.from({ length: 12 }, (_, i) => 10101 + s * 1000 + i), ...Array.from({ length: 18 }, (_, i) => 10201 + s * 1000 + i)]);

/**
 * The tiles of technologies whose page was never opened, from the game's own stylesheet: every
 * game page carries the sprite rules (the base tiles as `.sprite_medium.<class>`, the lifeform
 * ones as the queue's `.lifeformqueue.lifeformTech<id>`). A hidden probe element per tile, read
 * and removed; the same pictures the game already loaded, no request.
 */
export function probeTechIcons(doc: Document, ids: number[]): Record<string, TechIcon> {
  const view = doc.defaultView;
  const out: Record<string, TechIcon> = {};
  if (!view || !doc.body) return out;
  const box = doc.createElement('div');
  box.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;';
  doc.body.append(box);
  for (const id of ids) {
    const cls = TILE_CLASS[id] ? `icon sprite sprite_medium medium ${TILE_CLASS[id]}` : LF_IDS.includes(id) ? `queuePic lifeformqueue lifeformTech${id}` : '';
    if (!cls) continue;
    const el = doc.createElement('div');
    el.className = cls;
    box.append(el);
    const cs = view.getComputedStyle(el);
    const url = /url\("?([^")]+)"?\)/.exec(cs.backgroundImage)?.[1];
    const w = parseFloat(cs.width);
    // A class the stylesheet does not know falls back to the sheet's first tile: not that one.
    const pos = cs.backgroundPosition;
    if (url && w > 0 && (id === 1 || id === 11101 || !/^0(px|%) 0(px|%)$/.test(pos))) out[id] = { url, pos, size: cs.backgroundSize, w };
  }
  box.remove();
  return out;
}

/** The known tiles, the missing ones filled from the game's stylesheet (kept, one write). */
export function techIcons(doc: Document, store: Store): Record<string, TechIcon> {
  const known = store.get<Record<string, TechIcon>>(TECH_ICONS_KEY, {});
  const missing = [...Object.keys(TILE_CLASS).map(Number), ...LF_IDS].filter((id) => !known[id]);
  if (!missing.length) return known;
  const found = probeTechIcons(doc, missing);
  if (!Object.keys(found).length) return known;
  const all = { ...known, ...found };
  store.set(TECH_ICONS_KEY, all);
  return all;
}

/** A square picture of `px` side; an empty square when the tile was never seen. */
export function techIconEl(doc: Document, icon: TechIcon | undefined, px: number, cls = 'tico'): HTMLElement {
  const box = doc.createElement('span');
  box.className = cls;
  box.style.cssText = `display:inline-block;flex:none;width:${px}px;height:${px}px;overflow:hidden;border-radius:4px;background:#16243A;vertical-align:middle;`;
  if (!icon) return box;
  const tile = doc.createElement('span');
  tile.style.cssText = `display:block;width:${icon.w}px;height:${icon.w}px;background-image:url("${icon.url}");background-position:${icon.pos};background-size:${icon.size};background-repeat:no-repeat;transform:scale(${px / icon.w});transform-origin:0 0;`;
  box.append(tile);
  return box;
}
