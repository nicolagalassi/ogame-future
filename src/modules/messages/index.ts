/**
 * Inbox summaries: one clear line on top of each report (expedition, discovery, spy report,
 * transport, recycling, combat), the game's text folded under it like OGLight does.
 * Expedition reports also go into the expedition journal. Reads the page only: no network,
 * no game action (the game's own buttons, probe included, stay as they are).
 */
import { icon } from '../../core/icons';
import { resIconSvg } from '../../core/res-icons';
import type { Store } from '../../core/storage';
import { formatUnits } from '../../core/format';
import { readMessage, type ExpeditionMessage, type ParsedMessage, type Res, type SpyMessage } from '../../data/messages';
import { SHIPS_INFO_KEY, type ShipsInfo } from '../../data/fleet-dispatcher';
import { SHIP_ICONS } from '../../data/ship-icons';
import { JOURNAL_KEY, record, recordCombat, trim, unitsValue, msu, type Journal, type JournalEntry } from '../../engines/expeditions';
import { rememberSpies, SPY_BOARD_KEY, type SpyBoard, type Universe } from '../../engines/raids';
import { MESSAGES_CSS } from './style';
import { mountSpyPanel, universeOf, type SpyContext } from './spy-table';
import { mountExpeditionRecap, showFreshExpeditions } from './exp-recap';
import { SERVER_DATA_KEY, type ServerData } from '../../data/server-data';
import { converterLink, SIM_KEY, simTool, type SimTool } from '../../engines/sim-links';

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
  /** Opens the expedition journal, from today's recap on the Expeditions tab. */
  onOpenJournal?: () => void;
  /** The spy table's data (bases, research, server); none = no table. */
  spy?: SpyContext;
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

/** What a summary line needs besides the report. */
export interface SummaryContext {
  locale: string;
  t: T;
  ships: ShipsInfo;
  spy?: SpyContext;
  universe?: Universe;
  /** The simulator picked in the settings. */
  sim?: SimTool;
}

/**
 * The summary line's grammar, shared by every report kind and by today's recap:
 * [pill: outcome] [body: what it holds] [value: MSU, right-aligned] [actions].
 * The value sits in the same place on every report, so the eye reads it down the list.
 */
export function summaryLine(doc: Document, cls: string, o: Pick<SummaryContext, 'locale' | 't' | 'ships'>) {
  const { t, locale } = o;
  const fmt = (n: number) => formatUnits(n, locale);
  const exact = (n: number) => Math.round(n).toLocaleString(locale);
  const box = h(doc, 'div', `fut-msg ${cls}`);
  const pillCell = h(doc, 'div', 'fut-msg-pillcell');
  const body = h(doc, 'div', 'fut-msg-body');
  const value = h(doc, 'div', 'fut-msg-val');
  const acts = h(doc, 'div', 'fut-msg-acts');
  box.append(pillCell, body, value, acts);

  return {
    box,
    body,
    /** The outcome pill; `size` 0 huge, 1 big, 2 normal (brighter = bigger find). */
    pill(text: string, tone: string, title?: string, size = -1) {
      const p = h(doc, 'span', `fut-pill fut-out-${tone}${size >= 0 ? ` fut-size-${size}` : ''}`, text);
      if (title) p.title = title;
      pillCell.append(p);
      return p;
    },
    /** Resources, each with its symbol (core/res-icons) in its colour; `sign` −1 for what was taken from you. */
    res(r: Partial<Res & { food: number; darkMatter: number }>, sign = 1, prefix = '') {
      const keys = [['metal', 'm'], ['crystal', 'c'], ['deuterium', 'd'], ['food', 'f'], ['darkMatter', 'dm']] as const;
      let any = false;
      for (const [key, c] of keys) {
        const v = (r[key] ?? 0) * sign;
        if (!v) continue;
        any = true;
        const s = h(doc, 'span', `fut-r fut-r-${c}${v < 0 ? ' fut-neg' : ''}`, `${v < 0 ? '−' : prefix}${fmt(Math.abs(v))}`);
        // The symbol tells the resource apart by its shape, not only by its colour.
        s.insertAdjacentHTML('afterbegin', resIconSvg(key, 15));
        s.title = `${t(`msg.res.${key}`)}: ${exact(v)}`;
        s.setAttribute('aria-label', s.title);
        body.append(s);
      }
      return any;
    },
    /** Ships with the game's picture: found (+), lost (−) or just counted. */
    ships(units: Record<number, number>, mode: 'found' | 'lost' | 'count') {
      for (const [id, n] of Object.entries(units).sort((a, b) => Number(a[0]) - Number(b[0]))) {
        if (!n) continue;
        const name = shipName(Number(id), o.ships, t);
        const s = h(doc, 'span', `fut-u${mode === 'lost' ? ' fut-neg' : ''}`, `${mode === 'found' ? '+' : mode === 'lost' ? '−' : ''}${n.toLocaleString(locale)}`);
        s.prepend(shipIcon(doc, Number(id), name, 'fut-msg-icon'));
        s.title = name;
        body.append(s);
      }
    },
    /** A short labelled fact ("Difesa 876M"); `tone` warn / neg / muted. */
    note(text: string, tone = '', title?: string) {
      const s = h(doc, 'span', `fut-note${tone ? ` fut-${tone}` : ''}`, text);
      if (title) s.title = title;
      body.append(s);
      return s;
    },
    /** An amount that is not MSU (dark matter), in the value column with its own unit. */
    amount(n: number, unit: string, cls: string, title: string) {
      value.replaceChildren(h(doc, 'b', cls, `+${fmt(n)}`), h(doc, 'small', '', unit));
      value.title = `${exact(n)} ${title}`;
    },
    /** The value in MSU, or a dash when the report carries nothing. */
    value(msuValue: number | null, title = t('msg.msuHint')) {
      value.replaceChildren();
      if (!msuValue) {
        value.append(h(doc, 'span', 'fut-dash', '—'));
        return;
      }
      value.append(h(doc, 'b', msuValue < 0 ? 'fut-neg' : '', `${msuValue < 0 ? '−' : ''}${fmt(Math.abs(msuValue))}`), h(doc, 'small', '', 'MSU'));
      value.title = `${exact(msuValue)} MSU · ${title}`;
    },
    /** A small text button that opens an outside tool in a new tab (the player's click). */
    link(text: string, href: string, title: string) {
      const a = h(doc, 'a', 'fut-msg-link', text);
      a.href = href;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.title = title;
      acts.append(a);
    },
    /** Depletion of the expedition spot, as three ticks. */
    depletion(n: number) {
      const meter = h(doc, 'span', 'fut-depl');
      meter.title = t('msg.depletion', { n });
      meter.setAttribute('role', 'img');
      meter.setAttribute('aria-label', meter.title);
      for (let i = 1; i <= 3; i++) meter.append(h(doc, 'i', i <= n ? 'on' : ''));
      body.append(meter);
    },
  };
}

/** Expedition outcomes the found things already make plain: no pill for these. */
const SELF_EVIDENT = new Set(['resource', 'darkmatter', 'ship', 'artefact', 'lifeform']);

/** Summary line for one report, or null when there is nothing worth showing. */
export function summaryFor(doc: Document, m: ParsedMessage, o: SummaryContext): HTMLElement | null {
  const { t, locale } = o;
  const fmt = (n: number) => formatUnits(n, locale);
  const line = summaryLine(doc, `fut-msg-${m.kind}`, o);

  switch (m.kind) {
    case 'expedition':
    case 'discovery': {
      const sizeName = m.size >= 0 ? t(`msg.size.${m.size}`) : '';
      // Short pill label where the full one would not fit; the full one is in the tooltip.
      const full = t(`msg.out.${m.result}`);
      const short = t(`msg.pill.${m.result}`);
      const name = short === `msg.pill.${m.result}` ? full : short;
      const label = m.kind === 'discovery' ? `${t('msg.discovery')} · ${name}` : name;
      // The pill only where the line does not already say it: resources, ships, dark matter, artefacts
      // and lifeform XP show themselves; delay, early return, nothing, item, trader, pirates… need the word.
      if (m.kind === 'discovery' || !SELF_EVIDENT.has(m.result)) line.pill(label, m.result, [m.kind === 'discovery' ? t('msg.discovery') : '', full, sizeName].filter(Boolean).join(' · '));
      // Size as game rarity: normal = common (no tint), big = rare (blue), huge = epic (purple).
      if (sizeName) line.box.dataset.size = sizeName;
      if (m.size === 0 || m.size === 1) line.box.classList.add(`fut-rar-${m.size}`);
      line.res(m.res, 1, '+');
      line.ships(m.ships, 'found');
      line.ships(m.lost, 'lost');
      if (m.item) line.note(m.item, 'item');
      if (m.lfXp) line.note(t('msg.lfXp', { n: m.lfXp.toLocaleString(locale) }), 'lf');
      if (m.artefacts) line.note(t('msg.artefacts', { n: m.artefacts.toLocaleString(locale) }), 'art');
      if (m.depletion > 0) line.depletion(m.depletion);
      const worth = msu(m.res) + msu(unitsValue(m.ships)) - msu(unitsValue(m.lost));
      // Dark matter has no MSU value: its amount takes the value column instead of a dash.
      if (!worth && m.res.darkMatter) line.amount(m.res.darkMatter, t('msg.dmUnit'), 'fut-dm', t('msg.res.darkMatter'));
      else line.value(worth);
      return line.box;
    }
    case 'spy': {
      if (m.counter) {
        line.pill(t('msg.spy.counterPill'), 'alien');
        const who = h(doc, 'span', 'fut-note', `${m.sourceName || '?'} `);
        if (m.sourceCoords) {
          const [g, s] = m.sourceCoords.split(':');
          const a = h(doc, 'a', 'fut-coords', `[${m.sourceCoords}]`);
          a.href = `/game/index.php?page=ingame&component=galaxy&galaxy=${g}&system=${s}`;
          who.append(a);
        }
        line.body.append(who);
        return line.box;
      }
      // Spy reports: the spy table above the list already shows all of this, so no summary here.
      return null;
    }
    case 'transport':
    case 'deploy':
    case 'return':
    case 'recycle': {
      line.pill(t(`msg.${m.kind}`), m.kind === 'recycle' ? 'resource' : m.kind === 'transport' ? 'trader' : 'early');
      if (m.from && m.to) {
        const place = (p: { name: string; coords: string; moon: boolean }) => {
          const s = h(doc, 'span', 'fut-place', p.name ? `${p.name} ` : '');
          if (p.moon) s.prepend(icon(doc, 'moon', 10, 'fut-msg-moon'));
          s.append(h(doc, 'span', 'fut-coords', `[${p.coords}]`));
          return s;
        };
        const route = h(doc, 'span', 'fut-route');
        const arrow = icon(doc, 'next', 12, 'fut-arrow');
        arrow.setAttribute('aria-label', '→');
        route.append(place(m.from), arrow, place(m.to));
        line.body.append(route);
      }
      const any = line.res(m.res);
      if (!any) line.note(t('msg.empty'), 'muted');
      const left = m.left ? m.left.metal + m.left.crystal + m.left.deuterium : 0;
      if (left > 0) line.note(t('msg.debrisLeft', { n: fmt(left) }), 'warn', `${Math.round(m.left!.metal).toLocaleString(locale)} / ${Math.round(m.left!.crystal).toLocaleString(locale)} / ${Math.round(m.left!.deuterium).toLocaleString(locale)}`);
      line.value(any ? msu(m.res) : null);
      return line.box;
    }
    case 'combat': {
      line.pill(t(`msg.combat.${m.winner}`), m.winner === 'won' ? 'resource' : m.winner === 'lost' ? 'late' : 'nothing');
      const sum = m.loot.metal + m.loot.crystal + m.loot.deuterium;
      if (sum) line.res(m.loot, 1, sum > 0 ? '+' : '');
      const lost = msu(unitsValue(m.lost));
      if (lost) line.note(`${t('msg.combat.losses')} ${fmt(lost)}`, 'neg', Object.entries(m.lost).map(([id, n]) => `${n.toLocaleString(locale)} ${shipName(Number(id), o.ships, t)}`).join(', '));
      const debris = m.debris.metal + m.debris.crystal + m.debris.deuterium;
      if (debris) line.note(`${t('msg.combat.debris')} ${fmt(debris)}`, 'muted');
      line.value(msu(m.loot) - lost, t('msg.combat.netHint'));
      if (m.apiKey) line.link(t('msg.combat.converter'), converterLink(m.apiKey, o.spy?.lang || locale), t('msg.combat.converterHint'));
      return line.box;
    }
  }
}

/**
 * Where the summary goes. Card view: INSIDE the game's header, on the sender's line, right-aligned
 * (outcome, what was carried, the value): with the report folded the card is just its header.
 * List view (13.x): under the header row, whose body the game keeps hidden until opened.
 * Returns true when the summary sits in the card's header.
 */
function place(msg: Element, box: HTMLElement): boolean {
  const header = msg.querySelector(':scope > .msgFilteredHeaderRow');
  if (header) {
    header.after(box);
    return false;
  }
  const head = msg.querySelector<HTMLElement>(':scope .msgHead');
  if (head && !head.closest('.messageContentWrapper')) {
    head.classList.add('fut-msghead');
    box.classList.add('fut-msg-inhead');
    head.append(box);
    return true;
  }
  const actions = msg.querySelector('.msg_actions, message-footer');
  if (actions?.parentElement) actions.before(box);
  else (msg.querySelector('.msgContent') ?? msg).after(box);
  return false;
}

/** Reads and summarises every report on the page not done yet. Returns new journal entries. */
export function processMessages(o: MessagesOptions): number {
  const { doc, store, t, locale } = o;
  const ships = store.get<ShipsInfo>(SHIPS_INFO_KEY, {});
  const universe = universeOf(doc, store.get<ServerData | null>(SERVER_DATA_KEY, null));
  const fold = store.get<boolean>(FOLD_KEY, true);
  const sim = simTool(store.get<string>(SIM_KEY, 'osims'));
  // Communication › shared espionage reports: an alliance member's probes.
  const sharedTab = !!doc.querySelector('[data-subtab-id="11"].active, [data-subtab-id="11"][aria-selected="true"]');
  const expeditions: ExpeditionMessage[] = [];
  const spies: SpyMessage[] = [];
  let journal: Journal | null = null;
  let added = 0;
  /** What entered the journal in this pass, for the "just read" panel. */
  const fresh: JournalEntry[] = [];
  for (const msg of Array.from(doc.querySelectorAll('.msg[data-msg-id]'))) {
    if (msg.hasAttribute('data-fut-done') || msg.closest('#fut-journal')) continue;
    msg.setAttribute('data-fut-done', '');
    const parsed = readMessage(msg, o.playerId);
    if (!parsed) continue;
    const box = summaryFor(doc, parsed, { locale, t, ships, spy: o.spy, universe, sim });
    if (box) {
      box.title = [box.dataset.size, t('msg.toggle')].filter(Boolean).join(' · ');
      // A real control: reachable with Tab, Enter / Space open and close the game's text.
      box.tabIndex = 0;
      box.setAttribute('role', 'button');
      const cell = () => msg.querySelector<HTMLElement>(':scope > .msgFilteredHeaderRow .msgFilteredHeaderCell');
      const sync = () => {
        if (!cell()) box.setAttribute('aria-expanded', String(!msg.classList.contains('fut-msg-folded')));
      };
      const toggle = () => {
        // List view: open/close the report the way the game's own header row does.
        const c = cell();
        if (c) return void c.click();
        msg.classList.toggle('fut-msg-folded');
        sync();
      };
      box.addEventListener('click', (e) => {
        if ((e.target as Element).closest('a, button')) return;
        toggle();
      });
      box.addEventListener('keydown', (e) => {
        if (e.target !== box || (e.key !== 'Enter' && e.key !== ' ')) return;
        e.preventDefault();
        toggle();
      });
      if (place(msg, box)) {
        // The whole header opens and closes the report, not only our part of it (the game's own links and buttons keep theirs).
        box.parentElement?.addEventListener('click', (e) => {
          if (box.contains(e.target as Node) || (e.target as Element).closest('a, button, input, [role="button"]')) return;
          toggle();
        });
      }
      // Big and huge finds tint the whole message, not only our line.
      const rar = box.className.match(/fut-rar-([01])/);
      if (rar) msg.classList.add('fut-msgrar', `fut-msgrar-${rar[1]}`);
      // The game's text is long and the same every time: folded for expeditions and recycling.
      if (fold && (parsed.kind === 'expedition' || parsed.kind === 'discovery' || parsed.kind === 'recycle' || parsed.kind === 'transport' || parsed.kind === 'deploy' || parsed.kind === 'return')) msg.classList.add('fut-msg-folded');
      sync();
    }
    if (parsed.kind === 'expedition' || parsed.kind === 'discovery') expeditions.push(parsed);
    if (parsed.kind === 'spy') spies.push(parsed);
    // Pirates and aliens: the losses are in the combat report at position 16.
    if (parsed.kind === 'combat' && parsed.coords?.split(':')[2] === '16' && Object.keys(parsed.lost).length) {
      journal ??= store.get<Journal>(JOURNAL_KEY, {});
      const r = recordCombat(journal, parsed.id, parsed.at, parsed.lost, parsed.coords);
      journal = r.journal;
      added += r.added;
      if (r.added) fresh.push(journal[parsed.id]!);
    }
  }
  if (expeditions.length) {
    journal ??= store.get<Journal>(JOURNAL_KEY, {});
    const before = journal;
    const r = record(journal, expeditions);
    journal = r.journal;
    added += r.added;
    for (const e of expeditions) if (!before[e.id]) fresh.push(journal[e.id]!);
  }
  // Spy board: newest report per target, kept locally for the spy table (no network).
  if (spies.length) {
    const board = store.get<SpyBoard>(SPY_BOARD_KEY, {});
    if (rememberSpies(board, spies, o.now?.() ?? Date.now(), sharedTab)) store.set(SPY_BOARD_KEY, board);
  }
  if (o.spy) mountSpyPanel({ doc, store, t, locale, spy: o.spy, now: o.now });
  if (journal && added) {
    store.set(JOURNAL_KEY, trim(journal, o.now?.() ?? Date.now()));
    o.onJournal?.(added);
  }
  const recap = { doc, store, t, locale, now: o.now, onOpen: o.onOpenJournal };
  mountExpeditionRecap(recap);
  if (fresh.length) showFreshExpeditions(recap, fresh);
  return added;
}

/**
 * On the messages page: summaries for the reports shown now and for those loaded later.
 * Returns a redraw for after a change in the settings (simulator, folding, shared reports):
 * the journal does not count a report twice, so redrawing is safe.
 */
export function watchMessages(o: MessagesOptions): () => void {
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
  return () => {
    doc.querySelectorAll('.msg .fut-msg').forEach((n) => n.remove());
    doc.querySelectorAll('.msg[data-fut-done]').forEach((m) => {
      m.removeAttribute('data-fut-done');
      m.classList.remove('fut-msg-folded', 'fut-msgrar', 'fut-msgrar-0', 'fut-msgrar-1');
    });
    processMessages(o);
  };
}
