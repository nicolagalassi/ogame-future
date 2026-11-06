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
