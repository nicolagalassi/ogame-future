/**
 * Expedition journal window: what expeditions brought per period, outcomes, ships found and
 * lost, day by day. Shadow DOM, like the planner. Stored data only: no network, no game action.
 */
import type { Store } from '../../core/storage';
import { formatUnits } from '../../core/format';
import { SHIPS_INFO_KEY, type ShipsInfo } from '../../data/fleet-dispatcher';
import type { Outcome } from '../../data/messages';
import { byDay, entriesIn, JOURNAL_KEY, msu, periodRange, periodStats, type Journal, type Period } from '../../engines/expeditions';
import { FOLD_KEY, shipName, type T } from './index';
import { JOURNAL_CSS, OUTCOME_COLORS } from './style';

export const JOURNAL_ID = 'fut-journal';
const PERIOD_KEY = 'exp.period';
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
  style.textContent = JOURNAL_CSS;
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

  const draw = () => {
    const journal = store.get<Journal>(JOURNAL_KEY, {});
    const entries = entriesIn(journal, periodRange(period, o.now));
    const s = periodStats(entries);

    const head = h('div', 'head');
    const titles = h('div', 'titles');
    titles.append(h('h2', '', t('exp.title')), h('span', 'sub', t('exp.sub')));
    const close = h('button', 'close', '×');
    close.title = t('fleet.close');
    close.addEventListener('click', () => closeJournal(doc));
    head.append(titles, close);

    const tabs = h('div', 'tabs');
    for (const p of PERIODS) {
      const b = h('button', 'tab', t(`exp.period.${p}`));
      b.setAttribute('aria-pressed', String(p === period));
      b.addEventListener('click', () => {
        period = p;
        store.set(PERIOD_KEY, p);
        draw();
      });
      tabs.append(b);
    }

    const parts: HTMLElement[] = [head, tabs];
    if (!entries.length) {
      parts.push(h('p', 'empty', Object.keys(journal).length ? t('exp.emptyPeriod') : t('exp.empty')));
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
      const countDetail = h('div', 'detail');
      if (s.discoveries) countDetail.append(h('span', '', t('exp.discoveries', { n: s.discoveries })));
      kpi(t('exp.count'), s.count.toLocaleString(locale), '', countDetail);
      kpi(t('exp.resources'), `${fmt(msu(s.res))} MSU`, '', triple(s.res));
      kpi(t('exp.dm'), fmt(s.res.darkMatter), 'dm');
      kpi(t('exp.shipsFound'), `${fmt(msu(s.shipsValue))} MSU`, 'pos', triple(s.shipsValue));
      kpi(t('exp.lost'), msu(s.lostValue) ? `−${fmt(msu(s.lostValue))} MSU` : '—', msu(s.lostValue) ? 'neg' : '', msu(s.lostValue) ? triple(s.lostValue) : undefined);
      kpi(t('exp.net'), `${fmt(s.netMsu)} MSU`, s.netMsu < 0 ? 'neg' : 'pos');
      kpi(t('exp.average'), s.count ? `${fmt(s.netMsu / s.count)} MSU` : '—');
      if (s.lfXp || s.artefacts) {
        const d = h('div', 'detail');
        if (s.artefacts) d.append(h('span', '', t('msg.artefacts', { n: s.artefacts.toLocaleString(locale) })));
        kpi(t('exp.lfXp'), s.lfXp.toLocaleString(locale), '', d);
      }
      parts.push(kpis);

      // Outcomes: one bar, then each outcome with count and share.
      const outs = h('div', 'card');
      outs.append(h('h3', '', t('exp.outcomes')));
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
        row.append(dot, h('span', '', t(`msg.out.${key}`)), h('span', 'n', n.toLocaleString(locale)), h('span', 'pct', `${((n / total) * 100).toFixed(1)}%`));
        legend.append(row);
      }
      outs.append(bar, legend);
      const sized = s.sizes[0] + s.sizes[1] + s.sizes[2];
      if (sized) {
        const sizes = h('div', 'detail');
        sizes.style.cssText = 'display:flex;gap:12px;margin-top:8px;color:#8A9BB0;font-size:12px';
        for (const i of [2, 1, 0] as const) sizes.append(h('span', '', `${t(`msg.size.${i}`)} ${s.sizes[i].toLocaleString(locale)} (${((s.sizes[i] / sized) * 100).toFixed(0)}%)`));
        outs.append(sizes);
      }
      parts.push(outs);

      // Ships found and lost.
      const found = Object.entries(s.shipsFound);
      const lost = Object.entries(s.lost);
      if (found.length || lost.length) {
        const card = h('div', 'card');
        card.append(h('h3', '', t('exp.ships')));
        const list = h('div', 'ships');
        for (const [id, n] of found) {
          const sp = h('span', 'pos');
          sp.append(h('b', '', `+${n.toLocaleString(locale)}`), document.createTextNode(` ${shipName(Number(id), ships, t)}`));
          list.append(sp);
        }
        for (const [id, n] of lost) {
          const sp = h('span', 'neg');
          sp.append(h('b', '', `−${n.toLocaleString(locale)}`), document.createTextNode(` ${shipName(Number(id), ships, t)}`));
          list.append(sp);
        }
        card.append(list);
        parts.push(card);
      }

      // Day by day.
      const days = byDay(entries, 31);
      if (days.length > 1 || period !== 'today') {
        const card = h('div', 'card');
        card.append(h('h3', '', t('exp.byDay')));
        const scroll = h('div', 'scroll');
        const table = h('table');
        const hr = h('tr');
        for (const label of [t('exp.day'), t('exp.countShort'), t('msg.res.metal'), t('msg.res.crystal'), t('msg.res.deuterium'), t('exp.dmShort'), t('exp.shipsShort'), 'MSU'])
          hr.append(h('th', '', label));
        table.append(hr);
        for (const { day, stats } of days) {
          const tr = h('tr');
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
