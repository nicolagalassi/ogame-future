/**
 * Project Orion pages: what each scanned anomaly and each active mission pays per hour of lithium
 * production, best first; a launch plan per anomaly that keeps the lithium for the anomalies already
 * under way; how many scans the bar can pay without starving them; and the archive of every anomaly
 * taken on (shown in the journal's Orion tab). Ported from Nicola's Orion Calculator 1.3.7, drawn
 * like Future's inbox summaries (tiles with the resource symbols, the value on the right).
 *
 * COMPLIANCE (AGENTS.md):
 * - §1.1/§1.2 display only: it neither scans, discovers nor redeems. The Discover and collect clicks
 *   are only READ by capture listeners, never stopped, delayed, changed or repeated.
 * - §1.3/§4 no request to the server: everything is read from the tabs the player opened; a DOM-only
 *   observer follows the game redrawing them.
 * - §4.2 no cp=, no planet switching. §1.4 no alarm or notification. §1.9 data stays in this browser.
 */
import type { Store } from '../../core/storage';
import { formatUnits } from '../../core/format';
import { resIconSvg } from '../../core/res-icons';
import { RES_COLORS } from '../../core/sheet';
import { pageWindow } from '../../data/fleet-dispatcher';
import { COLLECT_DIALOG, depletionHours, isDisabled, lithiumNow, lithiumPerHour, MISSION_CARD, readCollectDialog, readMissionCard, readScanCard, SCAN_CARD, scanCost, storageCap, type MissionCard } from '../../data/orion';
import {
  ARCHIVE_KEY, cardValue, counted, freeLithium, IGNORED_KEY, launchPlan, LEDGER_KEY, loadArchive, PENDING_KEY, profit, pruneLedger, scansPossible, settle, syncArchive, syncLedger,
  type Archive, type CardState, type Ignored, type Ledger, type LedgerRecord, type Lithium, type PendingMap, type Rewards,
} from '../../engines/orion';
import { msu } from '../../engines/expeditions';

type T = (key: string, vars?: Record<string, string | number>) => string;

export interface OrionOptions {
  doc: Document;
  store: Store;
  t: T;
  locale: string;
}

const STYLE_ID = 'fut-orion-style';
/* The tokens and shapes of the inbox summaries (messages/style.ts): tiles on a faint panel, the value
   on the right after a rule, mono-width numbers, cyan for what is chosen. */
const CSS = `
.fut-or, .fut-or-box {
  --hi: #F1F4F7; --txt: #C9D2DC; --mute: #A3AFBD; --dim: #8592A1; --line: rgba(120, 150, 180, 0.14);
  --accent: #4FD1E8; --neg: #F07A6E; --warn: #E3B341; --ok: #7BC47F; --gold: #F5C542; --tile: rgba(120, 150, 180, 0.09);
  box-sizing: border-box; font: 11px/16px Verdana, Arial, Helvetica, sans-serif; color: var(--txt); font-variant-numeric: tabular-nums; text-align: left;
}
.fut-or { display: grid; grid-template-columns: minmax(0, 1fr) auto; column-gap: 10px; row-gap: 6px; margin: 8px 0 4px; padding: 8px 12px; border-radius: 4px; background: rgba(13, 21, 34, 0.72); }
.fut-or-tiles { display: flex; flex-wrap: wrap; align-items: stretch; gap: 6px; min-width: 0; }
.fut-or-t { display: inline-flex; flex-direction: column; justify-content: center; gap: 3px; min-width: 64px; padding: 6px 9px 5px; border-radius: 4px; background: var(--tile); font-size: 12px; line-height: 15px; font-weight: 700; color: var(--dot, var(--hi)); white-space: nowrap; }
.fut-or-t > span { display: inline-flex; align-items: center; gap: 5px; }
.fut-or-t small { font-size: 10px; font-weight: 400; color: var(--mute); }
.fut-or-t.neg { color: var(--neg); }
.fut-or-t.note { flex-direction: row; align-items: center; font-weight: 400; color: var(--mute); white-space: normal; }
.fut-or-m { --dot: ${RES_COLORS.metal}; } .fut-or-c { --dot: ${RES_COLORS.crystal}; } .fut-or-d { --dot: ${RES_COLORS.deuterium}; } .fut-or-li { --dot: #7FC8F0; }
.fut-or-t svg { flex: none; }
.fut-or-val { display: flex; flex-direction: column; align-items: flex-end; justify-content: center; min-width: 96px; padding-left: 10px; border-left: 1px solid var(--line); white-space: nowrap; }
.fut-or-val b { font-size: 15px; line-height: 18px; color: var(--accent); }
.fut-or-val small { font-size: 10px; color: var(--mute); }
.fut-or-val.free b { color: var(--ok); }
.fut-or-best { outline: 1px solid var(--gold, #F5C542); outline-offset: -1px; border-radius: 4px; }
.fut-or-best .fut-or-val b { color: #F5C542; }
.fut-or-line { grid-column: 1 / -1; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; padding-top: 6px; border-top: 1px solid var(--line); }
.fut-or-line b { color: var(--hi); font-weight: 700; }
.fut-or-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--ok); flex: none; }
.fut-or-line.short .fut-or-dot { background: var(--warn); }
.fut-or-line.short { color: var(--warn); }
.fut-or-line .fut-or-dim { color: var(--mute); }
.fut-or-sw { display: inline-flex; align-items: center; gap: 8px; padding: 0; border: 0; background: none; color: var(--txt); font: inherit; cursor: pointer; }
.fut-or-sw i { position: relative; width: 26px; height: 14px; border-radius: 7px; background: #3A4756; flex: none; transition: background-color 120ms ease-out; }
.fut-or-sw i::after { content: ""; position: absolute; top: 2px; left: 2px; width: 10px; height: 10px; border-radius: 50%; background: #C9D2DC; transition: transform 120ms ease-out; }
.fut-or-sw[aria-checked="true"] i { background: var(--accent); }
.fut-or-sw[aria-checked="true"] i::after { transform: translateX(12px); background: #0D1116; }
.fut-or-sw:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 3px; }
.fut-or-sw:hover span { color: var(--hi); }
.fut-or-box { margin: 6px 0 10px; padding: 10px 14px; border-radius: 4px; background: #0E151C; }
.fut-or-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; margin-bottom: 8px; }
.fut-or-head > b { font-size: 12px; color: var(--hi); }
.fut-or-head > span { color: var(--mute); }
.fut-or-head > span.warn { color: var(--warn); }
.fut-or-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 6px; }
.fut-or-kpi { display: flex; flex-direction: column; gap: 2px; min-width: 0; padding: 7px 9px; border-radius: 4px; background: rgba(120, 150, 180, 0.07); }
.fut-or-kpi span { color: var(--mute); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fut-or-kpi b { font-size: 16px; line-height: 1.2; color: var(--hi); white-space: nowrap; }
.fut-or-kpi b.ok { color: var(--ok); } .fut-or-kpi b.neg { color: var(--neg); } .fut-or-kpi b.warn { color: var(--warn); }
.fut-or-kpi em { font-style: normal; color: var(--dim); font-size: 10px; }
.fut-or-rows { display: flex; flex-direction: column; gap: 2px; margin-top: 8px; }
.fut-or-row { display: grid; grid-template-columns: minmax(0, 1fr) auto auto auto; align-items: center; column-gap: 12px; padding: 4px 8px; border-radius: 3px; background: rgba(120, 150, 180, 0.05); }
.fut-or-row.off { opacity: 0.55; }
.fut-or-row .n { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--hi); }
.fut-or-row .n small { margin-left: 6px; color: var(--mute); }
.fut-or-row .v { text-align: right; color: var(--hi); font-weight: 700; }
.fut-or-row .v.partial { color: var(--warn); }
.fut-or-row .e { color: var(--mute); text-align: right; white-space: nowrap; }
.fut-or-empty { margin-top: 6px; color: var(--mute); }
.fut-or-warn { margin: 6px 0; padding: 8px 12px; border-radius: 4px; background: color-mix(in srgb, var(--neg, #F07A6E) 16%, #141C26); box-shadow: inset 0 0 0 1px #F07A6E; color: #FFD7D2; font: 12px/16px Verdana, Arial, sans-serif; }
.fut-or-warn b { color: #fff; }
@media (max-width: 640px) { .fut-or { grid-template-columns: 1fr; } .fut-or-val { align-items: flex-start; padding: 6px 0 0; border-left: 0; border-top: 1px solid var(--line); } .fut-or-row { grid-template-columns: minmax(0, 1fr) auto; } }
`;

function h<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, cls = '', text?: string): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** "3h 05m"; over a day "1g 3h". */
export const hoursText = (hours: number): string => {
  const minutes = Math.round(hours * 60);
  if (minutes >= 24 * 60) return `${Math.floor(minutes / 1440)}d ${Math.floor((minutes % 1440) / 60)}h`;
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
};

/** A card counts while it is in the page AND shown: after Discover the game may remove it or just hide it. */
const isShown = (el: Element) => el.isConnected && el.getClientRects().length > 0;

export function watchOrion(o: OrionOptions): void {
  const { doc, store, t, locale } = o;
  const win = pageWindow() as Window & { lithiumProduction?: unknown };
  const fmt = (n: number) => formatUnits(n, locale);
  /** Text with <b> around each {var} (but `held`, a phrase of its own): the figures stand out. */
  const rich = (key: string, vars: Record<string, string | number>) => {
    const span = h(doc, 'span');
    const text = t(key, Object.fromEntries(Object.keys(vars).map((k) => [k, `\u0000${k}\u0000`])));
    text.split('\u0000').forEach((part, i) => {
      if (i % 2) span.append(part === 'held' ? String(vars[part] ?? '') : h(doc, 'b', '', String(vars[part] ?? '')));
      else if (part) span.append(part);
    });
    return span;
  };
  /** The game's own lithium symbol (its custom element, styled by the game's CSS). */
  const lithiumIcon = () => {
    const i = doc.createElement('lithium-icon');
    i.setAttribute('sq16', '');
    i.setAttribute('icon-blue', '');
    return i;
  };
  const svg = (html: string) => {
    const s = h(doc, 'span');
    s.innerHTML = html;
    return s.firstElementChild ?? s;
  };
  if (!doc.getElementById(STYLE_ID)) {
    const style = h(doc, 'style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    doc.head.append(style);
  }

  const loadLedger = () => store.get<Ledger>(LEDGER_KEY, {});
  const loadIgnored = () => store.get<Ignored>(IGNORED_KEY, {});
  const loadArch = () => loadArchive(store.get<Archive | null>(ARCHIVE_KEY, null));
  const live = (): LedgerRecord[] => {
    const p = pruneLedger(loadLedger(), Date.now());
    if (p.changed) store.set(LEDGER_KEY, p.ledger);
    return counted(p.ledger, loadIgnored());
  };
  const lithium = (): Lithium | null => {
    const now = lithiumNow(doc);
    return now === null ? null : { now, perHour: lithiumPerHour(doc, win), stopsIn: depletionHours(doc), cap: storageCap(doc) };
  };
  const CSS_ESCAPE = (s: string) => s.replace(/["\\]/g, '');

  // ---------- the missions tab: ledger and archive ----------
  let lastPrint = '';
  const syncMissions = () => {
    const tab = doc.querySelector('#orionMission, .orionTabContentWrapper.anomalyMissions');
    if (!tab) return;
    // An empty list must be synced too (everything collected or expired).
    tab.setAttribute('data-fut-or-synced', '1');
    const read = Array.from(doc.querySelectorAll(MISSION_CARD)).map((c) => readMissionCard(c));
    const pending = store.get<PendingMap>(PENDING_KEY, {});
    const print = read.map((m) => `${m.id}:${m.cost}:${cardValue(m.rewards)}:${m.incoming}/${m.total}`).join('#');
    if (print === lastPrint && !Object.keys(pending).length) return;
    lastPrint = print;
    const now = Date.now();
    // The ledger: each mission projected onto its last wave; the ones no longer listed are dropped.
    const ledger = syncLedger(loadLedger(), read.map((m) => ({ ...m, lithium: m.rewards.lithium })), now);
    store.set(LEDGER_KEY, ledger);
    // An ignored anomaly that is gone is forgotten, so a new one at the same coordinates counts again.
    const ignored = loadIgnored();
    if (Object.keys(ignored).some((c) => !ledger[c])) store.set(IGNORED_KEY, Object.fromEntries(Object.keys(ignored).filter((c) => ledger[c]).map((c) => [c, true])));
    // The archive: written down or updated, collections settled once the game has paid out.
    let archive = syncArchive(loadArch(), read.filter((m) => m.id).map((m) => ({ id: m.id, name: m.name, coords: m.coords, level: m.level, stars: m.stars, mode: m.mode, kind: m.kind, spawnedAt: m.spawnedAt, wave: m.incoming, waves: m.total })), now);
    const states = new Map<string, CardState>(read.filter((m) => m.id).map((m) => [m.id, { cost: m.cost, value: cardValue(m.rewards), rewards: m.rewards }]));
    const s = settle(pending, archive, states, (id) => !!doc.querySelector(`${COLLECT_DIALOG}[data-space-object-id="${CSS_ESCAPE(id)}"]`), now);
    archive = s.archive;
    if (s.changed) store.set(PENDING_KEY, s.pending);
    store.set(ARCHIVE_KEY, archive);
  };

  // ---------- Discover on a scanner card: noted once the card has really left the scanner ----------
  const discovered = new Map<string, LedgerRecord>();
  const DISCOVER_TTL = 15_000;
  doc.addEventListener(
    'click',
    (e) => {
      const target = e.target as Element | null;
      const card = target?.closest?.(SCAN_CARD);
      if (!card || !target?.closest('.discoverButton')) return;
      const c = readScanCard(card);
      if (!c.coords || !c.cost) return;
      // Only PENDING: the game can refuse (limit reached, position taken) and leave the card there.
      discovered.set(c.coords, { coords: c.coords, name: c.name || c.coords, cost: c.cost, lithium: c.rewards.lithium, msu: msu(c.rewards), endAt: Date.now() + c.hours * 3_600_000, source: 'scanner', at: Date.now() });
    },
    true,
  );
  const commitDiscovered = () => {
    if (!discovered.size) return;
    const onScreen = new Set(Array.from(doc.querySelectorAll(SCAN_CARD)).filter(isShown).map((c) => readScanCard(c).coords));
    const ledger = { ...loadLedger() };
    let changed = false;
    for (const [coords, r] of [...discovered]) {
      if (!onScreen.has(coords)) {
        // Real figures win: a mission record is not replaced.
        if (ledger[coords]?.source !== 'mission') ledger[coords] = r;
        discovered.delete(coords);
        changed = true;
      } else if (Date.now() - r.at > DISCOVER_TTL) discovered.delete(coords);
    }
    if (changed) store.set(LEDGER_KEY, ledger);
  };

  // ---------- the collect: read only ----------
  // The card's "collect" button opens the game's dialog (waves, total cost, Accept / Cancel): Accept is
  // what gets noted. With "don't show again today" there is no dialog and the card button itself is
  // noted. Either way it is PENDING until the game has paid out (see settle in engines/orion).
  let dialogSeen = 0;
  const addPending = (id: string, p: PendingMap[string]) => store.set(PENDING_KEY, { ...store.get<PendingMap>(PENDING_KEY, {}), [id]: p });
  const cardOf = (id: string) => doc.querySelector(`${MISSION_CARD}[data-space-object-id="${CSS_ESCAPE(id)}"]`);
  doc.addEventListener(
    'click',
    (e) => {
      const target = e.target as Element | null;
      if (target?.closest?.(COLLECT_DIALOG) || target?.closest?.('.ui-dialog')?.querySelector(COLLECT_DIALOG)) dialogSeen = Date.now();
      const confirm = target?.closest?.('.orionCollectConfirm');
      const dialog = confirm?.closest(COLLECT_DIALOG);
      if (confirm && dialog && !isDisabled(confirm)) {
        const d = readCollectDialog(dialog);
        if (!d.id) return;
        const el = cardOf(d.id);
        const m: MissionCard | null = el ? readMissionCard(el) : null;
        addPending(d.id, { at: Date.now(), via: 'dialog', cost: d.cost, rewards: d.rewards, before: m?.rewards ?? null, cardCost: m?.cost ?? 0, cardValue: m ? cardValue(m.rewards) : 0, wave: d.waves.length ? Math.max(...d.waves) : (m?.incoming ?? 0), waves: d.waves.length });
        return;
      }
      const button = target?.closest?.('.collectRewards');
      const card = button?.closest(MISSION_CARD);
      if (!button || !card || isDisabled(button)) return;
      const m = readMissionCard(card);
      if (!m.id) return;
      const at = Date.now();
      const p = { at, via: 'card' as const, cost: m.cost, rewards: m.rewards, before: m.rewards, cardCost: m.cost, cardValue: cardValue(m.rewards), wave: m.incoming, waves: 0 };
      // A local UI timer, no request and no game action: give the game time to open its dialog. If one
      // came (even if already closed), its Accept decides; if none came, the button collected directly.
      setTimeout(() => {
        if (!doc.querySelector(COLLECT_DIALOG) && dialogSeen < at) addPending(m.id, p);
      }, 1500);
    },
    true,
  );

  // ---------- shared pieces ----------
  /** The player's own switch: count this anomaly in the lithium planning, or leave it out. */
  const countSwitch = (coords: string, label: boolean) => {
    const on = !loadIgnored()[coords];
    const b = h(doc, 'button', 'fut-or-sw');
    b.type = 'button';
    b.setAttribute('role', 'switch');
    b.setAttribute('aria-checked', String(on));
    b.title = t('orion.toggleHint');
    b.append(h(doc, 'i'));
    if (label) b.append(h(doc, 'span', '', t('orion.countSwitch')));
    else b.setAttribute('aria-label', t('orion.countSwitch'));
    b.addEventListener('click', (e) => {
      e.preventDefault();
      const ignored = { ...loadIgnored() };
      if (ignored[coords]) delete ignored[coords];
      else ignored[coords] = true;
      store.set(IGNORED_KEY, ignored);
      redraw();
    });
    return b;
  };
  /** A tile: symbol and amount, a small label under it. */
  const tile = (cls: string, icon: Element | null, amount: string, label?: string) => {
    const x = h(doc, 'span', `fut-or-t ${cls}`);
    const top = h(doc, 'span');
    if (icon) top.append(icon);
    top.append(amount);
    x.append(top);
    if (label) x.append(h(doc, 'small', '', label));
    return x;
  };
  const rewardTiles = (r: Rewards) => {
    const out: HTMLElement[] = [];
    for (const [k, cls] of [['metal', 'fut-or-m'], ['crystal', 'fut-or-c'], ['deuterium', 'fut-or-d']] as const)
      if (r[k]) out.push(tile(cls, svg(resIconSvg(k, 16)), fmt(r[k]), t(`msg.res.${k}`)));
    if (r.lithium) out.push(tile('fut-or-li', lithiumIcon(), `+${fmt(r.lithium)}`, t('orion.lithiumBack')));
    if (r.other.length) {
      const n = tile('note', null, r.other.join(', '));
      n.title = t('orion.notCountedHint');
      out.push(n);
    }
    return out;
  };
  const endsIn = (r: LedgerRecord) => (r.endAt <= Date.now() ? t('orion.over') : t('orion.endsIn', { h: hoursText((r.endAt - Date.now()) / 3_600_000) }));
  const recordText = (r: LedgerRecord) => `${r.name} [${r.coords}] ${fmt(r.cost)}${r.partial ? ` (${t('orion.soFar')})` : ''}${r.lithium ? ` −${fmt(r.lithium)} ${t('orion.back')}` : ''}, ${endsIn(r)}`;

  // ---------- the cards ----------
  const fingerprint = (card: Element, rewards: string) => `${card.querySelector('.collectRewards .btnSub')?.textContent ?? ''}|${card.querySelector('.scannerResultRow:not(.header)')?.textContent ?? ''}|${card.querySelector('.nodeWave')?.textContent ?? ''}|${Array.from(card.querySelectorAll(rewards)).map((l) => l.textContent).join('|')}`.replace(/\s+/g, ' ');
  const KINDS = [
    { card: SCAN_CARD, rewards: '.scannerResultRewardsList .rewardLine', after: '.scannerResultTable', scanner: true },
    { card: MISSION_CARD, rewards: '.rewardsCell .rewardLine', after: '.missionActionBar', scanner: false },
  ] as const;
  let rendered: Element[] = [];

  const renderKind = (kind: (typeof KINDS)[number], l: Lithium | null, records: LedgerRecord[]): Element[] => {
    const perHour = l?.perHour ?? 0;
    const ledger = loadLedger();
    const scored: { card: Element; index: number }[] = [];
    for (const card of Array.from(doc.querySelectorAll(kind.card))) {
      card.setAttribute('data-fut-or', fingerprint(card, kind.rewards));
      card.classList.remove('fut-or-best');
      card.querySelector('.fut-or')?.remove();
      const s = kind.scanner ? readScanCard(card) : null;
      const m = kind.scanner ? null : readMissionCard(card);
      const data = (s ?? m)!;
      // The value: a scanner card's whole redemption; a mission's whole mission (cost and possible
      // rewards from its details), what is waiting now shown in the tiles.
      const whole = m && m.totalCost ? { cost: m.totalCost, rewards: m.possible } : { cost: data.cost, rewards: data.rewards };
      const p = profit(whole.cost, whole.rewards, perHour);
      const box = h(doc, 'div', 'fut-or');
      const tiles = h(doc, 'div', 'fut-or-tiles');
      const val = h(doc, 'div', 'fut-or-val');
      const known = m ? ledger[m.coords] : undefined;
      if (m && !m.cost && !msu(m.rewards) && !m.rewards.lithium) tiles.append(tile('note', null, t('orion.waiting')));
      else {
        tiles.append(...rewardTiles(data.rewards));
        if (data.cost) tiles.append(tile('fut-or-li neg', lithiumIcon(), `−${fmt(data.cost)}`, kind.scanner ? t('orion.redeemCost') : t('orion.collectCost')));
      }
      if (!whole.cost) val.append(h(doc, 'b', '', m && !msu(whole.rewards) ? '—' : fmt(p.msu)), h(doc, 'small', '', m && !msu(whole.rewards) ? t('orion.waitingShort') : t('orion.msuNoCost')));
      else if (p.free) {
        val.classList.add('free');
        val.append(h(doc, 'b', '', t('orion.freeWord')), h(doc, 'small', '', t('orion.freeHint')));
      } else {
        val.append(h(doc, 'b', '', fmt(p.index)), h(doc, 'small', '', t(perHour > 0 ? 'orion.unitH' : 'orion.unitM')));
        if (perHour > 0) val.append(h(doc, 'small', '', t('orion.redeemHours', { h: hoursText(p.hours) })));
        if (m) val.append(h(doc, 'small', '', t('orion.wholeMission')));
      }
      val.title = `${t('orion.rewards', { v: fmt(p.msu) })}${whole.rewards.lithium ? ` · ${t('orion.paidBack', { paid: fmt(whole.cost), back: fmt(whole.rewards.lithium) })}` : ''}`;
      box.append(tiles, val);
      // The launch plan, on scanner cards: the mission's length and waves are on the card.
      const plan = s && l ? launchPlan({ cost: s.cost, lithium: s.rewards.lithium, msu: p.msu }, s.hours, s.waves, l, records, s.coords, Date.now()) : null;
      if (plan && s) {
        const line = h(doc, 'div', `fut-or-line${plan.covered < plan.waves ? ' short' : ''}`);
        line.title = `${t('orion.planTitle', { h: hoursText(s.hours) })}${plan.due.length ? `\n  ${plan.due.map(recordText).join('\n  ')}` : ` ${t('orion.planNone')}`}${s.rewards.lithium ? `\n${t('orion.planOwnBack', { v: fmt(s.rewards.lithium) })}` : ''}`;
        const held = plan.reserved > 0 ? t('orion.held', { v: fmt(plan.reserved), n: plan.due.length }) : '';
        line.append(h(doc, 'i', 'fut-or-dot'));
        if (plan.covered >= plan.waves) line.append(rich('orion.planAll', { free: fmt(plan.free), held, waves: plan.waves, msu: fmt(plan.msu) }));
        else {
          line.append(rich('orion.planSome', { free: fmt(Math.max(0, plan.free)), held, covered: plan.covered, waves: plan.waves, msu: fmt(plan.msu) }));
          line.append(plan.wait === null ? h(doc, 'span', 'fut-or-dim', t(perHour > 0 ? 'orion.planNever' : 'orion.planNoProd', { waves: plan.waves })) : rich('orion.planWait', { waves: plan.waves, h: hoursText(plan.wait) }));
        }
        box.append(line);
      }
      // A mission: its switch in the lithium planning, with what it will still cost.
      if (m?.coords) {
        const line = h(doc, 'div', 'fut-or-line');
        line.append(countSwitch(m.coords, true));
        if (known && known.cost) line.append(h(doc, 'span', 'fut-or-dim', `${t('orion.totalCost', { v: fmt(known.cost) })}${known.partial ? ` (${t('orion.soFar')})` : ''}${known.msu ? ` · ≈${fmt(known.msu)} MSU` : ''} · ${endsIn(known)}`));
        box.append(line);
      }
      const anchor = card.querySelector(kind.after);
      if (anchor) anchor.after(box);
      else card.append(box);
      scored.push({ card, index: p.index });
    }
    // Best first, within the list each card already sits in. Only the cards move: each keeps its own
    // buttons and the anomaly id inside them, so what a click does is unchanged.
    scored.sort((a, b) => b.index - a.index);
    for (const { card } of scored) card.parentElement?.append(card);
    const shown = scored.filter((x) => isShown(x.card));
    if (shown.length > 1 && shown[0]!.index >= 0) shown[0]!.card.querySelector('.fut-or')?.classList.add('fut-or-best');
    return shown.map((x) => x.card);
  };

  // ---------- the lithium box: above the scanner results and the missions list ----------
  let lastScanCost: number | null = null;
  const renderBox = (l: Lithium | null, records: LedgerRecord[]) => {
    doc.querySelectorAll('.fut-or-box, .fut-or-warn').forEach((n) => n.remove());
    const scanner = doc.querySelector('#scannerResultHolder') ?? doc.querySelector(SCAN_CARD)?.parentElement ?? null;
    const missions = doc.querySelector('.orionTabContentWrapper.anomalyMissions');
    const holder = scanner ?? missions;
    if (!holder || !l) return;
    const sorted = [...records].sort((a, b) => a.endAt - b.endAt);
    const scans = scanner ? scansPossible(l, sorted, scanCost(doc), Date.now()) : null;
    const box = h(doc, 'div', 'fut-or-box');
    const head = h(doc, 'div', 'fut-or-head');
    head.append(h(doc, 'b', '', t('orion.boxTitle')));
    // Production: per hour, until the conversion runs dry or the storage is full.
    if (l.perHour > 0) head.append(h(doc, 'span', '', `${t('orion.prod', { v: fmt(l.perHour) })}${Number.isFinite(l.stopsIn) ? ` · ${t('orion.stopsIn', { h: hoursText(l.stopsIn) })}` : ''}${Number.isFinite(l.cap) && l.now < l.cap ? ` · ${t('orion.fullIn', { h: hoursText((l.cap - l.now) / l.perHour) })}` : ''}`));
    else head.append(h(doc, 'span', 'warn', Number.isFinite(l.cap) && l.now >= l.cap ? t('orion.prodFull') : t('orion.prodStopped')));
    box.append(head);
    const kpis = h(doc, 'div', 'fut-or-kpis');
    const kpi = (label: string, value: string, cls = '', sub = '') => {
      const k = h(doc, 'div', 'fut-or-kpi');
      k.append(h(doc, 'span', '', label), h(doc, 'b', cls, value));
      if (sub) k.append(h(doc, 'em', '', sub));
      kpis.append(k);
    };
    const toPay = sorted.reduce((s, r) => s + (r.cost || 0) - (r.lithium || 0), 0);
    const free = scans?.free ?? freeLithium(l, sorted, Date.now());
    if (scans) kpi(t('orion.kScans'), String(scans.count), scans.count ? 'ok' : 'warn', t('orion.kScansSub', { v: fmt(scans.cost) }));
    kpi(t('orion.kFree'), fmt(free), free < 0 ? 'neg' : '', t('orion.kFreeSub'));
    kpi(t('orion.kHeld'), fmt(toPay), '', t('orion.kHeldSub', { n: sorted.length }));
    kpi(t('orion.kBar'), fmt(l.now), '', Number.isFinite(l.cap) ? t('orion.kBarSub', { v: fmt(l.cap) }) : '');
    box.append(kpis);
    // The anomalies held back for, each with its own switch (ignored ones greyed, still listed).
    const all = Object.values(loadLedger()).sort((a, b) => a.endAt - b.endAt);
    const ignored = loadIgnored();
    if (!all.length) box.append(h(doc, 'p', 'fut-or-empty', t('orion.noneRemembered')));
    else {
      const rows = h(doc, 'div', 'fut-or-rows');
      for (const r of all) {
        const row = h(doc, 'div', `fut-or-row${ignored[r.coords] ? ' off' : ''}`);
        const n = h(doc, 'span', 'n', r.name);
        n.append(h(doc, 'small', '', `[${r.coords}]`));
        const v = h(doc, 'span', `v${r.partial ? ' partial' : ''}`, fmt(r.cost));
        v.title = r.partial ? t('orion.partial') : `${t('orion.totalCost', { v: fmt(r.cost) })}${r.lithium ? ` · ${fmt(r.lithium)} ${t('orion.back')}` : ''}`;
        row.append(n, v, h(doc, 'span', 'e', endsIn(r)), countSwitch(r.coords, false));
        rows.append(row);
      }
      box.append(rows);
    }
    // Before the list, not inside it: the game owns that container.
    holder.before(box);
    lastScanCost = scanCost(doc);
    // The case that costs something: anomalies under way and one more scan would leave one of them
    // unredeemable. Said under the scan panel, read before the Scan button is pressed.
    const panel = doc.querySelector('#scannerPanelGroup');
    if (scans && scans.count === 0 && sorted.length && panel) {
      const warn = h(doc, 'div', 'fut-or-warn');
      warn.append(rich(scans.free < 0 ? 'orion.warnShort' : 'orion.warnFree', { v: fmt(-scans.free), free: fmt(scans.free), cost: fmt(scans.cost) }));
      panel.after(warn);
    }
  };

  const render = () => {
    syncMissions();
    commitDiscovered();
    const l = lithium();
    const records = live();
    rendered = KINDS.flatMap((k) => renderKind(k, l, records));
    renderBox(l, records);
  };

  /** Something changed for the cards since the last render: one new, gone, hidden, or its cost or rewards moved. */
  const outOfDate = () => {
    if (doc.querySelector('#orionMission:not([data-fut-or-synced]), .orionTabContentWrapper.anomalyMissions:not([data-fut-or-synced])')) return true;
    if ((doc.querySelector('#scannerResultHolder') || doc.querySelector('.orionTabContentWrapper.anomalyMissions')) && !doc.querySelector('.fut-or-box') && lithiumNow(doc) !== null) return true;
    if (doc.querySelector('#scannerResultHolder') && scanCost(doc) !== lastScanCost) return true;
    if (Object.keys(store.get<PendingMap>(PENDING_KEY, {})).length || discovered.size) return true;
    const shown: Element[] = [];
    for (const k of KINDS)
      for (const card of Array.from(doc.querySelectorAll(k.card))) {
        if (card.getAttribute('data-fut-or') !== fingerprint(card, k.rewards)) return true;
        if (isShown(card)) shown.push(card);
      }
    return shown.length !== rendered.length || shown.some((c) => !rendered.includes(c));
  };

  // DOM-only observer (no network): the game fetches and redraws its tabs, Discover removes or hides a
  // card, every wave changes a mission. Our own changes happen with the observer disconnected.
  let scheduled = false;
  const watch = () => observer.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'hidden'] });
  const redraw = () => {
    observer.disconnect();
    try {
      if (doc.querySelector(COLLECT_DIALOG)) dialogSeen = Date.now();
      render();
    } finally {
      watch();
    }
  };
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      if (doc.querySelector(COLLECT_DIALOG)) dialogSeen = Date.now();
      if (outOfDate()) redraw();
    });
  });
  redraw();
}
