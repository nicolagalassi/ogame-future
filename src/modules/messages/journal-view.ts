/**
 * Expedition journal window: what expeditions brought per period, outcomes, ships found and
 * lost, day by day. Shadow DOM, like the planner. Stored data only: no network, no game action.
 */
import { icon } from '../../core/icons';
import { WINDOW_SHEET } from '../../core/sheet';
import type { Store } from '../../core/storage';
import { formatUnits } from '../../core/format';
import { SHIPS_INFO_KEY, type ShipsInfo } from '../../data/fleet-dispatcher';
import type { Outcome } from '../../data/messages';
import { byDay, daySeries, entriesIn, hourSeries, JOURNAL_KEY, msu, periodRange, periodStats, raidStats, valueMix, type Bucket, type Journal, type Period, type PeriodStats } from '../../engines/expeditions';
import { resIconSvg } from '../../core/res-icons';
import { iconSvg } from '../fleet/icons';
import { FOLD_KEY, shipIcon, shipName, type T } from './index';
import { JOURNAL_CSS, OUTCOME_COLORS } from './style';

export const JOURNAL_ID = 'fut-journal';
const PERIOD_KEY = 'exp.period';
const KIND_KEY = 'exp.kind';
/** Expeditions, discovery missions (artefacts, lifeform XP) and imported raids: each its own tab. */
type Kind = 'expedition' | 'discovery' | 'raid';
const PERIODS: Period[] = ['today', 'yesterday', 'week', 'month', 'all'];
const ORDER: Outcome[] = ['resource', 'darkmatter', 'ship', 'item', 'trader', 'early', 'late', 'pirate', 'alien', 'blackhole', 'nothing', 'artefact', 'lifeform', 'unknown'];

export interface JournalOptions {
  doc: Document;
  store: Store;
  now: number;
  locale: string;
  t: T;
}

let keyHandler: ((e: KeyboardEvent) => void) | null = null;

function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function closeJournal(doc: Document): void {
  doc.getElementById(JOURNAL_ID)?.remove();
  if (keyHandler) doc.removeEventListener('keydown', keyHandler, true);
  keyHandler = null;
}

export function openJournal(o: JournalOptions): void {
  const { doc, t, locale, store } = o;
  closeJournal(doc);
  const host = doc.createElement('div');
  host.id = JOURNAL_ID;
  const root = host.attachShadow({ mode: 'open' });
  const style = h('style');
  style.textContent = WINDOW_SHEET + JOURNAL_CSS;
  const backdrop = h('div', 'backdrop');
  const panel = h('div', 'panel');
  backdrop.append(panel);
  root.append(style, backdrop);
  doc.body.append(host);

  const fmt = (n: number) => formatUnits(n, locale);
  const ships = store.get<ShipsInfo>(SHIPS_INFO_KEY, {});
  let period = store.get<Period>(PERIOD_KEY, 'week');
  if (!PERIODS.includes(period)) period = 'week';
  let confirmClear = false;
  let kind = store.get<Kind>(KIND_KEY, 'expedition');
  /** The chart column picked (its start), whose outcomes and ships are shown; null = the whole period. */
  let focus: number | null = null;
  const MIX_COLORS = { metal: 'var(--m)', crystal: 'var(--c)', deuterium: 'var(--d)', ships: '#2E9E7E' } as const;
  const svg = (html: string) => {
    const span = h('span', 'gi');
    span.innerHTML = html;
    return span;
  };

  /** Ship tiles, found or lost: picture, how many, name. */
  const shipGrid = (units: [string, number][], lost: boolean) => {
    const list = h('div', `ships${lost ? ' lost' : ''}`);
    for (const [id, n] of units.sort((x, y) => Number(x[0]) - Number(y[0]))) {
      const name = shipName(Number(id), ships, t);
      const tile = h('div', 'ship');
      const info = h('div', 'ship-info');
      info.append(h('b', lost ? 'neg' : 'pos', `${lost ? '−' : '+'}${n.toLocaleString(locale)}`), h('span', 'ship-name', name));
      tile.append(shipIcon(doc, Number(id), name, 'ship-img'), info);
      list.append(tile);
    }
    return list;
  };

  /**
   * Expeditions, as a statement: the net gain first and where it came from; then one column per
   * hour (a single day) or per day (longer periods), a click showing that column's outcomes and
   * ships; the days in a table at the end.
   */
  const expeditionView = (entries: Parameters<typeof periodStats>[0], s: PeriodStats): HTMLElement[] => {
    const out: HTMLElement[] = [];
    const sign = (n: number) => `${n < 0 ? '−' : ''}${fmt(Math.abs(n))}`;

    // Net gain, and where it came from.
    const hero = h('div', 'card hero');
    const top = h('div', 'hero-top');
    const net = h('div', 'hero-net');
    net.append(h('span', 'hero-k', `${t('exp.net')} · ${t(`exp.period.${period}`)}`));
    const big = h('b', `hero-v${s.netMsu < 0 ? ' neg' : ''}`, sign(s.netMsu));
    big.append(h('small', '', 'MSU'));
    net.append(big);
    const sub = h('p', 'hero-sub');
    sub.append(
      h('b', '', s.count.toLocaleString(locale)), ` ${t('exp.heroCount')} · `,
      h('b', '', s.count ? fmt(s.netMsu / s.count) : '—'), ` ${t('exp.heroAvg')}`,
    );
    net.append(sub);
    // The total split in two: what the resources brought, what the fleet brought (found − lost).
    const part = (label: string, value: number, note?: HTMLElement) => {
      const p = h('div', 'hero-part');
      const v = h('b', `hero-pv${value < 0 ? ' neg' : ''}`, sign(value));
      v.append(h('small', '', 'MSU'));
      p.append(h('span', 'hero-k', label), v);
      if (note) p.append(note);
      return p;
    };
    const resMsu = msu(s.res);
    const fleetMsu = msu(s.shipsValue) - msu(s.lostValue);
    const lostNote = h('span', 'hero-note');
    lostNote.append(`${t('exp.heroFound')} `, h('b', '', fmt(msu(s.shipsValue))));
    if (msu(s.lostValue)) lostNote.append(` · ${t('exp.heroLostShort')} `, h('b', 'neg', `−${fmt(msu(s.lostValue))}`));
    top.append(net, part(t('exp.heroRes'), resMsu), part(t('exp.heroFleet'), fleetMsu, lostNote));
    const mix = valueMix(s);
    const mixTotal = mix.metal + mix.crystal + mix.deuterium + mix.ships;
    const bar = h('div', 'mix');
    for (const k of ['metal', 'crystal', 'deuterium', 'ships'] as const) {
      if (!mix[k]) continue;
      const seg = h('i');
      seg.style.width = `${(mix[k] / (mixTotal || 1)) * 100}%`;
      seg.style.background = MIX_COLORS[k];
      seg.title = `${k === 'ships' ? t('exp.shipsFound') : t(`msg.res.${k}`)}: ${fmt(mix[k])} MSU (${Math.round((mix[k] / (mixTotal || 1)) * 100)}%)`;
      bar.append(seg);
    }
    const keys = h('div', 'mix-keys');
    const key = (glyph: HTMLElement, label: string, value: string, cls: string) => {
      const k = h('span', `mix-key ${cls}`);
      k.append(glyph, h('span', 'mk-l', label), h('b', '', value));
      keys.append(k);
    };
    key(svg(resIconSvg('metal', 15)), t('msg.res.metal'), fmt(s.res.metal), 'm');
    key(svg(resIconSvg('crystal', 15)), t('msg.res.crystal'), fmt(s.res.crystal), 'c');
    key(svg(resIconSvg('deuterium', 15)), t('msg.res.deuterium'), fmt(s.res.deuterium), 'd');
    key(svg(iconSvg('fleetValue', 15)), t('exp.shipsFound'), `${fmt(msu(s.shipsValue))} MSU`, 'sh');
    if (s.res.darkMatter) key(svg(resIconSvg('darkMatter', 15)), t('msg.res.darkMatter'), fmt(s.res.darkMatter), 'dm');
    hero.append(top);
    if (mixTotal) hero.append(bar);
    hero.append(keys);
    out.push(hero);

    // One column per hour (a single day) or per day.
    const single = period === 'today' || period === 'yesterday';
    const [from] = periodRange(period, o.now);
    const buckets: Bucket[] = single ? hourSeries(entries, from) : daySeries(entries, o.now, period === 'week' ? 7 : 30);
    const label = (b: Bucket, short: boolean) => {
      const d = new Date(b.start);
      if (single) return short ? (d.getHours() % 3 === 0 ? String(d.getHours()) : '') : `${String(d.getHours()).padStart(2, '0')}:00`;
      if (buckets.length <= 7) return d.toLocaleDateString(locale, { weekday: 'short', day: '2-digit' });
      return short ? (buckets.length - 1 - buckets.indexOf(b)) % 5 === 0 ? String(d.getDate()) : '' : d.toLocaleDateString(locale, { weekday: 'short', day: '2-digit', month: '2-digit' });
    };
    if (focus !== null && !buckets.some((b) => b.start === focus)) focus = null;
    const chartCard = h('div', 'card');
    const chartHead = h('div', 'card-head');
    chartHead.append(h('h3', '', t(single ? 'exp.byHour' : 'exp.byDay')));
    if (focus !== null) {
      const all = h('button', 'act ghost', t('exp.focusAll'));
      all.addEventListener('click', () => {
        focus = null;
        draw();
      });
      chartHead.append(all);
    }
    chartCard.append(chartHead);
    const chart = h('div', `chart${buckets.length > 14 ? ' dense' : ''}`);
    chart.style.setProperty('--n', String(buckets.length));
    const max = Math.max(1, ...buckets.map((b) => { const m = valueMix(b.stats); return m.metal + m.crystal + m.deuterium + m.ships; }));
    for (const b of buckets) {
      const m = valueMix(b.stats);
      const tot = m.metal + m.crystal + m.deuterium + m.ships;
      const col = h('button', `col${focus === b.start ? ' on' : ''}${b.stats.count ? '' : ' empty'}`);
      col.type = 'button';
      col.title = `${label(b, false)} · ${b.stats.count.toLocaleString(locale)} ${t('exp.heroCount')} · ${sign(b.stats.netMsu)} MSU`;
      col.setAttribute('aria-pressed', String(focus === b.start));
      // Net, as in the table below; the column's height is what was found.
      if (buckets.length <= 14) col.append(h('span', 'tot', b.stats.count ? sign(b.stats.netMsu) : ''));
      const stack = h('span', 'stack');
      stack.style.height = `${Math.round((tot / max) * 100)}%`;
      for (const k of ['metal', 'crystal', 'deuterium', 'ships'] as const) {
        if (!m[k]) continue;
        const seg = h('i');
        seg.style.height = `${(m[k] / tot) * 100}%`;
        seg.style.background = MIX_COLORS[k];
        stack.append(seg);
      }
      const area = h('span', 'area');
      area.append(stack);
      col.append(area, h('span', 'lbl', label(b, true)));
      col.addEventListener('click', () => {
        focus = focus === b.start ? null : b.start;
        draw();
      });
      chart.append(col);
    }
    chartCard.append(chart);
    out.push(chartCard);

    // Outcomes and ships: of the column picked, or of the whole period.
    const picked = focus !== null ? buckets.find((b) => b.start === focus)! : null;
    const fs = picked ? picked.stats : s;
    const suffix = picked ? ` · ${label(picked, false)}` : '';
    const two = h('div', 'two');
    const outs = h('div', 'card');
    outs.append(h('h3', '', `${t('exp.outcomes')}${suffix}`));
    const rows = ORDER.filter((k) => fs.outcomes[k]).sort((a, b) => (fs.outcomes[b] ?? 0) - (fs.outcomes[a] ?? 0));
    const total = rows.reduce((a, k) => a + (fs.outcomes[k] ?? 0), 0);
    const top1 = Math.max(1, ...rows.map((k) => fs.outcomes[k] ?? 0));
    if (!rows.length) outs.append(h('p', 'empty', t('exp.noneHere')));
    const list = h('div', 'outs');
    for (const k of rows) {
      const n = fs.outcomes[k] ?? 0;
      const track = h('span', 'track');
      const fill = h('i');
      fill.style.width = `${(n / top1) * 100}%`;
      fill.style.background = OUTCOME_COLORS[k] ?? '#5B6B80';
      track.append(fill);
      list.append(h('span', 'o-l', t(`msg.out.${k}`)), track, h('span', 'o-n', n.toLocaleString(locale)), h('span', 'o-p', (n / total).toLocaleString(locale, { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 })));
    }
    if (rows.length) outs.append(list);
    const sized = fs.sizes[0] + fs.sizes[1] + fs.sizes[2];
    if (sized) {
      const sizes = h('div', 'sizes');
      for (const i of [2, 1, 0] as const) {
        const sz = h('span', `sz rar-${i}`, `${t(`msg.size.${i}`)} `);
        sz.append(h('b', '', fs.sizes[i].toLocaleString(locale)));
        sizes.append(sz);
      }
      outs.append(sizes);
    }
    const shipsCard = h('div', 'card');
    shipsCard.append(h('h3', '', `${t('exp.shipsFound')}${suffix}`));
    const found = Object.entries(fs.shipsFound);
    const lost = Object.entries(fs.lost);
    if (found.length) shipsCard.append(shipGrid(found, false));
    else shipsCard.append(h('p', 'empty', t('exp.noneHere')));
    if (lost.length) {
      shipsCard.append(h('h4', 'lost', t('exp.lost')));
      shipsCard.append(shipGrid(lost, true));
    }
    two.append(outs, shipsCard);
    out.push(two);

    // The days, in a table (longer periods only: a single day is the chart above).
    if (!single) {
      const card = h('div', 'card');
      card.append(h('h3', '', t('exp.daysTable')));
      const scroll = h('div', 'scroll');
      const table = h('table');
      const hr = h('tr');
      const th = (content: string | HTMLElement, title = '') => {
        const c = h('th');
        c.append(content);
        if (title) c.title = title;
        hr.append(c);
      };
      th(t('exp.day'));
      th(t('exp.countShort'));
      th(svg(resIconSvg('metal', 13)), t('msg.res.metal'));
      th(svg(resIconSvg('crystal', 13)), t('msg.res.crystal'));
      th(svg(resIconSvg('deuterium', 13)), t('msg.res.deuterium'));
      th(svg(resIconSvg('darkMatter', 13)), t('msg.res.darkMatter'));
      th(svg(iconSvg('fleetValue', 13)), t('exp.shipsShort'));
      th('MSU');
      th('');
      table.append(hr);
      const days = byDay(entries, 31);
      const top = Math.max(1, ...days.map((d) => d.stats.netMsu));
      for (const { day, stats } of days) {
        const tr = h('tr');
        if (focus === day) tr.className = 'on';
        const spark = h('td', 'spark-cell');
        const sp = h('i', 'spark');
        sp.style.width = `${Math.max(0, (stats.netMsu / top) * 100)}%`;
        spark.append(sp);
        tr.append(
          h('td', '', new Date(day).toLocaleDateString(locale, { weekday: 'short', day: '2-digit', month: '2-digit' })),
          h('td', '', String(stats.count)),
          h('td', 'm', fmt(stats.res.metal)),
          h('td', 'c', fmt(stats.res.crystal)),
          h('td', 'd', fmt(stats.res.deuterium)),
          h('td', 'dm', fmt(stats.res.darkMatter)),
          h('td', 'pos', fmt(msu(stats.shipsValue) - msu(stats.lostValue))),
          h('td', stats.netMsu < 0 ? 'neg' : 'hi', fmt(stats.netMsu)),
          spark,
        );
        table.append(tr);
      }
      scroll.append(table);
      card.append(scroll);
      out.push(card);
    }
    return out;
  };

  const draw = () => {
    const journal = store.get<Journal>(JOURNAL_KEY, {});
    const inPeriod = entriesIn(journal, periodRange(period, o.now));
    const hasRaids = Object.values(journal).some((e) => e.kind === 'raid');
    if (kind === 'raid' && !hasRaids) kind = 'expedition';
    const entries = inPeriod.filter((e) => e.kind === kind);
    const s = periodStats(entries);
    const isDisc = kind === 'discovery';

    const head = h('div', 'head');
    const titles = h('div', 'titles');
    titles.append(h('h2', '', t('exp.title')), h('span', 'sub', t('exp.sub')));
    const close = h('button', 'close');
    close.append(icon(doc, 'close', 16));
    close.title = t('fleet.close');
    close.addEventListener('click', () => closeJournal(doc));
    head.append(titles, close);

    const tabs = h('div', 'tabs');
    for (const p of PERIODS) {
      const b = h('button', 'tab', t(`exp.period.${p}`));
      b.setAttribute('aria-pressed', String(p === period));
      b.addEventListener('click', () => {
        period = p;
        focus = null;
        store.set(PERIOD_KEY, p);
        draw();
      });
      tabs.append(b);
    }

    const kinds = h('div', 'tabs');
    for (const k of ['expedition', 'discovery', ...(hasRaids ? ['raid'] : [])] as Kind[]) {
      const n = periodStats(inPeriod.filter((e) => e.kind === k));
      const count = k === 'raid' ? raidStats(inPeriod).count : k === 'discovery' ? n.discoveries : n.count;
      const b = h('button', 'tab', `${t(`exp.kind.${k}`)} · ${count.toLocaleString(locale)}`);
      b.setAttribute('aria-pressed', String(k === kind));
      b.addEventListener('click', () => {
        kind = k;
        focus = null;
        store.set(KIND_KEY, k);
        draw();
      });
      kinds.append(b);
    }

    const parts: HTMLElement[] = [head, kinds, tabs];
    if (!entries.length) {
      parts.push(h('p', 'empty', Object.keys(journal).length ? t('exp.emptyPeriod') : t('exp.empty')));
    } else if (kind === 'expedition') {
      parts.push(...expeditionView(entries, s));
    } else {
      const kpis = h('div', 'kpis');
      const kpi = (label: string, value: string, cls = '', detail?: HTMLElement) => {
        const box = h('div', 'kpi');
        box.append(h('span', 'label', label), h('span', `value ${cls}`, value));
        if (detail) box.append(detail);
        kpis.append(box);
      };
      const triple = (r: { metal: number; crystal: number; deuterium: number }) => {
        const d = h('div', 'detail');
        d.append(h('span', 'm', fmt(r.metal)), h('span', 'c', fmt(r.crystal)), h('span', 'd', fmt(r.deuterium)));
        return d;
      };
      if (isDisc) {
        kpi(t('exp.kind.discovery'), s.discoveries.toLocaleString(locale));
        kpi(t('exp.artefacts'), s.artefacts.toLocaleString(locale), 'pos');
        kpi(t('exp.lfXp'), s.lfXp.toLocaleString(locale));
        kpi(t('exp.artefactsAvg'), s.discoveries ? (s.artefacts / s.discoveries).toLocaleString(locale, { maximumFractionDigits: 2 }) : '—');
      }
      if (kind !== 'raid') parts.push(kpis);

      // Outcomes: one bar, then each outcome with count and share.
      const outs = h('div', 'card');
      if (kind !== 'raid') outs.append(h('h3', '', t('exp.outcomes')));
      const total = Object.values(s.outcomes).reduce((a, b) => a + (b ?? 0), 0) || 1;
      const bar = h('div', 'bar');
      const legend = h('div', 'legend');
      for (const key of ORDER) {
        const n = s.outcomes[key];
        if (!n) continue;
        const seg = h('span');
        seg.style.width = `${(n / total) * 100}%`;
        seg.style.background = OUTCOME_COLORS[key] ?? '#5B6B80';
        seg.title = `${t(`msg.out.${key}`)}: ${n}`;
        bar.append(seg);
        const row = h('div');
        const dot = h('span', 'dot');
        dot.style.background = OUTCOME_COLORS[key] ?? '#5B6B80';
        row.append(dot, h('span', '', t(`msg.out.${key}`)), h('span', 'n', n.toLocaleString(locale)), h('span', 'pct', (n / total).toLocaleString(locale, { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 })));
        legend.append(row);
      }
      if (kind !== 'raid') outs.append(bar, legend);
      const sized = s.sizes[0] + s.sizes[1] + s.sizes[2];
      if (sized) {
        const sizes = h('div', 'detail');
        sizes.className = 'sizes';
        // Sizes in the rarity colours used in the inbox: normal common, big rare, huge epic.
        for (const i of [2, 1, 0] as const) sizes.append(h('span', `rar rar-${i}`, `${t(`msg.size.${i}`)} ${s.sizes[i].toLocaleString(locale)} (${(s.sizes[i] / sized).toLocaleString(locale, { style: 'percent', maximumFractionDigits: 0 })})`));
        outs.append(sizes);
      }
      if (kind !== 'raid') parts.push(outs);

      // Raids imported from OGLight: their own strip, they are not expeditions.
      const r = raidStats(entries);
      if (kind === 'raid') {
        const card = h('div', 'card');
        card.append(h('h3', '', t('exp.raids')));
        const strip = h('div', 'kpis');
        const cell = (label: string, value: string, cls = '', detail?: HTMLElement) => {
          const box = h('div', 'kpi');
          box.append(h('span', 'label', label), h('span', `value ${cls}`, value));
          if (detail) box.append(detail);
          strip.append(box);
        };
        cell(t('exp.raidCount'), r.count.toLocaleString(locale));
        cell(t('exp.raidLoot'), `${fmt(msu(r.res))} MSU`, '', triple(r.res));
        cell(t('exp.raidLost'), msu(r.lostValue) ? `−${fmt(msu(r.lostValue))} MSU` : '—', msu(r.lostValue) ? 'neg' : '');
        cell(t('exp.raidNet'), `${fmt(r.netMsu)} MSU`, r.netMsu < 0 ? 'neg' : 'pos');
        card.append(strip);
        parts.push(card);
      }

      // Day by day.
      const days = byDay(entries, 31);
      if (kind !== 'raid' && (days.length > 1 || period !== 'today')) {
        const card = h('div', 'card');
        card.append(h('h3', '', t('exp.byDay')));
        const scroll = h('div', 'scroll');
        const table = h('table');
        const hr = h('tr');
        const labels = isDisc ? [t('exp.day'), t('exp.countShort'), t('exp.artefacts'), t('exp.lfXp')] : [t('exp.day'), t('exp.countShort'), t('msg.res.metal'), t('msg.res.crystal'), t('msg.res.deuterium'), t('exp.dmShort'), t('exp.shipsShort'), 'MSU'];
        for (const label of labels) hr.append(h('th', '', label));
        table.append(hr);
        for (const { day, stats } of days) {
          const tr = h('tr');
          if (isDisc) {
            tr.append(
              h('td', '', new Date(day).toLocaleDateString(locale, { weekday: 'short', day: '2-digit', month: '2-digit' })),
              h('td', '', stats.discoveries.toLocaleString(locale)),
              h('td', 'pos', stats.artefacts.toLocaleString(locale)),
              h('td', '', stats.lfXp.toLocaleString(locale)),
            );
            table.append(tr);
            continue;
          }
          tr.append(
            h('td', '', new Date(day).toLocaleDateString(locale, { weekday: 'short', day: '2-digit', month: '2-digit' })),
            h('td', '', String(stats.count)),
            h('td', 'm', fmt(stats.res.metal)),
            h('td', 'c', fmt(stats.res.crystal)),
            h('td', 'd', fmt(stats.res.deuterium)),
            h('td', 'dm', fmt(stats.res.darkMatter)),
            h('td', 'pos', fmt(msu(stats.shipsValue) - msu(stats.lostValue))),
            h('td', stats.netMsu < 0 ? 'neg' : '', fmt(stats.netMsu)),
          );
          table.append(tr);
        }
        scroll.append(table);
        card.append(scroll);
        parts.push(card);
      }
    }

    // Options and data.
    const foot = h('div', 'foot');
    const opt = h('label', 'opt');
    const box = h('input');
    box.type = 'checkbox';
    box.checked = store.get<boolean>(FOLD_KEY, true);
    box.addEventListener('change', () => store.set(FOLD_KEY, box.checked));
    opt.append(box, document.createTextNode(t('exp.fold')));
    const acts = h('div', 'acts');
    const exp = h('button', 'act', t('exp.export'));
    exp.title = t('exp.exportHint');
    exp.addEventListener('click', () => {
      const blob = new Blob([JSON.stringify({ app: 'future', kind: 'expedition-journal', exportedAt: o.now, entries: journal }, null, 1)], { type: 'application/json' });
      const a = doc.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `future-spedizioni-${new Date(o.now).toISOString().slice(0, 10)}.json`;
      doc.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
    // Two clicks, no browser dialog: the first arms the button.
    const clear = h('button', confirmClear ? 'act danger' : 'act ghost', confirmClear ? t('exp.clearConfirm') : t('exp.clear'));
    clear.addEventListener('click', () => {
      if (!confirmClear) {
        confirmClear = true;
        draw();
        return;
      }
      confirmClear = false;
      store.set(JOURNAL_KEY, {});
      draw();
    });
    if (Object.keys(journal).length) acts.append(exp, clear);
    foot.append(opt, acts);
    parts.push(foot);

    panel.replaceChildren(...parts);
  };

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeJournal(doc);
  });
  keyHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') closeJournal(doc);
  };
  doc.addEventListener('keydown', keyHandler, true);
  draw();
}
