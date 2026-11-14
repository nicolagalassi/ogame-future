/**
 * Project Orion pages: what each scanned anomaly and each active mission pays per hour of lithium
 * production, best first; a launch plan per anomaly that keeps the lithium for the anomalies already
 * under way; how many scans the bar can pay without starving them; and the archive of every anomaly
 * taken on (shown in the journal's Orion tab). Ported from Nicola's Orion Calculator 1.3.7.
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
import { pageWindow } from '../../data/fleet-dispatcher';
import { COLLECT_DIALOG, depletionHours, isDisabled, lithiumNow, lithiumPerHour, MISSION_CARD, readCollectDialog, readMissionCard, readScanCard, SCAN_CARD, scanCost, storageCap, type MissionCard } from '../../data/orion';
import {
  ARCHIVE_KEY, cardValue, counted, IGNORED_KEY, launchPlan, LEDGER_KEY, loadArchive, PENDING_KEY, profit, pruneLedger, scansPossible, settle, syncArchive, syncLedger,
  type Archive, type CardState, type Ignored, type Ledger, type LedgerRecord, type Lithium, type PendingMap,
} from '../../engines/orion';

type T = (key: string, vars?: Record<string, string | number>) => string;

export interface OrionOptions {
  doc: Document;
  store: Store;
  t: T;
  locale: string;
  /** Opens the journal on its Orion tab. */
  onOpenArchive: () => void;
}

const STYLE_ID = 'fut-orion-style';
const CSS = `
.fut-or { display:flex; flex-wrap:wrap; align-items:baseline; gap:3px 14px; margin:6px 0 2px; padding:5px 8px; font-size:11px; color:#a9b7c6; background:rgba(0,0,0,.28); border-radius:3px; }
.fut-or b { color:#fff; }
.fut-or .fut-or-index { font-size:13px; }
.fut-or .fut-or-muted { color:#7c8a99; }
.fut-or-best { outline:2px solid #ffb800; outline-offset:-2px; }
.fut-or-best .fut-or-index b { color:#ffb800; }
.fut-or .fut-or-plan { flex-basis:100%; padding-top:3px; border-top:1px solid rgba(255,255,255,.06); color:#8fd19e; }
.fut-or .fut-or-plan.short { color:#e0b25a; }
.fut-or-reserve { margin:4px 0 8px; padding:6px 9px; font-size:11px; color:#a9b7c6; background:rgba(0,0,0,.35); border:1px solid rgba(224,178,90,.35); border-radius:3px; }
.fut-or-reserve b { color:#fff; }
.fut-or-reserve .fut-or-row { margin-top:2px; color:#8d9bab; }
.fut-or-reserve .fut-or-ignored { margin-top:4px; color:#7c8a99; }
.fut-or-reserve .fut-or-scans { margin-bottom:4px; font-size:12px; color:#8fd19e; }
.fut-or-reserve .fut-or-short, .fut-or-reserve .fut-or-scans.fut-or-short { color:#e0b25a; }
.fut-or-link { color:#6fa8dc !important; cursor:pointer; text-decoration:none !important; background:none; border:0; padding:0; font:inherit; }
.fut-or-link:hover { text-decoration:underline !important; }
.fut-or .fut-or-link { flex-basis:100%; text-align:left; }
.fut-or .fut-or-link.off { color:#e0b25a !important; }
.fut-or-warn { margin:6px 0; padding:7px 10px; font-size:12px; color:#ffd7d2; background:rgba(160,30,20,.45); border:1px solid #e0533f; border-radius:3px; }
.fut-or-warn b { color:#fff; }
.fut-or-bar { margin:4px 0 6px; text-align:right; }
.fut-or-open { display:inline-block; padding:3px 9px; font-size:11px; color:#d7e3ef; background:rgba(0,0,0,.4); border:1px solid rgba(143,209,158,.45); border-radius:3px; cursor:pointer; }
.fut-or-open:hover { border-color:#8fd19e; color:#fff; }
`;

function h<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, cls = '', text?: string): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** "3h 05m". */
export const hoursText = (hours: number): string => {
  const minutes = Math.round(hours * 60);
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
};

/** A card counts while it is in the page AND shown: after Discover the game may remove it or just hide it. */
const isShown = (el: Element) => el.isConnected && el.getClientRects().length > 0;

export function watchOrion(o: OrionOptions): void {
  const { doc, store, t, locale } = o;
  const win = pageWindow() as Window & { lithiumProduction?: unknown };
  const fmt = (n: number) => formatUnits(n, locale);
  /** Text with <b> around each {var} (but `held`, a phrase of its own): the figures stand out as in the game. */
  const rich = (key: string, vars: Record<string, string | number>) => {
    const span = h(doc, 'span');
    const text = t(key, Object.fromEntries(Object.keys(vars).map((k) => [k, `\u0000${k}\u0000`])));
    text.split('\u0000').forEach((part, i) => {
      if (i % 2) span.append(part === 'held' ? String(vars[part] ?? '') : h(doc, 'b', '', String(vars[part] ?? '')));
      else if (part) span.append(part);
    });
    return span;
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

  // ---------- the missions tab: ledger and archive ----------
  let lastPrint = '';
  const syncMissions = () => {
    const tab = doc.querySelector('#orionMission, .orionTabContentWrapper.anomalyMissions');
    if (!tab) return;
    // An empty list must be synced too (everything collected or expired).
    tab.setAttribute('data-fut-or-synced', '1');
    const cards = Array.from(doc.querySelectorAll(MISSION_CARD));
    const read = cards.map((c) => ({ el: c, m: readMissionCard(c) }));
    const pending = store.get<PendingMap>(PENDING_KEY, {});
    const print = read.map(({ m }) => `${m.id}:${m.cost}:${cardValue(m.rewards)}:${m.incoming}/${m.total}`).join('#');
    if (print === lastPrint && !Object.keys(pending).length) return;
    lastPrint = print;
    const now = Date.now();
    // The ledger: each mission projected onto its last wave; the ones no longer listed are dropped.
    const ledger = syncLedger(loadLedger(), read.map(({ m }) => ({ ...m, lithium: m.rewards.lithium })), now);
    store.set(LEDGER_KEY, ledger);
    // An ignored anomaly that is gone is forgotten, so a new one at the same coordinates counts again.
    const ignored = loadIgnored();
    if (Object.keys(ignored).some((c) => !ledger[c])) store.set(IGNORED_KEY, Object.fromEntries(Object.keys(ignored).filter((c) => ledger[c]).map((c) => [c, true])));
    // The archive: written down or updated, collections settled once the game has paid out.
    let archive = syncArchive(loadArch(), read.filter(({ m }) => m.id).map(({ m }) => ({ id: m.id, name: m.name, coords: m.coords, level: m.level, stars: m.stars, mode: m.mode, kind: m.kind, spawnedAt: m.spawnedAt, wave: m.incoming, waves: m.total })), now);
    const states = new Map<string, CardState>(read.filter(({ m }) => m.id).map(({ m }) => [m.id, { cost: m.cost, value: cardValue(m.rewards), rewards: m.rewards }]));
    const s = settle(pending, archive, states, (id) => !!doc.querySelector(`${COLLECT_DIALOG}[data-space-object-id="${CSS_ESCAPE(id)}"]`), now);
    archive = s.archive;
    if (s.changed) store.set(PENDING_KEY, s.pending);
    store.set(ARCHIVE_KEY, archive);
    updateOpenButtons();
  };
  const CSS_ESCAPE = (s: string) => s.replace(/["\\]/g, '');

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
      discovered.set(c.coords, { coords: c.coords, name: c.name || c.coords, cost: c.cost, lithium: c.rewards.lithium, endAt: Date.now() + c.hours * 3_600_000, source: 'scanner', at: Date.now() });
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

  // ---------- the cards ----------
  /** Ignore toggles: only the player's click changes them. */
  const ignoreButton = (coords: string, label: string, cls = '') => {
    const b = h(doc, 'button', `fut-or-link ${cls}`.trim(), label);
    b.type = 'button';
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

  const fingerprint = (card: Element, rewards: string) => `${card.querySelector('.collectRewards .btnSub')?.textContent ?? ''}|${card.querySelector('.scannerResultRow:not(.header)')?.textContent ?? ''}|${Array.from(card.querySelectorAll(rewards)).map((l) => l.textContent).join('|')}`.replace(/\s+/g, ' ');
  const KINDS = [
    { card: SCAN_CARD, rewards: '.scannerResultRewardsList .rewardLine', after: '.scannerResultTable', scanner: true },
    { card: MISSION_CARD, rewards: '.rewardsCell .rewardLine', after: '.missionActionBar', scanner: false },
  ] as const;
  let rendered: Element[] = [];

  const renderKind = (kind: (typeof KINDS)[number], l: Lithium | null, records: LedgerRecord[]): Element[] => {
    const perHour = l?.perHour ?? 0;
    const scored: { card: Element; index: number }[] = [];
    for (const card of Array.from(doc.querySelectorAll(kind.card))) {
      card.setAttribute('data-fut-or', fingerprint(card, kind.rewards));
      card.classList.remove('fut-or-best');
      card.querySelector('.fut-or')?.remove();
      const s = kind.scanner ? readScanCard(card) : null;
      const m = kind.scanner ? null : readMissionCard(card);
      const data = (s ?? m)!;
      const p = profit(data.cost, data.rewards, perHour);
      const box = h(doc, 'div', 'fut-or');
      if (!data.cost) {
        box.append(rich('orion.rewards', { v: fmt(p.msu) }), h(doc, 'span', 'fut-or-muted', t('orion.noCost')));
      } else {
        // One that gives back at least what it costs is free: ranked above every other.
        const idx = h(doc, 'span', 'fut-or-index');
        idx.append(p.free ? rich('orion.free', { v: t('orion.freeWord') }) : rich(perHour > 0 ? 'orion.index' : 'orion.indexM', { v: fmt(p.index) }));
        box.append(idx);
        if (!p.free && perHour > 0) box.append(rich('orion.redeemHours', { h: hoursText(p.hours) }));
        box.append(rich('orion.rewards', { v: fmt(p.msu) }));
        if (data.rewards.lithium) box.append(rich('orion.paidBack', { paid: fmt(data.cost), back: fmt(data.rewards.lithium) }));
        // The launch plan, on scanner cards: the mission's length and waves are on the card.
        const plan = s && l ? launchPlan({ cost: s.cost, lithium: s.rewards.lithium, msu: p.msu }, s.hours, s.waves, l, records, s.coords, Date.now()) : null;
        if (plan && s) {
          const line = h(doc, 'span', `fut-or-plan${plan.covered < plan.waves ? ' short' : ''}`);
          const dueText = plan.due.map((r) => recordText(r)).join('\n  ');
          line.title = `${t('orion.planTitle', { h: hoursText(s.hours) })}${plan.due.length ? `\n  ${dueText}` : ` ${t('orion.planNone')}`}${s.rewards.lithium ? `\n${t('orion.planOwnBack', { v: fmt(s.rewards.lithium) })}` : ''}`;
          const held = plan.reserved > 0 ? t('orion.held', { v: fmt(plan.reserved), n: plan.due.length }) : '';
          if (plan.covered >= plan.waves) line.append(rich('orion.planAll', { free: fmt(plan.free), held, waves: plan.waves, msu: fmt(plan.msu) }));
          else {
            line.append(rich('orion.planSome', { free: fmt(Math.max(0, plan.free)), held, covered: plan.covered, waves: plan.waves, msu: fmt(plan.msu) }));
            line.append(' · ', plan.wait === null ? t('orion.planNever', { waves: plan.waves }) : rich('orion.planWait', { waves: plan.waves, h: hoursText(plan.wait) }));
          }
          box.append(line);
        }
      }
      // The player's own switch on a mission: count it in the lithium planning, or ignore it.
      if (m?.coords) {
        const off = !!loadIgnored()[m.coords];
        const b = ignoreButton(m.coords, off ? t('orion.toggleOff') : t('orion.toggleOn'), off ? 'off' : '');
        b.title = t('orion.toggleHint');
        box.append(b);
      }
      if (data.rewards.other.length) box.append(h(doc, 'span', 'fut-or-muted', t('orion.notCounted', { list: data.rewards.other.join(', ') })));
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
    if (shown.length > 1 && shown[0]!.index >= 0) shown[0]!.card.classList.add('fut-or-best');
    return shown.map((x) => x.card);
  };

  const recordText = (r: LedgerRecord) =>
    `${r.name} [${r.coords}] ${fmt(r.cost)}${r.partial ? ` (${t('orion.soFar')})` : ''}${r.lithium ? ` −${fmt(r.lithium)} ${t('orion.back')}` : ''}, ${endsIn(r)}`;
  const endsIn = (r: LedgerRecord) => (r.endAt <= Date.now() ? t('orion.over') : t('orion.endsIn', { h: hoursText((r.endAt - Date.now()) / 3_600_000) }));

  // ---------- above the scanner results: scans possible and what is held back ----------
  let lastScanCost: number | null = null;
  const renderReserve = (l: Lithium | null, records: LedgerRecord[]) => {
    doc.querySelectorAll('.fut-or-reserve, .fut-or-warn').forEach((n) => n.remove());
    const holder = doc.querySelector('#scannerResultHolder') ?? doc.querySelector(SCAN_CARD)?.parentElement;
    if (!holder) return;
    const sorted = [...records].sort((a, b) => a.endAt - b.endAt);
    const scans = l ? scansPossible(l, sorted, scanCost(doc), Date.now()) : null;
    const box = h(doc, 'div', 'fut-or-reserve');
    if (scans) {
      const line = h(doc, 'div', `fut-or-scans${scans.count > 0 ? '' : ' fut-or-short'}`);
      if (scans.count > 0) line.append(rich(sorted.length ? 'orion.scansKeep' : 'orion.scansNone', { n: scans.count, cost: fmt(scans.cost), free: fmt(scans.free) }));
      else line.append(rich(scans.free < 0 ? 'orion.scansShort' : 'orion.scansZero', { v: fmt(-scans.free), free: fmt(scans.free), cost: fmt(scans.cost) }));
      box.append(line);
    }
    // The case that costs something: anomalies under way and one more scan would leave one of them
    // unredeemable. Said under the scan panel, read before the Scan button is pressed.
    const panel = doc.querySelector('#scannerPanelGroup');
    if (scans && scans.count === 0 && sorted.length && panel) {
      const warn = h(doc, 'div', 'fut-or-warn');
      warn.append(rich(scans.free < 0 ? 'orion.warnShort' : 'orion.warnFree', { v: fmt(-scans.free), free: fmt(scans.free), cost: fmt(scans.cost) }));
      panel.after(warn);
    }
    const all = Object.values(loadLedger());
    const ignored = loadIgnored();
    const skipped = all.filter((r) => ignored[r.coords]);
    if (!sorted.length) box.append(t(skipped.length ? 'orion.allIgnored' : 'orion.noneRemembered'));
    else {
      box.append(rich('orion.toPay', { n: sorted.length, v: fmt(sorted.reduce((s, r) => s + (r.cost || 0) - (r.lithium || 0), 0)) }));
      for (const r of sorted) {
        const row = h(doc, 'div', 'fut-or-row');
        row.append(`${r.name} [${r.coords}] · `, h(doc, 'b', '', fmt(r.cost)));
        if (r.partial) row.append(' ', h(doc, 'span', 'fut-or-short', t('orion.partial')));
        if (r.lithium) row.append(` · ${fmt(r.lithium)} ${t('orion.back')}`);
        row.append(` · ${endsIn(r)} · `, ignoreButton(r.coords, t('orion.ignore')));
        row.lastElementChild!.setAttribute('title', t('orion.ignoreHint'));
        box.append(row);
      }
    }
    if (skipped.length) {
      const row = h(doc, 'div', 'fut-or-ignored', `${t('orion.ignoredList')} `);
      skipped.forEach((r, i) => {
        if (i) row.append(' · ');
        row.append(`${r.name} [${r.coords}] · ${fmt(r.cost)} `, ignoreButton(r.coords, t('orion.countAgain')));
      });
      box.append(row);
    }
    // Before the list, not inside it: the game owns that container.
    holder.before(box);
    lastScanCost = scanCost(doc);
  };

  // ---------- the way to the archive: a button above the missions overview ----------
  const updateOpenButtons = () => {
    const n = Object.keys(loadArch().entries).length;
    doc.querySelectorAll('.fut-or-open').forEach((b) => (b.textContent = t('orion.openArchive', { n })));
  };
  const placeOpenButton = () => {
    let added = false;
    for (const wrapper of Array.from(doc.querySelectorAll('.orionTabContentWrapper.anomalyMissions'))) {
      if (wrapper.previousElementSibling?.classList.contains('fut-or-bar')) continue;
      const bar = h(doc, 'div', 'fut-or-bar');
      const b = h(doc, 'button', 'fut-or-open');
      b.type = 'button';
      b.addEventListener('click', () => o.onOpenArchive());
      bar.append(b);
      wrapper.before(bar);
      added = true;
    }
    if (added) updateOpenButtons();
  };

  const render = () => {
    syncMissions();
    commitDiscovered();
    const l = lithium();
    const records = live();
    rendered = KINDS.flatMap((k) => renderKind(k, l, records));
    renderReserve(l, records);
    placeOpenButton();
  };

  /** Something changed for the cards since the last render: one new, gone, hidden, or its cost or rewards moved. */
  const outOfDate = () => {
    if (doc.querySelector('#orionMission:not([data-fut-or-synced]), .orionTabContentWrapper.anomalyMissions:not([data-fut-or-synced])')) return true;
    if (doc.querySelector('#scannerResultHolder') && (!doc.querySelector('.fut-or-reserve') || scanCost(doc) !== lastScanCost)) return true;
    if (doc.querySelector('.orionTabContentWrapper.anomalyMissions') && !doc.querySelector('.fut-or-bar')) return true;
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
