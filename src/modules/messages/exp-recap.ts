/**
 * Today's expeditions, live, on top of the inbox's Expeditions tab (as OGLight's mini recap):
 * redrawn every time the reports just read enter the journal. Same columns as the report
 * summaries below it, so its total sits above their values. Reads local data only.
 */
import type { Store } from '../../core/storage';
import { formatUnits } from '../../core/format';
import { icon } from '../../core/icons';
import { SHIPS_INFO_KEY, type ShipsInfo } from '../../data/fleet-dispatcher';
import { JOURNAL_KEY, entriesIn, msu, periodRange, periodStats, type Journal, type JournalEntry } from '../../engines/expeditions';
import { shipIcon, shipName, summaryLine, type T } from './index';

export const RECAP_ID = 'fut-exprecap';
export const FRESH_ID = 'fut-expfresh';
/** How long the "just read" panel stays (paused while the pointer or focus is on it). */
export const FRESH_MS = 10_000;

export interface RecapOptions {
  doc: Document;
  store: Store;
  locale: string;
  t: T;
  now?: () => number;
  /** Opens the expedition journal (the recap is a button). */
  onOpen?: () => void;
}

const isExpeditionTab = (doc: Document) => !!doc.querySelector('[data-subtab-id="22"].active, [data-subtab-id="22"][aria-selected="true"]');

/** Idempotent: called after every change the game makes to the inbox. */
export function mountExpeditionRecap(o: RecapOptions): void {
  const { doc, t, locale } = o;
  const holder = doc.querySelector('#messages .messagesHolder');
  const sortRow = doc.querySelector('#messages #filteredHeadersRow');
  const anchor = sortRow && sortRow.parentElement === holder?.parentElement ? sortRow : holder;
  const old = doc.getElementById(RECAP_ID);
  if (!holder || !anchor || !isExpeditionTab(doc)) {
    old?.remove();
    doc.getElementById(FRESH_ID)?.remove();
    return;
  }

  const now = o.now?.() ?? Date.now();
  const s = periodStats(entriesIn(o.store.get<Journal>(JOURNAL_KEY, {}), periodRange('today', now)));
  const ships = msu(s.shipsValue) - msu(s.lostValue);
  const sig = JSON.stringify([s.count, s.discoveries, s.res, ships, s.artefacts, s.lfXp, s.netMsu]);
  // In place: either right above the reports, or above the "just read" panel that sits under it.
  const placed = old && (old.nextElementSibling === anchor || old.nextElementSibling?.id === FRESH_ID);
  if (old && placed && old.dataset.sig === sig) return;

  const line = summaryLine(doc, 'fut-recap', { locale, t, ships: o.store.get<ShipsInfo>(SHIPS_INFO_KEY, {}) });
  // The whole line opens the journal: a button role on the line itself (a <button> cannot hold its grid).
  const box = line.box;
  box.setAttribute('role', 'button');
  box.tabIndex = 0;
  box.id = RECAP_ID;
  box.dataset.sig = sig;
  box.title = t('recap.open');

  line.pill(t('recap.title'), 'resource');
  line.note(t('recap.count', { n: s.count.toLocaleString(locale) }), 'muted');
  line.res(s.res);
  if (ships) line.note(`${t('recap.ships')} ${formatUnits(ships, locale)}`, ships < 0 ? 'neg' : '', t('recap.shipsHint', { n: Math.round(ships).toLocaleString(locale) }));
  if (s.artefacts) line.note(t('msg.artefacts', { n: s.artefacts.toLocaleString(locale) }), 'art');
  if (s.lfXp) line.note(t('msg.lfXp', { n: s.lfXp.toLocaleString(locale) }), 'lf');
  line.value(s.netMsu);
  if (o.onOpen) {
    const open = o.onOpen;
    box.addEventListener('click', open);
    box.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      open();
    });
  }

  if (old && placed) old.replaceWith(box);
  else {
    old?.remove();
    anchor.before(box);
  }
}

/** Entries already in the visible panel, so a second batch read meanwhile adds up. */
const shown = new WeakMap<Element, JournalEntry[]>();

/**
 * "Just read": what the reports read a moment ago brought, under today's recap, gone after
 * FRESH_MS (as OGLight's popup). A countdown bar shows the time left; hovering or focusing the
 * panel pauses it, and the close button removes it at once.
 */
export function showFreshExpeditions(o: RecapOptions, entries: JournalEntry[]): void {
  const { doc, t, locale } = o;
  const recap = doc.getElementById(RECAP_ID);
  if (!recap) return;
  const old = doc.getElementById(FRESH_ID);
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
    tile.append(el('span', 'fut-fresh-name', t(`msg.res.${key}`)), el('b', '', v ? fmt(v) : '0'));
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
  else recap.after(panel);
}
