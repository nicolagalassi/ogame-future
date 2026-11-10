/**
 * Planet menu: decorates the game's own planet list.
 * - "Affiancato" (side): planet and moon side by side on one row, resources in a column.
 *   Planet: the game's planet image behind name and coords, storage fill behind each number.
 *   Moon: the game's moon link as its own click target, with its resources (no storage).
 * - "Compatto": one row per planet at the game's width, moon as a square button.
 * - Future's toolbar replaces the colony counter at the top: view switch, sync, settings.
 * Pure DOM work on data already loaded: the only network call is the Sync button,
 * which runs from a real click (see core/guard.ts).
 */
import type { AccountSnapshot, OwnBody } from '../../data/account-info';
import type { PlanetListEntry } from '../../data/planet-list';
import { activeItems, queueLabel, type QueueItem, type QueueSnapshot } from '../../data/queues';
import { formatUnits } from '../../core/format';
import { estimateResources, storageFill, totals } from '../../engines/resources';
import { MENU_WIDTH, NATIVE_WIDTH, PLANET_MENU_CSS } from './style';

export type MenuMode = 'side' | 'compact';

export interface MenuSettings {
  mode: MenuMode;
  showTotals: boolean;
  /** Amber dot on planets with nothing under construction. */
  markIdle: boolean;
}

export interface PlanetMenuOptions {
  doc: Document;
  entries: PlanetListEntry[];
  snapshot: AccountSnapshot | null;
  /** Production queues per body (null when never read). */
  queues?: QueueSnapshot | null;
  settings: MenuSettings;
  now: number;
  locale: string;
  t: (key: string, vars?: Record<string, string | number>) => string;
  /** Opens the settings window; `roomy` says whether the side-by-side view fits the screen. */
  onOpenSettings?: (ctx: { roomy: boolean; colonies: string }) => void;
  /** Runs the user-initiated sync. Only ever called from the Sync button's click. */
  onSync: () => Promise<boolean>;
  /** Opens the account dashboard (Future's own panel, no game action). */
  onOpenDashboard?: () => void;
  /** Opens or closes the targets side bar; `targetsCount` players and planets are marked. */
  onOpenTargets?: () => void;
  targetsCount?: number;
  /** Opens the construction plan; `planCount` items are planned in total. */
  onOpenPlanner?: () => void;
  planCount?: number;
  /** Opens the expedition journal. */
  onOpenJournal?: () => void;
  /** What the plan still misses in MSU (null when no stock is known for its bodies). */
  planGap?: number | null;
  /** Expeditions read today: how many and the net value in MSU. */
  journalToday?: { count: number; net: number } | null;
}

const STYLE_ID = 'fut-planet-menu-style';

const ICONS = {
  journal: '<path d="M5 3.5h11a3 3 0 0 1 3 3V20.5H8a3 3 0 0 1-3-3z" fill="none" stroke-width="2"/><path d="M5 17.5a3 3 0 0 1 3-3h11" fill="none" stroke-width="2"/><path stroke="none" d="M9.5 6.5l1 2.2 2.3.3-1.7 1.6.4 2.3-2-1.1-2 1.1.4-2.3L6.2 9l2.3-.3z"/>',
  planner: '<path d="M9 6h11M9 12h11M9 18h11" fill="none" stroke-width="2.2"/><path stroke="none" d="M3 4.5h3v3H3zM3 10.5h3v3H3zM3 16.5h3v3H3z"/>',
  dashboard: '<path stroke="none" d="M3 3h8v10H3zM13 3h8v6h-8zM13 11h8v10h-8zM3 15h8v6H3z"/>',
  side: '<path stroke="none" d="M2 5h12v14H2zM16 5h6v14h-6z"/>',
  compact: '<path stroke="none" d="M3 4h18v3H3zM3 10.5h18v3H3zM3 17h18v3H3z"/>',
  sync: '<path d="M20 12a8 8 0 0 1-14.3 4.9M4 12a8 8 0 0 1 14.3-4.9" fill="none" stroke-width="2.2"/><path d="M19 3v5h-5M5 21v-5h5" fill="none" stroke-width="2.2"/>',
  settings:
    '<path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z" fill="none" stroke-width="2.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" fill="none" stroke-width="2.2"/>',
};

function el<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, className: string, text?: string) {
  const node = doc.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function iconButton(doc: Document, icon: keyof typeof ICONS, title: string, onClick: () => void): HTMLButtonElement {
  const button = el(doc, 'button', `fut-tool fut-tool-${icon}`);
  button.type = 'button';
  button.title = title;
  button.setAttribute('aria-label', title);
  button.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="currentColor" stroke="currentColor">${ICONS[icon]}</svg>`;
  button.addEventListener('click', (event) => {
    event.preventDefault();
    onClick();
  });
  return button;
}

/** Resources in one column. Planets get their storage fill painted behind each number. */
function resourceColumn(doc: Document, body: OwnBody | undefined, now: number, locale: string, withStorage: boolean): HTMLElement {
  const box = el(doc, 'span', 'fut-res');
  if (!body) {
    for (const cls of ['fut-m', 'fut-c', 'fut-d']) box.append(el(doc, 'span', `fut-cell ${cls} fut-missing`, '—'));
    return box;
  }
  const amount = estimateResources(body, now);
  const fill = withStorage ? storageFill(body, amount) : null;
  const cell = (key: 'metal' | 'crystal' | 'deuterium', cls: string) => {
    const full = fill !== null && fill[key] >= 0.9;
    const node = el(doc, 'span', full ? `fut-cell ${cls} fut-full` : `fut-cell ${cls}`, formatUnits(amount[key], locale));
    if (fill !== null) {
      const pct = Math.round(fill[key] * 100);
      node.style.setProperty('--fut-fill', `${pct}%`);
      node.classList.add('fut-has-fill');
      node.title = `${pct}%`;
    }
    box.append(node);
  };
  cell('metal', 'fut-m');
  cell('crystal', 'fut-c');
  cell('deuterium', 'fut-d');
  return box;
}

/**
 * The game's CDN sometimes answers 502 and the skin vanishes. Fall back once to the
 * image's own 1x address (data-default-src, from the game markup); if that fails too,
 * draw a plain sphere so the row keeps its shape.
 */
export function guardSkin(img: HTMLImageElement): void {
  if (img.dataset.futSkin) return;
  img.dataset.futSkin = '1';
  const fail = () => {
    const fallback = img.dataset.defaultSrc;
    if (fallback && img.dataset.futSkin === '1' && img.getAttribute('src') !== fallback) {
      img.dataset.futSkin = 'retry';
      img.src = fallback;
      return;
    }
    img.classList.add('fut-noskin');
  };
  img.addEventListener('error', fail);
  img.addEventListener('load', () => img.classList.remove('fut-noskin'));
  if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) fail();
}

/** Age badge text and colour class, like OGLight's timers (minutes up to an hour, then hours/days). */
export function dataAge(resourcesAt: number, now: number): { text: string; cls: string } {
  const minutes = Math.max(0, Math.floor((now - resourcesAt) / 60_000));
  const cls = minutes < 15 ? 'fut-age-fresh' : minutes <= 30 ? 'fut-age-warm' : 'fut-age-old';
  const text = minutes < 60 ? String(minutes) : minutes < 1440 ? `${Math.floor(minutes / 60)}h` : `${Math.floor(minutes / 1440)}d`;
  return { text, cls };
}

function ageBadge(doc: Document, body: OwnBody | undefined, now: number, t: PlanetMenuOptions['t']): HTMLElement | null {
  if (!body || !body.resourcesAt) return null;
  const { text, cls } = dataAge(body.resourcesAt, now);
  const badge = el(doc, 'span', `fut-age ${cls}`, text);
  badge.dataset.at = String(body.resourcesAt);
  badge.title = t('planetMenu.age');
  return badge;
}

/**
 * Refreshes the age badges once a minute. Display only: it reads the clock and rewrites
 * text already on the page, with no network call and no game action.
 */
let ageTimer: ReturnType<typeof setInterval> | null = null;
function startAgeClock(doc: Document): void {
  if (ageTimer !== null) return;
  ageTimer = setInterval(() => {
    doc.querySelectorAll<HTMLElement>('.fut-age').forEach((badge) => {
      const { text, cls } = dataAge(Number(badge.dataset.at), Date.now());
      badge.textContent = text;
      badge.className = `fut-age ${cls}`;
    });
  }, 60_000);
}

export function remaining(end: number, now: number): string {
  const min = Math.max(0, Math.round((end - now) / 60_000));
  if (min < 60) return `${min}m`;
  const hours = Math.floor(min / 60);
  return hours < 48 ? `${hours}h ${String(min % 60).padStart(2, '0')}m` : `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

/** Coloured stripes, one per running queue kind (as OGLight), with the details in the tooltip. */
function queueStripes(doc: Document, items: QueueItem[], now: number, t: PlanetMenuOptions['t'], locale: string): HTMLElement | null {
  if (!items.length) return null;
  const box = el(doc, 'span', 'fut-queue');
  box.title = items
    .map((i) => `${t(`queue.${i.kind}`)}: ${queueLabel(i, locale)} · ${remaining(i.end, now)}`)
    .join('\n');
  for (const i of items) box.append(el(doc, 'span', `fut-q fut-q-${i.kind}`));
  return box;
}

/** Removes everything Future added, so the menu can be redrawn without duplicates. */
export function clearPlanetMenu(doc: Document): void {
  doc
    .querySelectorAll('.fut-res, .fut-moon-label, .fut-menu-bar, .fut-toolbar, .fut-settings, .fut-totals, .fut-idle, .fut-nomoon, .fut-age, .fut-queue')
    .forEach((n) => n.remove());
  doc.querySelectorAll('.fut-name').forEach((wrap) => wrap.replaceWith(...Array.from(wrap.childNodes)));
  doc.querySelectorAll('.fut-row').forEach((n) => n.classList.remove('fut-row', 'fut-current', 'fut-building'));
}

/**
 * Widens the planet column only when the shifted banner still fits on screen,
 * so the banner is never pushed out of view (AGENTS.md §1.7). Otherwise the menu
 * stays in the game's own width and switches to compact.
 */
export function canWiden(doc: Document): boolean {
  const banner = doc.getElementById('bannerskyscrapercomponent');
  const view = doc.documentElement.clientWidth;
  if (!banner) return true;
  const rect = banner.getBoundingClientRect();
  const shifted = rect.right + (MENU_WIDTH - NATIVE_WIDTH + 8);
  return rect.width === 0 || shifted <= view;
}

function formatTime(at: number, locale: string): string {
  return new Date(at).toLocaleString(locale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/**
 * Toolbar: four buttons in two rows that already say something (production, what the plan misses,
 * today's expeditions, marked targets) and open their window; sync and settings stacked on the right.
 * The view switch lives in the settings panel: it is a preference, not an action.
 */
function toolbar(o: PlanetMenuOptions, colonies: string, roomy: boolean): HTMLElement {
  const { doc, t } = o;
  const bar = el(doc, 'div', 'fut-toolbar');
  if (colonies) bar.title = colonies;
  const fmt = (n: number) => formatUnits(n, o.locale);
  const msu = (r: { metal: number; crystal: number; deuterium: number }) => r.metal + r.crystal * 1.5 + r.deuterium * 3;

  const cell = (label: string, value: string, cls: string, title: string, onClick?: () => void) => {
    const b = el(doc, 'button', 'fut-cell');
    b.type = 'button';
    b.title = title;
    b.append(el(doc, 'span', 'fut-cell-k', label), el(doc, 'span', `fut-cell-v ${cls}`.trim(), value));
    if (onClick) b.addEventListener('click', onClick);
    else b.disabled = true;
    bar.append(b);
  };

  const perDay = o.snapshot ? msu(totals(o.snapshot, o.now).perHour) * 24 : null;
  cell(t('bar.dash'), perDay === null ? '—' : `+${fmt(perDay)}${t('bar.perDay')}`, '', `${t('dash.title')}${perDay === null ? '' : ` · ${t('bar.dashHint')}`}`, o.onOpenDashboard);

  const count = o.planCount ?? 0;
  const gap = o.planGap;
  const planValue = !count ? '—' : gap === null || gap === undefined ? '?' : gap > 0 ? `−${fmt(gap)}` : t('bar.ready');
  const planCls = !count || gap === null || gap === undefined ? '' : gap > 0 ? 'fut-warn' : 'fut-ok';
  cell(count ? t('bar.plan', { n: count > 99 ? '99+' : count }) : t('bar.planEmpty'), planValue, planCls, `${t('plan.title')} · ${count && gap ? t('bar.planHint') : t('plan.title')}`, o.onOpenPlanner);

  const today = o.journalToday;
  cell(
    t('bar.journal'),
    today && today.count ? `${today.net >= 0 ? '+' : '−'}${fmt(Math.abs(today.net))}` : '—',
    today && today.count ? (today.net >= 0 ? 'fut-ok' : 'fut-warn') : '',
    today && today.count ? `${t('exp.title')} · ${t('bar.journalHint', { n: today.count })}` : t('exp.title'),
    o.onOpenJournal,
  );

  const marked = o.targetsCount ?? 0;
  cell(t('bar.targets'), marked ? String(marked) : '—', '', t('bar.targetsHint'), o.onOpenTargets);

  const side = el(doc, 'div', 'fut-side');
  const lastSync = o.snapshot ? t('toolbar.lastSync', { time: formatTime(o.snapshot.fetchedAt, o.locale) }) : '';
  const sync = iconButton(doc, 'sync', [t('sync.button'), lastSync].filter(Boolean).join(' · '), () => {
    if (sync.classList.contains('fut-busy')) return;
    sync.classList.add('fut-busy');
    sync.classList.remove('fut-failed');
    o.onSync()
      .then((ok) => {
        // On success the menu is redrawn; on failure this button stays and says so.
        if (ok) return;
        sync.classList.add('fut-failed');
        sync.title = t('sync.failed');
      })
      .finally(() => sync.classList.remove('fut-busy'));
  });
  // Data older than an hour: the sync button says so.
  if (!o.snapshot || o.now - o.snapshot.fetchedAt > 3_600_000) sync.classList.add('fut-stale');
  const gear = iconButton(doc, 'settings', t('toolbar.settings'), () => o.onOpenSettings?.({ roomy, colonies }));
  gear.setAttribute('aria-haspopup', 'dialog');
  side.append(sync, gear);
  bar.append(side);
  return bar;
}


/**
 * The game reloads the whole planet bar on its own (`reloadComponent('planetbar')`, from its
 * websocket when a construction ends or a fleet event arrives), wiping Future's menu. Watch the
 * bar and redraw when the toolbar is gone. Page only: no network call, no game action.
 */
export function watchPlanetBar(doc: Document, redraw: () => void): void {
  const bar = doc.getElementById('planetbarcomponent');
  const view = doc.defaultView;
  if (!bar || !view) return;
  let queued = false;
  new view.MutationObserver(() => {
    if (queued || bar.querySelector('.fut-toolbar') || !doc.getElementById('planetList')) return;
    queued = true;
    // After the game has finished filling the bar in.
    view.setTimeout(() => {
      queued = false;
      if (!bar.querySelector('.fut-toolbar') && doc.getElementById('planetList')) redraw();
    }, 0);
  }).observe(bar, { childList: true, subtree: true });
}

export function renderPlanetMenu(o: PlanetMenuOptions): void {
  const { doc } = o;
  const list = doc.getElementById('planetList');
  if (!list) return;

  if (!doc.getElementById(STYLE_ID)) {
    const style = el(doc, 'style', '');
    style.id = STYLE_ID;
    style.textContent = PLANET_MENU_CSS;
    doc.head.append(style);
  }

  clearPlanetMenu(doc);
  const roomy = canWiden(doc);
  const mode: MenuMode = roomy ? o.settings.mode : 'compact';
  // Only the side-by-side menu needs the extra width (and the banner shift).
  const wide = mode === 'side';
  doc.getElementById('planetbarcomponent')?.classList.toggle('fut-wide', wide);
  doc.body.classList.toggle('fut-banner-shift', wide);
  doc.body.classList.add('fut-on');
  list.classList.add('fut-menu');
  list.classList.toggle('fut-mode-compact', mode === 'compact');
  list.classList.toggle('fut-mode-side', mode === 'side');

  const byId = new Map((o.snapshot?.bodies ?? []).map((b) => [b.id, b]));

  for (const entry of o.entries) {
    entry.element.classList.add('fut-row');
    if (entry.current) entry.element.classList.add('fut-current');

    const link = entry.planetLink;
    if (link) {
      const wrap = el(doc, 'span', 'fut-name');
      link.querySelectorAll('.planet-name, .planet-koords').forEach((n) => wrap.append(n));
      const planetBody = entry.planetId ? byId.get(entry.planetId) : undefined;
      link.append(wrap, resourceColumn(doc, planetBody, o.now, o.locale, true));
      const age = ageBadge(doc, planetBody, o.now, o.t);
      if (age) link.append(age);
      const pq = entry.planetId ? queueStripes(doc, activeItems(o.queues?.bodies[String(entry.planetId)], o.now), o.now, o.t, o.locale) : null;
      if (pq) wrap.append(pq);
      // Queue: the game's construction icon stays as it is (its own link); a planet with
      // nothing in construction gets an amber dot.
      if (entry.construction.planet) entry.element.classList.add('fut-building');
      else if (o.settings.markIdle) {
        const idle = el(doc, 'span', 'fut-idle');
        idle.title = o.t('planetMenu.idle');
        link.append(idle);
      }
    }

    const moon = entry.moonLink;
    if (moon) {
      const moonBody = entry.moonId ? byId.get(entry.moonId) : undefined;
      moon.append(resourceColumn(doc, moonBody, o.now, o.locale, false));
      const age = ageBadge(doc, moonBody, o.now, o.t);
      if (age) moon.append(age);
      const mq = entry.moonId ? queueStripes(doc, activeItems(o.queues?.bodies[String(entry.moonId)], o.now), o.now, o.t, o.locale) : null;
      if (mq) moon.append(mq);
    } else {
      // Keeps the planet columns aligned on planets without a moon.
      link?.after(el(doc, 'span', 'fut-nomoon'));
    }
    entry.element.querySelectorAll<HTMLImageElement>('img.planetPic, img.icon-moon').forEach(guardSkin);
  }

  startAgeClock(doc);
  const colonies = (doc.getElementById('countColonies')?.textContent ?? '').replace(/\s+/g, ' ').trim();
  list.before(toolbar(o, colonies, roomy));

  if (o.snapshot && o.settings.showTotals) {
    const { stock, perHour } = totals(o.snapshot, o.now);
    const msu = (r: { metal: number; crystal: number; deuterium: number }) => r.metal + r.crystal * 1.5 + r.deuterium * 3;
    const box = el(doc, 'div', 'fut-totals');
    const line = (label: string, value: number, rate: number, cls: string) => {
      box.append(el(doc, 'span', cls, `${label} ${formatUnits(value, o.locale)}`));
      box.append(el(doc, 'span', 'fut-rate', `+${formatUnits(rate * 24, o.locale)}/24h`));
    };
    line(o.t('res.metal'), stock.metal, perHour.metal, 'fut-m');
    line(o.t('res.crystal'), stock.crystal, perHour.crystal, 'fut-c');
    line(o.t('res.deuterium'), stock.deuterium, perHour.deuterium, 'fut-d');
    line('MSU', msu(stock), msu(perHour), 'fut-msu');
    list.after(box);
  }
}
