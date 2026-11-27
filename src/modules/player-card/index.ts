/**
 * The player card: pointing at a player's name (galaxy, highscore) shows their points and rank in every
 * category, the military split into fleet and defences, the ships, as OGLight's player tooltip does.
 *
 * COMPLIANCE (AGENTS.md §4, §6): the points come from the universe's public API (playerData.xml), read
 * as 'user-view' only for the player pointed at, and cached (data/player-api). A short pause before the
 * card opens (hover intent) keeps a pointer sweeping down a list from asking for every row; it is UI
 * timing for what the player points at, never a game action nor a repeated call.
 */
import { WINDOW_TOKENS } from '../../core/sheet';
import type { NetworkGuard } from '../../core/guard';
import type { Store } from '../../core/storage';
import { formatUnits } from '../../core/format';
import { icon, type IconName } from '../../core/icons';
import { playerScores, type PlayerScores, type ScoreType } from '../../data/player-api';
import { splitMilitary } from '../../engines/military';

export interface PlayerCardOptions {
  doc: Document;
  store: Store;
  guard: NetworkGuard;
  t: (key: string, vars?: Record<string, string | number>) => string;
  locale: string;
}

export const CARD_ID = 'fut-player-card';
/** Pause before the card opens under a pointer (ms): long enough to cross a row, short enough to feel immediate. */
const INTENT_MS = 180;

/** Categories in the card, as the side bar's player sheet colours them. */
const LOOK: [ScoreType, IconName, string][] = [
  ['total', 'star', '#F5B547'], ['economy', 'swap', '#7FB8FF'], ['research', 'eye', '#4FE0B0'],
  ['lifeform', 'user', '#E58CDB'], ['military', 'fleet', '#FF7A7A'],
];

const CSS = `
#${CARD_ID} { ${WINDOW_TOKENS} }
#${CARD_ID} {
  position: fixed; z-index: 1000002; width: 260px; padding: 10px 12px; border: 1px solid var(--line-strong); border-radius: 8px;
  background: var(--bg); box-shadow: 0 10px 30px rgba(0,0,0,0.6); font: 12px/16px var(--body); color: var(--text-2);
  text-align: left; pointer-events: none;
}
#${CARD_ID} h4 { display: flex; align-items: baseline; gap: 8px; margin: 0 0 6px; font-size: 13px; font-weight: 700; color: var(--text); }
#${CARD_ID} h4 .name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#${CARD_ID} h4 .rank { margin-left: auto; color: var(--accent); font: 600 condensed 14px var(--display); font-variant-numeric: tabular-nums; }
#${CARD_ID} table { width: 100%; border-collapse: collapse; }
#${CARD_ID} td { padding: 2px 0; border-bottom: 1px solid var(--line-soft); font-variant-numeric: tabular-nums; white-space: nowrap; }
#${CARD_ID} td .k { display: inline-flex; align-items: center; gap: 6px; vertical-align: middle; }
#${CARD_ID} td + td { text-align: right; color: var(--text); font: 600 condensed 14px/18px var(--display); }
#${CARD_ID} td.r { color: var(--accent); padding-left: 10px; font-weight: 400; }
/* Fleet and defences under Militare: indented and quieter, an estimate without a rank. */
#${CARD_ID} tr.sub td { color: var(--muted); font-size: 11px; }
#${CARD_ID} tr.sub td:first-child { padding-left: 18px; }
#${CARD_ID} p { margin: 6px 0 0; color: var(--muted); font-size: 11px; }
#${CARD_ID} .err { color: var(--bad); }
`;

let cardFor = 0;
let pending: ReturnType<typeof setTimeout> | undefined;

function el<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const n = doc.createElement(tag);
  if (cls) n.className = cls;
  if (text) n.textContent = text;
  return n;
}

export function closePlayerCard(doc: Document): void {
  clearTimeout(pending);
  cardFor = 0;
  doc.getElementById(CARD_ID)?.remove();
}

/**
 * Shows the card while the pointer (or the keyboard focus) is on `anchor`. Once per element: calling it
 * again on the same element does nothing.
 */
export function attachPlayerCard(o: PlayerCardOptions, anchor: HTMLElement, id: number, name: string): void {
  if (anchor.dataset.futCard) return;
  anchor.dataset.futCard = String(id);
  anchor.addEventListener('mouseenter', () => {
    clearTimeout(pending);
    pending = setTimeout(() => void openPlayerCard(o, anchor, id, name), INTENT_MS);
  });
  anchor.addEventListener('focus', () => void openPlayerCard(o, anchor, id, name));
  anchor.addEventListener('mouseleave', () => closePlayerCard(o.doc));
  anchor.addEventListener('blur', () => closePlayerCard(o.doc));
}

export async function openPlayerCard(o: PlayerCardOptions, anchor: Element, id: number, name: string): Promise<void> {
  const { doc, t, locale } = o;
  if (!doc.getElementById('fut-player-card-css')) {
    const style = el(doc, 'style');
    style.id = 'fut-player-card-css';
    style.textContent = CSS;
    doc.head.append(style);
  }
  closePlayerCard(doc);
  cardFor = id;
  const card = el(doc, 'div');
  card.id = CARD_ID;
  card.setAttribute('role', 'tooltip');
  const head = el(doc, 'h4');
  head.append(el(doc, 'span', 'name', name));
  card.append(head);
  const note = el(doc, 'p', '', t('galaxy.loading'));
  card.append(note);
  doc.body.append(card);
  // Beside the name, inside the window: right of it when there is room, else left; level with it when possible.
  const place = () => {
    const box = anchor.getBoundingClientRect();
    const view = doc.defaultView;
    const w = card.offsetWidth;
    const h = card.offsetHeight;
    const vw = view?.innerWidth ?? 1200;
    const vh = view?.innerHeight ?? 800;
    const left = box.right + 10 + w <= vw - 8 ? box.right + 10 : Math.max(8, box.left - 10 - w);
    card.style.left = `${left}px`;
    card.style.top = `${Math.max(8, Math.min(box.top - 8, vh - h - 8))}px`;
  };
  place();
  let data: PlayerScores | null = null;
  try {
    data = await playerScores(o.guard, o.store, doc.location.origin, id, Date.now());
  } catch {
    data = null;
  }
  if (cardFor !== id || !card.isConnected) return; // the pointer moved on
  if (!data) {
    note.textContent = t('galaxy.apiError');
    note.className = 'err';
    return;
  }
  const rank = data.scores.total?.rank;
  if (rank) head.append(el(doc, 'span', 'rank', `#${rank.toLocaleString(locale)}`));
  const table = el(doc, 'table');
  const line = (cls: string, glyph: SVGSVGElement | null, label: string, value: string, rankText: string) => {
    const tr = el(doc, 'tr', cls);
    const k = el(doc, 'span', 'k');
    if (glyph) k.append(glyph);
    k.append(doc.createTextNode(label));
    const first = el(doc, 'td');
    first.append(k);
    tr.append(first, el(doc, 'td', '', value), el(doc, 'td', 'r', rankText));
    table.append(tr);
    return tr;
  };
  for (const [key, ico, color] of LOOK) {
    const v = data.scores[key];
    if (!v) continue;
    const g = icon(doc, ico, 12);
    g.style.color = color;
    line('', g, t(`galaxy.score.${key}`), formatUnits(v.points, locale), `#${v.rank.toLocaleString(locale)}`);
    // Military split into fleet and defences, worked out from the other scores (engines/military).
    if (key === 'military') {
      const split = splitMilitary(data.scores);
      if (split) for (const [part, points] of [['fleet', split.fleet], ['defence', split.defence]] as const) {
        line('sub', null, t(`galaxy.score.${part}`), formatUnits(points, locale), '').title = t('galaxy.splitHint');
      }
    }
  }
  note.before(table);
  const parts = [t('galaxy.apiAge', { time: new Date(data.at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) })];
  if (data.ships) parts.unshift(t('galaxy.ships', { count: data.ships.toLocaleString(locale) }));
  note.textContent = parts.join(' · ');
  place();
}
