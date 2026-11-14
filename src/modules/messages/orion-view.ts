/**
 * The journal's Orion tab: the anomalies taken on (archive kept by modules/orion), per period like
 * the expeditions: balance, a column per hour or day (rewards above the line, costs below), ships
 * received and lost, and the anomalies that appeared in the period with the period's own figures.
 * Stored data only: no network, no game action.
 */
import { formatUnits } from '../../core/format';
import type { Store } from '../../core/storage';
import { SHIPS_INFO_KEY, type ShipsInfo } from '../../data/fleet-dispatcher';
import { SHIPS, TECH_NAMES_KEY, techName, type TechNames } from '../../data/tech-names';
import { dayStart, periodRange, type Period } from '../../engines/expeditions';
import { ARCHIVE_KEY, balance, emptyArchive, loadArchive, orionEvents, orionTotals, otherSummary, shipMatcher, type Archive, type Entry, type OrionEvent, type OrionTotals } from '../../engines/orion';
import type { T } from './index';

export const ORION_CSS = `
.och { display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); gap: 6px; height: 200px; }
.och.dense { gap: 3px; }
.och .col { display: grid; grid-template-rows: 15px var(--up) var(--down) 14px; gap: 0; }
.och .up { display: flex; align-items: flex-end; justify-content: center; border-bottom: 1px solid var(--line); }
.och .down { display: flex; align-items: flex-start; justify-content: center; }
.och .up i, .och .down i { display: block; width: 72%; max-width: 34px; }
.och .up i { background: #3987E5; border-radius: 3px 3px 0 0; }
.och .down i { background: #E66767; border-radius: 0 0 3px 3px; }
.och .col.on .up i, .och .col.on .down i { box-shadow: 0 0 0 2px var(--accent); }
.olegend { display: flex; flex-wrap: wrap; gap: 14px; margin: 0 0 8px; color: var(--muted); font-size: 11px; }
.olegend i { display: inline-block; width: 10px; height: 10px; margin-right: 5px; border-radius: 2px; vertical-align: -1px; }
.ofilters { display: flex; flex-wrap: wrap; gap: 6px 12px; align-items: center; margin-bottom: 8px; font-size: 12px; color: var(--muted); }
.ofilters input, .ofilters select { height: 24px; padding: 0 6px; border: 1px solid var(--line); border-radius: 5px; background: var(--bg); color: var(--text); font: 12px Arial, sans-serif; }
.ofilters input { width: 200px; }
.otable th { cursor: pointer; white-space: nowrap; }
.otable td { white-space: nowrap; }
.otable td.num, .otable th.num { text-align: right; font-family: var(--mono); }
.otag { padding: 0 5px; border-radius: 3px; background: #2A3542; color: #fff; }
.otag.pvp { background: #7A2A22; } .otag.pve { background: #24563A; }
.ost-running { color: #E0B25A; } .ost-collected { color: var(--ok); } .ost-expired { color: var(--muted); }
.odel { padding: 0 6px; border: 0; background: none; color: #C06050; font-weight: 700; cursor: pointer; }
.odel.armed { color: #fff; background: var(--bad); border-radius: 3px; }
.oother { margin: 6px 0 0; color: var(--text-2); font-size: 12px; line-height: 1.6; }
`;

export interface OrionState {
  q: string;
  mode: string;
  kind: string;
  stars: string;
  status: string;
  sort: string;
  desc: boolean;
  /** The chart column picked (its start): the anomalies and details of that column only. */
  focus: number | null;
  /** The × armed for this anomaly id: a second click removes it (no browser dialog). */
  armed: string | null;
}

export const orionState = (): OrionState => ({ q: '', mode: '', kind: '', stars: '', status: '', sort: 'date', desc: true, focus: null, armed: null });

export interface OrionViewContext {
  doc: Document;
  store: Store;
  t: T;
  locale: string;
  now: number;
  period: Period;
  state: OrionState;
  redraw: () => void;
  shipGrid: (units: [string, number][], lost: boolean) => HTMLElement;
}

function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

export const loadOrion = (store: Store): Archive => loadArchive(store.get<Archive | null>(ARCHIVE_KEY, null));
export const hasOrion = (store: Store): boolean => Object.keys(loadOrion(store).entries).length > 0 || loadOrion(store).fuel.length > 0;

/** Ship names in the game's language (fleet page, technology pages) and in English, for the ship rewards. */
function matcher(store: Store, locale: string) {
  const info = store.get<ShipsInfo>(SHIPS_INFO_KEY, {});
  const learned = store.get<TechNames>(TECH_NAMES_KEY, {});
  const names: [number, string][] = [];
  for (const id of SHIPS) {
    if (info[String(id)]?.name) names.push([id, info[String(id)]!.name]);
    names.push([id, techName(id, locale, learned)], [id, techName(id, 'en')]);
  }
  return shipMatcher(names);
}

/** Every dated event, with the player's own planets known (a flight home is not anomaly fuel). */
export function orionData(doc: Document, store: Store, locale: string, now: number) {
  const archive = loadOrion(store);
  const home = new Set(Array.from(doc.querySelectorAll('#planetList .planet-koords')).map((el) => /\d+:\d+:\d+/.exec(el.textContent ?? '')?.[0] ?? ''));
  return { archive, events: orionEvents(archive, home, now), shipOf: matcher(store, locale) };
}

/** Today's balance in MSU, for the journal tab's count. */
export function orionCount(store: Store, period: Period, now: number): number {
  const [from, to] = periodRange(period, now);
  return Object.values(loadOrion(store).entries).filter((e) => { const at = e.spawnedAt || e.firstSeen; return at >= from && at < to; }).length;
}

const inRange = (events: OrionEvent[], from: number, to: number) => events.filter((e) => e.at >= from && e.at < to);

export function orionView(c: OrionViewContext): HTMLElement[] {
  const { t, locale, now, period, state } = c;
  const fmt = (n: number) => formatUnits(n, locale);
  const sign = (n: number) => `${n < 0 ? '−' : ''}${fmt(Math.abs(n))}`;
  const { archive, events, shipOf } = orionData(c.doc, c.store, locale, now);
  const out: HTMLElement[] = [];
  if (!Object.keys(archive.entries).length && !archive.fuel.length) return [h('p', 'empty', t('orion.empty'))];

  // The columns: hours of the day (today / yesterday), else days (7, or the last 30).
  const [pFrom, pTo] = periodRange(period, now);
  const single = period === 'today' || period === 'yesterday';
  const starts: number[] = [];
  if (single) for (let i = 0; i < 24; i++) starts.push(new Date(pFrom).setHours(i, 0, 0, 0));
  else {
    let d = dayStart(now);
    for (let i = 0; i < (period === 'week' ? 7 : 30); i++) {
      starts.unshift(d);
      d = dayStart(d - 1);
    }
  }
  const endOf = (s: number, i: number) => starts[i + 1] ?? (single ? new Date(s).setHours(24, 0, 0, 0) : dayStart(s + 36 * 3_600_000));
  if (state.focus !== null && !starts.includes(state.focus)) state.focus = null;
  const fi = state.focus !== null ? starts.indexOf(state.focus) : -1;
  const [from, to] = fi >= 0 ? [starts[fi]!, endOf(starts[fi]!, fi)] : [pFrom, pTo];
  const label = (s: number, short: boolean) => {
    const d = new Date(s);
    if (single) return short ? (d.getHours() % 3 === 0 ? String(d.getHours()) : '') : `${String(d.getHours()).padStart(2, '0')}:00`;
    if (starts.length <= 7) return d.toLocaleDateString(locale, { weekday: 'short', day: '2-digit' });
    return short ? ((starts.length - 1 - starts.indexOf(s)) % 5 === 0 ? String(d.getDate()) : '') : d.toLocaleDateString(locale, { weekday: 'short', day: '2-digit', month: '2-digit' });
  };
  const tot: OrionTotals = orionTotals(inRange(events, from, to), shipOf);
  const net = balance(tot);

  // Balance, and where it came from.
  const hero = h('div', 'card hero');
  const top = h('div', 'hero-top');
  const main = h('div', 'hero-net');
  main.append(h('span', 'hero-k', `${t('orion.balance')} · ${fi >= 0 ? label(from, false) : t(`exp.period.${period}`)}`));
  const big = h('b', `hero-v${net < 0 ? ' neg' : ''}`, sign(net));
  big.append(h('small', '', 'MSU'));
  main.title = t('orion.balanceHint');
  main.append(big);
  const part = (k: string, value: number, note: string, neg = false) => {
    const p = h('div', 'hero-part');
    const v = h('b', `hero-pv${neg && value ? ' neg' : ''}`, `${neg && value ? '−' : ''}${fmt(value)}`);
    v.append(h('small', '', 'MSU'));
    p.append(h('span', 'hero-k', k), v, h('span', 'hero-note', note));
    return p;
  };
  top.append(
    main,
    part(t('orion.rewardsK'), tot.gain, `M ${fmt(tot.res.metal)} · C ${fmt(tot.res.crystal)} · D ${fmt(tot.res.deuterium)}`),
    part(t('orion.shipsGot'), tot.gotMsu, `${fmt(tot.gotN)} ${t('orion.shipsN')}`),
    part(t('orion.costs'), tot.lostMsu + tot.fuelMsu, `${t('orion.lost')} ${fmt(tot.lostMsu)} (${fmt(tot.lostN)}, ${tot.battles} ${t('orion.battlesN')}) · ${t('orion.fuel')} ${fmt(tot.fuel)} D`, true),
  );
  const strip = h('p', 'hero-sub');
  strip.append(
    h('b', '', String(tot.collections)), ` ${t('orion.collectionsN')} · `,
    h('b', '', String(tot.waves)), ` ${t('orion.wavesN')} · ${t('orion.lithiumNet')} `,
    h('b', '', fmt(tot.paid - tot.back)), ` (${t('orion.paid')} ${fmt(tot.paid)} · ${t('orion.back')} ${fmt(tot.back)})`,
  );
  hero.append(top, strip);
  out.push(hero);

  // One column per hour or day: rewards + ships received above the line, ships lost + fuel below.
  const cols = starts.map((s, i) => {
    const x = orionTotals(inRange(events, s, endOf(s, i)), shipOf);
    return { s, x, up: x.gain + x.gotMsu, down: x.lostMsu + x.fuelMsu };
  });
  const maxUp = Math.max(0, ...cols.map((x) => x.up));
  const maxDown = Math.max(0, ...cols.map((x) => x.down));
  const H = 165;
  const upH = maxUp + maxDown ? Math.max(30, Math.round((H * maxUp) / (maxUp + maxDown))) : H;
  const downH = Math.max(0, H - upH);
  const card = h('div', 'card');
  const head = h('div', 'card-head');
  head.append(h('h3', '', t(single ? 'exp.byHour' : 'exp.byDay')));
  if (state.focus !== null) {
    const all = h('button', 'act ghost', t('exp.focusAll'));
    all.addEventListener('click', () => {
      state.focus = null;
      c.redraw();
    });
    head.append(all);
  }
  const legend = h('div', 'olegend');
  const key = (color: string, text: string) => {
    const s = h('span');
    const sw = h('i');
    sw.style.background = color;
    s.append(sw, text);
    legend.append(s);
  };
  key('#3987E5', t('orion.legendUp'));
  key('#E66767', t('orion.legendDown'));
  card.append(head, legend);
  const chart = h('div', `och${cols.length > 14 ? ' dense' : ''}`);
  chart.style.setProperty('--n', String(cols.length));
  chart.style.setProperty('--up', `${upH}px`);
  chart.style.setProperty('--down', `${downH}px`);
  for (const col of cols) {
    const b = h('button', `col${state.focus === col.s ? ' on' : ''}`);
    b.type = 'button';
    b.setAttribute('aria-pressed', String(state.focus === col.s));
    b.title = [label(col.s, false), `${t('orion.rewardsK')}: ${fmt(col.x.gain)} MSU`, `${t('orion.shipsGot')}: ${fmt(col.x.gotMsu)} MSU`, `${t('orion.lost')}: ${fmt(col.x.lostMsu)} MSU`, `${t('orion.fuel')}: ${fmt(col.x.fuel)} D`, `${t('orion.balance')}: ${sign(balance(col.x))} MSU`].join('\n');
    const up = h('span', 'up');
    const down = h('span', 'down');
    if (col.up > 0) {
      const i = h('i');
      i.style.height = `${Math.max(2, Math.round((upH * col.up) / (maxUp || 1)))}px`;
      up.append(i);
    }
    if (col.down > 0) {
      const i = h('i');
      i.style.height = `${Math.max(2, Math.round((downH * col.down) / (maxDown || 1)))}px`;
      down.append(i);
    }
    b.append(h('span', 'tot', cols.length <= 14 && (col.up || col.down) ? sign(balance(col.x)) : ''), up, down, h('span', 'lbl', label(col.s, true)));
    b.addEventListener('click', () => {
      state.focus = state.focus === col.s ? null : col.s;
      c.redraw();
    });
    chart.append(b);
  }
  card.append(chart);
  out.push(card);

  // Ships received and lost, other rewards.
  const got = Object.entries(tot.got);
  const lost = Object.entries(tot.lost);
  if (got.length || lost.length || tot.other.length) {
    const two = h('div', 'two');
    const a = h('div', 'card');
    a.append(h('h3', '', t('orion.shipsGot')));
    a.append(got.length ? c.shipGrid(got, false) : h('p', 'empty', t('exp.noneHere')));
    if (tot.other.length) a.append(h('p', 'oother', `${t('orion.other')}: ${otherSummary(tot.other, locale)}`));
    const b = h('div', 'card');
    b.append(h('h3', '', t('orion.lost')));
    b.append(lost.length ? c.shipGrid(lost, true) : h('p', 'empty', t('exp.noneHere')));
    two.append(a, b);
    out.push(two);
  }

  // The anomalies that appeared in the period (or column), with that period's own figures.
  const all = Object.values(archive.entries);
  const q = state.q.toLowerCase();
  type Row = Entry & { date: number; x: OrionTotals };
  const rows: Row[] = all
    .filter((e) => { const at = e.spawnedAt || e.firstSeen || 0; return at >= from && at < to; })
    .map((e) => ({ ...e, date: e.spawnedAt || e.firstSeen || 0, x: orionTotals(inRange(events, from, to).filter((ev) => ev.entry === e.id), shipOf) }))
    .filter((r) => (!q || `${r.name} ${r.coords}`.toLowerCase().includes(q)) && (!state.mode || r.mode === state.mode) && (!state.kind || r.kind === state.kind) && (!state.stars || String(r.stars) === state.stars) && (!state.status || r.status === state.status));
  const COLS: { k: string; label: string; num?: boolean; v: (r: Row) => number | string; show: (r: Row) => string | HTMLElement }[] = [
    { k: 'date', label: t('orion.col.spawned'), num: true, v: (r) => r.date, show: (r) => (r.date ? new Date(r.date).toLocaleString(locale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '') },
    { k: 'name', label: t('orion.col.name'), v: (r) => r.name, show: (r) => r.name },
    { k: 'coords', label: t('orion.col.coords'), v: (r) => r.coords, show: (r) => r.coords },
    { k: 'level', label: t('orion.col.level'), num: true, v: (r) => r.level, show: (r) => (r.level ? String(r.level) : '') },
    { k: 'stars', label: t('orion.col.stars'), num: true, v: (r) => r.stars, show: (r) => '★'.repeat(r.stars) },
    { k: 'mode', label: t('orion.col.mode'), v: (r) => r.mode, show: (r) => { const s = h('span', `otag ${r.mode.toLowerCase()}`, r.mode); return r.mode ? s : ''; } },
    { k: 'kind', label: t('orion.col.kind'), v: (r) => r.kind, show: (r) => r.kind },
    { k: 'wave', label: t('orion.col.waves'), num: true, v: (r) => r.wave, show: (r) => (r.waves ? `${r.wave}/${r.waves}` : '') },
    { k: 'status', label: t('orion.col.status'), v: (r) => r.status, show: (r) => h('span', `ost-${r.status}`, t(`orion.status.${r.status}`)) },
    { k: 'paid', label: t('orion.col.paid'), num: true, v: (r) => r.x.paid, show: (r) => (r.x.paid ? fmt(r.x.paid) : '') },
    { k: 'back', label: t('orion.col.back'), num: true, v: (r) => r.x.back, show: (r) => (r.x.back ? fmt(r.x.back) : '') },
    { k: 'gain', label: t('orion.rewardsK'), num: true, v: (r) => r.x.gain, show: (r) => (r.x.gain ? fmt(r.x.gain) : '') },
    { k: 'got', label: t('orion.shipsGot'), num: true, v: (r) => r.x.gotMsu, show: (r) => (r.x.gotN ? `${fmt(r.x.gotMsu)} (${fmt(r.x.gotN)})` : '') },
    { k: 'fuel', label: t('orion.fuel'), num: true, v: (r) => r.x.fuel, show: (r) => (r.x.fuel ? fmt(r.x.fuel) : '') },
    { k: 'lost', label: t('orion.lost'), num: true, v: (r) => r.x.lostMsu, show: (r) => (r.x.lostN ? `${fmt(r.x.lostMsu)} (${fmt(r.x.lostN)})` : '') },
    { k: 'net', label: t('orion.balance'), num: true, v: (r) => balance(r.x), show: (r) => { const n = balance(r.x); return r.x.gain || r.x.gotMsu || r.x.lostMsu || r.x.fuelMsu ? h('span', n < 0 ? 'neg' : '', sign(n)) : ''; } },
    { k: 'other', label: t('orion.other'), v: (r) => otherSummary(r.x.other, locale), show: (r) => otherSummary(r.x.other, locale) },
  ];
  const sortCol = COLS.find((x) => x.k === state.sort) ?? COLS[0]!;
  rows.sort((a, b) => {
    const x = sortCol.v(a);
    const y = sortCol.v(b);
    const d = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
    return state.desc ? -d : d;
  });

  const tcard = h('div', 'card');
  tcard.append(h('h3', '', `${t('orion.anomalies')} · ${rows.length}`));
  const filters = h('div', 'ofilters');
  const search = h('input');
  search.type = 'search';
  search.placeholder = t('orion.search');
  search.value = state.q;
  search.addEventListener('change', () => {
    state.q = search.value;
    c.redraw();
  });
  filters.append(search);
  const select = (k: 'mode' | 'kind' | 'stars' | 'status', values: string[], text: (v: string) => string = (v) => v) => {
    const l = h('label', '', `${t(`orion.col.${k}`)} `);
    const s = h('select');
    for (const v of ['', ...[...new Set(values.filter(Boolean))].sort()]) {
      const opt = h('option', '', v ? text(v) : t('orion.all'));
      opt.value = v;
      opt.selected = v === state[k];
      s.append(opt);
    }
    s.addEventListener('change', () => {
      state[k] = s.value;
      c.redraw();
    });
    l.append(s);
    filters.append(l);
  };
  select('mode', all.map((e) => e.mode));
  select('kind', all.map((e) => e.kind));
  select('stars', all.map((e) => (e.stars ? String(e.stars) : '')));
  select('status', ['running', 'collected', 'expired'], (v) => t(`orion.status.${v}`));
  filters.append(h('span', '', t('orion.rowsHint')));
  tcard.append(filters);
  if (!rows.length) tcard.append(h('p', 'empty', t('orion.noneInPeriod')));
  else {
    const scroll = h('div', 'scroll');
    const table = h('table', 'otable');
    const hr = h('tr');
    for (const col of COLS) {
      const th = h('th', col.num ? 'num' : '', `${col.label}${state.sort === col.k ? (state.desc ? ' ▾' : ' ▴') : ''}`);
      th.addEventListener('click', () => {
        state.desc = state.sort === col.k ? !state.desc : !!col.num;
        state.sort = col.k;
        c.redraw();
      });
      hr.append(th);
    }
    hr.append(h('th'));
    table.append(hr);
    for (const r of rows) {
      const tr = h('tr');
      for (const col of COLS) {
        const td = h('td', col.num ? 'num' : '');
        td.append(col.show(r));
        tr.append(td);
      }
      // Two clicks, no browser dialog: the first arms the ×.
      const del = h('button', `odel${state.armed === r.id ? ' armed' : ''}`, state.armed === r.id ? t('orion.delConfirm') : '×');
      del.type = 'button';
      del.title = t('orion.del');
      del.addEventListener('click', () => {
        if (state.armed !== r.id) {
          state.armed = r.id;
          return c.redraw();
        }
        state.armed = null;
        const a = loadOrion(c.store);
        const { [r.id]: _gone, ...entries } = a.entries;
        c.store.set(ARCHIVE_KEY, { ...a, entries });
        c.redraw();
      });
      const td = h('td');
      td.append(del);
      tr.append(td);
      table.append(tr);
    }
    scroll.append(table);
    tcard.append(scroll);
  }
  out.push(tcard);
  return out;
}

/** One line per day, the same figures as the strip: lithium, rewards, ships, fuel, balance. */
export function orionCsv(events: OrionEvent[], shipOf: (text: string) => { id: number; n: number } | null): string {
  const days = [...new Set(events.map((e) => dayStart(e.at)))].sort((a, b) => a - b);
  const head = ['day', 'collections', 'waves', 'lithium_paid', 'lithium_back', 'metal', 'crystal', 'deuterium', 'rewards_msu', 'ships_reward', 'ships_reward_msu', 'fuel_deut', 'battles', 'ships_lost', 'ships_lost_msu', 'net_msu'];
  const iso = (d: number) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
  const lines = days.map((d) => {
    const x = orionTotals(events.filter((e) => dayStart(e.at) === d), shipOf);
    return [iso(d), x.collections, x.waves, x.paid, x.back, x.res.metal, x.res.crystal, x.res.deuterium, Math.round(x.gain), x.gotN, Math.round(x.gotMsu), x.fuel, x.battles, x.lostN, Math.round(x.lostMsu), Math.round(balance(x))].join(';');
  });
  return `﻿${[head.join(';'), ...lines].join('\n')}`;
}

export const clearOrion = (store: Store): void => store.set(ARCHIVE_KEY, emptyArchive());
