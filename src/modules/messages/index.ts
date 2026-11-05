/**
 * Inbox summaries: one clear line on top of each report (expedition, discovery, spy report,
 * transport, recycling, combat), the game's text folded under it like OGLight does.
 * Expedition reports also go into the expedition journal. Reads the page only: no network,
 * no game action (the game's own buttons, probe included, stay as they are).
 */
import type { Store } from '../../core/storage';
import { formatUnits } from '../../core/format';
import { readMessage, type ExpeditionMessage, type ParsedMessage, type Res } from '../../data/messages';
import { SHIPS_INFO_KEY, type ShipsInfo } from '../../data/fleet-dispatcher';
import { SHIP_ICONS } from '../../data/ship-icons';
import { JOURNAL_KEY, record, recordCombat, trim, unitsValue, msu, type Journal } from '../../engines/expeditions';
import { MESSAGES_CSS } from './style';

export type T = (key: string, vars?: Record<string, string | number>) => string;

export const FOLD_KEY = 'msg.fold';

export interface MessagesOptions {
  doc: Document;
  store: Store;
  playerId: number;
  locale: string;
  t: T;
  now?: () => number;
  /** Called when new expeditions entered the journal. */
  onJournal?: (added: number) => void;
}

function h<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, cls = '', text?: string): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** The ship's picture (the game's own image), or its name when there is none. */
export function shipIcon(doc: Document, id: number, name: string, cls: string): HTMLElement {
  const url = SHIP_ICONS[id];
  if (!url) return h(doc, 'span', `${cls} ${cls}-none`, name.slice(0, 3));
  const img = h(doc, 'img', cls);
  img.src = url;
  img.alt = name;
  img.title = name;
  img.loading = 'lazy';
  return img;
}

export function shipName(id: number, ships: ShipsInfo, t: T): string {
  const name = ships[String(id)]?.name;
  if (name) return name;
  const key = `ship.${id}`;
  const fallback = t(key);
  return fallback === key ? `#${id}` : fallback;
}

/** Summary line for one report, or null when there is nothing worth showing. */
export function summaryFor(doc: Document, m: ParsedMessage, o: { locale: string; t: T; ships: ShipsInfo }): HTMLElement | null {
  const { t, locale } = o;
  const fmt = (n: number) => formatUnits(n, locale);
  const box = h(doc, 'div', `fut-msg fut-msg-${m.kind}`);
  /** Where the next chips go: the box itself, or one of its rows. */
  let into: HTMLElement = box;
  const chip = (text: string, cls = '', title?: string) => {
    const c = h(doc, 'span', `fut-msg-chip ${cls}`.trim(), text);
    if (title) c.title = title;
    into.append(c);
    return c;
  };
  const resChips = (r: Partial<Res & { food: number; darkMatter: number }>, sign = 1) => {
    const keys = [
      ['metal', 'm'],
      ['crystal', 'c'],
      ['deuterium', 'd'],
      ['food', 'f'],
      ['darkMatter', 'dm'],
    ] as const;
    let any = false;
    for (const [key, cls] of keys) {
      const v = (r[key] ?? 0) * sign;
      if (!v) continue;
      any = true;
      chip(`${v > 0 && sign > 0 ? '+' : ''}${fmt(v)}`, `fut-msg-res fut-msg-${cls}${v < 0 ? ' fut-msg-neg' : ''}`, `${t(`msg.res.${key}`)}: ${Math.round(v).toLocaleString(locale)}`);
    }
    return any;
  };
  const unitChips = (units: Record<number, number>, lost: boolean) => {
    for (const [id, n] of Object.entries(units).sort((a, b) => Number(a[0]) - Number(b[0]))) {
      const name = shipName(Number(id), o.ships, t);
      const c = chip(`${lost ? '−' : '+'}${n.toLocaleString(locale)}`, lost ? 'fut-msg-ship fut-msg-neg' : 'fut-msg-ship', name);
      c.prepend(shipIcon(doc, Number(id), name, 'fut-msg-icon'));
    }
  };

  switch (m.kind) {
    case 'expedition':
    case 'discovery': {
      // Three rows: outcome and value, then what was found (centred), then depletion.
      // The size is the colour of the frame: normal, big, huge.
      box.classList.add('fut-msg-rows');
      if (m.size >= 0) {
        box.classList.add(`fut-size-${m.size}`);
        box.dataset.size = t(`msg.size.${m.size}`);
      }
      const row = (cls: string) => {
        const r = h(doc, 'div', `fut-msg-row ${cls}`);
        box.append(r);
        into = r;
        return r;
      };
      row('fut-msg-top');
      chip(m.kind === 'discovery' ? `${t('msg.discovery')} · ${t(`msg.out.${m.result}`)}` : t(`msg.out.${m.result}`), `fut-msg-out fut-out-${m.result}`);
      const value = msu(m.res) + msu(unitsValue(m.ships)) - msu(unitsValue(m.lost));
      if (value) chip(`${fmt(value)} MSU`, `fut-msg-msu fut-msg-big${value < 0 ? ' fut-msg-neg' : ''}`, t('msg.msuHint'));
      const found = row('fut-msg-found');
      resChips(m.res);
      unitChips(m.ships, false);
      unitChips(m.lost, true);
      if (m.item) chip(m.item, 'fut-msg-item');
      if (m.lfXp) chip(t('msg.lfXp', { n: m.lfXp.toLocaleString(locale) }), 'fut-msg-lf');
      if (m.artefacts) chip(t('msg.artefacts', { n: m.artefacts.toLocaleString(locale) }), 'fut-msg-art');
      if (!found.childElementCount) found.remove();
      if (m.depletion > 0) {
        row('fut-msg-foot');
        chip(t('msg.depletion', { n: m.depletion }), 'fut-msg-muted');
      }
      return box;
    }
    case 'spy': {
      if (m.counter) {
        chip(t('msg.spy.counter', { name: m.sourceName || '?', coords: m.sourceCoords || '?' }), 'fut-msg-out fut-out-alien');
        return box;
      }
      const act = m.activity === 0 ? t('msg.spy.active') : m.activity >= 60 ? t('msg.spy.inactive') : t('msg.spy.activity', { n: m.activity });
      chip(act, m.activity === 0 ? 'fut-msg-out fut-out-pirate' : m.activity < 60 ? 'fut-msg-out fut-out-late' : 'fut-msg-out fut-out-nothing');
      const total = m.res.metal + m.res.crystal + m.res.deuterium;
      const loot = Math.floor(total * m.loot);
      chip(`${t('msg.spy.loot')} ${fmt(loot)}`, 'fut-msg-loot', `${Math.round(m.loot * 100)}% · ${Math.round(loot).toLocaleString(locale)}`);
      const lootMsu = msu(m.res) * m.loot;
      chip(`${fmt(lootMsu)} MSU`, 'fut-msg-msu', t('msg.msuHint'));
      const capacity = o.ships['203']?.capacity || 25000;
      if (loot > 0) chip(t('msg.spy.cargo', { n: Math.ceil(loot / capacity).toLocaleString(locale), ship: shipName(203, o.ships, t) }), 'fut-msg-ship');
      chip(`${t('msg.spy.fleet')} ${m.fleetValue < 0 ? '?' : fmt(m.fleetValue)}`, m.fleetValue > 0 ? 'fut-msg-warn' : 'fut-msg-muted');
      chip(`${t('msg.spy.def')} ${m.defValue < 0 ? '?' : fmt(m.defValue)}`, m.defValue > 0 ? 'fut-msg-warn' : 'fut-msg-muted');
      if (m.attacked) chip(t('msg.spy.attacked'), 'fut-msg-muted');
      return box;
    }
    case 'transport':
    case 'deploy':
    case 'return':
    case 'recycle': {
      chip(t(`msg.${m.kind}`), `fut-msg-out ${m.kind === 'recycle' ? 'fut-out-resource' : m.kind === 'transport' ? 'fut-out-trader' : 'fut-out-early'}`);
      const label = (p: { name: string; coords: string; moon: boolean }) => `${p.moon ? '☾ ' : ''}${p.name ? `${p.name} ` : ''}[${p.coords}]`;
      if (m.from && m.to) chip(`${label(m.from)} → ${label(m.to)}`, 'fut-msg-route');
      const any = resChips(m.res);
      if (any) chip(`${fmt(msu(m.res))} MSU`, 'fut-msg-msu', t('msg.msuHint'));
      else chip(t('msg.empty'), 'fut-msg-muted');
      const left = m.left ? m.left.metal + m.left.crystal + m.left.deuterium : 0;
      if (left > 0) chip(t('msg.debrisLeft', { n: fmt(left) }), 'fut-msg-warn', `${Math.round(m.left!.metal).toLocaleString(locale)} / ${Math.round(m.left!.crystal).toLocaleString(locale)} / ${Math.round(m.left!.deuterium).toLocaleString(locale)}`);
      return box;
    }
    case 'combat': {
      if (m.coords) chip(`[${m.coords}]`, 'fut-msg-route');
      chip(t(`msg.combat.${m.winner}`), `fut-msg-out ${m.winner === 'won' ? 'fut-out-resource' : m.winner === 'lost' ? 'fut-out-blackhole' : 'fut-out-nothing'}`);
      const sum = m.loot.metal + m.loot.crystal + m.loot.deuterium;
      if (sum) {
        chip(t(sum > 0 ? 'msg.combat.loot' : 'msg.combat.raided'), 'fut-msg-muted');
        resChips(m.loot);
      }
      const lost = msu(unitsValue(m.lost));
      if (lost) chip(`${t('msg.combat.losses')} ${fmt(lost)} MSU`, 'fut-msg-neg', Object.entries(m.lost).map(([id, n]) => `${n.toLocaleString(locale)} ${shipName(Number(id), o.ships, t)}`).join(', '));
      const debris = m.debris.metal + m.debris.crystal + m.debris.deuterium;
      if (debris) chip(`${t('msg.combat.debris')} ${fmt(debris)}`, 'fut-msg-loot');
      return box;
    }
  }
}

/** Where the summary goes: above the game's action bar, like OGLight. */
function place(msg: Element, box: HTMLElement): void {
  const actions = msg.querySelector('.msg_actions, message-footer');
  if (actions?.parentElement) actions.before(box);
  else (msg.querySelector('.msgContent') ?? msg).after(box);
}

/** Reads and summarises every report on the page not done yet. Returns new journal entries. */
export function processMessages(o: MessagesOptions): number {
  const { doc, store, t, locale } = o;
  const ships = store.get<ShipsInfo>(SHIPS_INFO_KEY, {});
  const fold = store.get<boolean>(FOLD_KEY, true);
  const expeditions: ExpeditionMessage[] = [];
  let journal: Journal | null = null;
  let added = 0;
  for (const msg of Array.from(doc.querySelectorAll('.msg[data-msg-id]'))) {
    if (msg.hasAttribute('data-fut-done') || msg.closest('#fut-journal')) continue;
    msg.setAttribute('data-fut-done', '');
    const parsed = readMessage(msg, o.playerId);
    if (!parsed) continue;
    const box = summaryFor(doc, parsed, { locale, t, ships });
    if (box) {
      box.title = [box.dataset.size, t('msg.toggle')].filter(Boolean).join(' · ');
      box.addEventListener('click', (e) => {
        if ((e.target as Element).closest('a, button')) return;
        msg.classList.toggle('fut-msg-folded');
      });
      place(msg, box);
      // The game's text is long and the same every time: folded for expeditions and recycling.
      if (fold && (parsed.kind === 'expedition' || parsed.kind === 'discovery' || parsed.kind === 'recycle' || parsed.kind === 'transport' || parsed.kind === 'deploy' || parsed.kind === 'return')) msg.classList.add('fut-msg-folded');
    }
    if (parsed.kind === 'expedition' || parsed.kind === 'discovery') expeditions.push(parsed);
    // Pirates and aliens: the losses are in the combat report at position 16.
    if (parsed.kind === 'combat' && parsed.coords?.split(':')[2] === '16' && Object.keys(parsed.lost).length) {
      journal ??= store.get<Journal>(JOURNAL_KEY, {});
      const r = recordCombat(journal, parsed.id, parsed.at, parsed.lost, parsed.coords);
      journal = r.journal;
      added += r.added;
    }
  }
  if (expeditions.length) {
    journal ??= store.get<Journal>(JOURNAL_KEY, {});
    const r = record(journal, expeditions);
    journal = r.journal;
    added += r.added;
  }
  if (journal && added) {
    store.set(JOURNAL_KEY, trim(journal, o.now?.() ?? Date.now()));
    o.onJournal?.(added);
  }
  return added;
}

/** On the messages page: summaries for the reports shown now and for those loaded later. */
export function watchMessages(o: MessagesOptions): void {
  const { doc } = o;
  if (!doc.getElementById('fut-msg-style')) {
    const style = h(doc, 'style');
    style.id = 'fut-msg-style';
    style.textContent = MESSAGES_CSS;
    doc.head.append(style);
  }
  processMessages(o);
  // Tabs and pages are loaded by the game without a page change: watch for new reports.
  let queued = false;
  const observer = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    setTimeout(() => {
      queued = false;
      processMessages(o);
    }, 50);
  });
  observer.observe(doc.body, { childList: true, subtree: true });
}
