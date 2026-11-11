/**
 * "Just read", on the inbox's Expeditions tab: what the reports read a moment ago brought (as
 * OGLight's popup), above the reports, gone after a few seconds. Reads local data only.
 */
import { resIconSvg } from '../../core/res-icons';
import type { Store } from '../../core/storage';
import { formatUnits } from '../../core/format';
import { icon } from '../../core/icons';
import { SHIPS_INFO_KEY, type ShipsInfo } from '../../data/fleet-dispatcher';
import { periodStats, type JournalEntry } from '../../engines/expeditions';
import { shipIcon, shipName, type T } from './index';

export const FRESH_ID = 'fut-expfresh';
/** How long the "just read" panel stays (paused while the pointer or focus is on it). */
export const FRESH_MS = 10_000;

export interface FreshOptions {
  doc: Document;
  store: Store;
  locale: string;
  t: T;
}

const isExpeditionTab = (doc: Document) => !!doc.querySelector('[data-subtab-id="22"].active, [data-subtab-id="22"][aria-selected="true"]');

/** Where the panel goes: above the game's sort row, else above the reports; none off the Expeditions tab. */
function freshAnchor(doc: Document): Element | null {
  const holder = doc.querySelector('#messages .messagesHolder');
  const sortRow = doc.querySelector('#messages #filteredHeadersRow');
  if (!holder || !isExpeditionTab(doc)) return null;
  return sortRow && sortRow.parentElement === holder.parentElement ? sortRow : holder;
}

/** Entries already in the visible panel, so a second batch read meanwhile adds up. */
const shown = new WeakMap<Element, JournalEntry[]>();

/**
 * "Just read": what the reports read a moment ago brought, above the reports, gone after
 * FRESH_MS (as OGLight's popup). A countdown bar shows the time left; hovering or focusing the
 * panel pauses it, and the close button removes it at once.
 */
export function showFreshExpeditions(o: FreshOptions, entries: JournalEntry[]): void {
  const { doc, t, locale } = o;
  const old = doc.getElementById(FRESH_ID);
  const anchor = freshAnchor(doc);
  if (!anchor) {
    old?.remove();
    return;
  }
  const all = [...(old ? (shown.get(old) ?? []) : []), ...entries];
  const s = periodStats(all);
  const fmt = (n: number) => formatUnits(n, locale);
  const exact = (n: number) => Math.round(n).toLocaleString(locale);
  const ships = o.store.get<ShipsInfo>(SHIPS_INFO_KEY, {});
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text?: string) => {
    const n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };

  const panel = el('section', 'fut-fresh');
  panel.id = FRESH_ID;
  panel.setAttribute('aria-live', 'polite');
  panel.setAttribute('aria-label', t('fresh.title'));
  shown.set(panel, all);

  const timer = el('div', 'fut-fresh-timer');
  const bar = el('i');
  bar.style.animationDuration = `${FRESH_MS}ms`;
  bar.addEventListener('animationend', () => panel.remove());
  timer.append(bar);

  const head = el('div', 'fut-fresh-head');
  head.append(el('b', '', t('fresh.title')), el('span', 'fut-fresh-count', t('recap.count', { n: (s.count + s.discoveries).toLocaleString(locale) })));
  // How many normal / big / huge finds, in the rarity colours.
  for (const i of [0, 1, 2] as const) if (s.sizes[i]) head.append(el('span', `fut-rar-chip fut-rar-${i}`, `${s.sizes[i]} ${t(`msg.size.${i}`).toLowerCase()}`));
  const total = el('span', `fut-fresh-total${s.netMsu < 0 ? ' fut-neg' : ''}`);
  total.append(el('b', '', fmt(s.netMsu)), el('small', '', 'MSU'));
  total.title = `${exact(s.netMsu)} MSU`;
  const close = el('button', 'fut-fresh-close');
  close.type = 'button';
  close.title = t('fresh.close');
  close.setAttribute('aria-label', t('fresh.close'));
  close.append(icon(doc, 'close', 12));
  close.addEventListener('click', () => panel.remove());
  head.append(total, close);
  panel.append(timer, head);

  // Resources: the big numbers, one tile each (as OGLight).
  const res = el('div', 'fut-fresh-res');
  for (const [key, c] of [['metal', 'm'], ['crystal', 'c'], ['deuterium', 'd'], ['darkMatter', 'dm']] as const) {
    const v = s.res[key];
    const tile = el('div', `fut-fresh-tile fut-r-${c}${v ? '' : ' zero'}`);
    tile.title = `${t(`msg.res.${key}`)}: ${exact(v)}`;
    const name = el('span', 'fut-fresh-name', t(`msg.res.${key}`));
    name.insertAdjacentHTML('afterbegin', resIconSvg(key, 13));
    tile.append(name, el('b', '', v ? fmt(v) : '0'));
    res.append(tile);
  }
  panel.append(res);

  // Ships: small, many per row.
  const found = Object.entries(s.shipsFound);
  const lost = Object.entries(s.lost);
  if (found.length || lost.length) {
    const list = el('div', 'fut-fresh-ships');
    for (const [units, isLost] of [[found, false], [lost, true]] as const) {
      for (const [id, n] of [...units].sort((a, b) => Number(a[0]) - Number(b[0]))) {
        const name = shipName(Number(id), ships, t);
        const tile = el('span', `fut-fresh-ship${isLost ? ' fut-neg' : ''}`, `${isLost ? '−' : '+'}${n.toLocaleString(locale)}`);
        tile.prepend(shipIcon(doc, Number(id), name, 'fut-msg-icon'));
        tile.title = name;
        list.append(tile);
      }
    }
    panel.append(list);
  }

  if (old) old.replaceWith(panel);
  else anchor.before(panel);
}
