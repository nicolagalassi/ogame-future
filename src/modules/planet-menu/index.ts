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
import { formatUnits } from '../../core/format';
import { estimateResources, storageFill, totals } from '../../engines/resources';
import { MENU_WIDTH, NATIVE_WIDTH, PLANET_MENU_CSS } from './style';

export type MenuMode = 'side' | 'compact';

export interface MenuSettings {
  mode: MenuMode;
  showTotals: boolean;
}

export interface PlanetMenuOptions {
  doc: Document;
  entries: PlanetListEntry[];
  snapshot: AccountSnapshot | null;
  settings: MenuSettings;
  now: number;
  locale: string;
  t: (key: string, vars?: Record<string, string | number>) => string;
  onSettingsChange: (next: MenuSettings) => void;
  /** Runs the user-initiated sync. Only ever called from the Sync button's click. */
  onSync: () => Promise<void>;
}

const STYLE_ID = 'fut-planet-menu-style';
/** Settings panel open state survives redraws within the page. */
let panelOpen = false;

const ICONS = {
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

/** Removes everything Future added, so the menu can be redrawn without duplicates. */
export function clearPlanetMenu(doc: Document): void {
  doc
    .querySelectorAll('.fut-res, .fut-moon-label, .fut-menu-bar, .fut-toolbar, .fut-settings, .fut-totals, .fut-idle, .fut-nomoon, .fut-age')
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

function toolbar(o: PlanetMenuOptions, mode: MenuMode, roomy: boolean, colonies: string): HTMLElement {
  const { doc, t } = o;
  const bar = el(doc, 'div', 'fut-toolbar');
  const brand = el(doc, 'span', 'fut-brand', t('app.name'));
  if (colonies) brand.title = colonies;
  bar.append(brand);

  // View switch: changes Future's own display only, never a game action.
  const next: MenuMode = mode === 'side' ? 'compact' : 'side';
  const sw = iconButton(doc, next, t(next === 'side' ? 'planetMenu.toSide' : 'planetMenu.toCompact'), () =>
    o.onSettingsChange({ ...o.settings, mode: next }),
  );
  if (next === 'side' && !roomy) {
    sw.disabled = true;
    sw.title = t('planetMenu.noRoom');
  }

  const lastSync = o.snapshot ? t('toolbar.lastSync', { time: formatTime(o.snapshot.fetchedAt, o.locale) }) : '';
  const sync = iconButton(doc, 'sync', [t('sync.button'), lastSync].filter(Boolean).join(' · '), () => {
    if (sync.classList.contains('fut-busy')) return;
    sync.classList.add('fut-busy');
    o.onSync().finally(() => sync.classList.remove('fut-busy'));
  });

  const gear = iconButton(doc, 'settings', t('toolbar.settings'), () => {
    panelOpen = !panelOpen;
    gear.setAttribute('aria-expanded', String(panelOpen));
    doc.querySelector('.fut-settings')?.toggleAttribute('hidden', !panelOpen);
  });
  gear.setAttribute('aria-expanded', String(panelOpen));

  bar.append(sw, sync, gear);
  return bar;
}

function settingsPanel(o: PlanetMenuOptions, mode: MenuMode, roomy: boolean, colonies: string): HTMLElement {
  const { doc, t } = o;
  const panel = el(doc, 'div', 'fut-settings');
  panel.toggleAttribute('hidden', !panelOpen);

  const row = (label: string, ...controls: HTMLElement[]) => {
    const line = el(doc, 'div', 'fut-set-row');
    line.append(el(doc, 'span', 'fut-set-label', label), ...controls);
    panel.append(line);
  };
  const choice = (text: string, pressed: boolean, onClick: () => void, disabled = false) => {
    const b = el(doc, 'button', 'fut-chip', text);
    b.type = 'button';
    b.setAttribute('aria-pressed', String(pressed));
    b.disabled = disabled;
    b.addEventListener('click', onClick);
    return b;
  };

  row(
    t('settings.view'),
    choice(t('planetMenu.side'), mode === 'side', () => o.onSettingsChange({ ...o.settings, mode: 'side' }), !roomy),
    choice(t('planetMenu.compact'), mode === 'compact', () => o.onSettingsChange({ ...o.settings, mode: 'compact' })),
  );
  row(
    t('settings.totals'),
    choice(t('settings.on'), o.settings.showTotals, () => o.onSettingsChange({ ...o.settings, showTotals: true })),
    choice(t('settings.off'), !o.settings.showTotals, () => o.onSettingsChange({ ...o.settings, showTotals: false })),
  );
  if (colonies) panel.append(el(doc, 'div', 'fut-set-note', colonies));
  if (o.snapshot) panel.append(el(doc, 'div', 'fut-set-note', t('toolbar.lastSync', { time: formatTime(o.snapshot.fetchedAt, o.locale) })));
  return panel;
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
      // Queue: the game's construction icon stays as it is (its own link); a planet with
      // nothing in construction gets an amber dot.
      if (entry.construction.planet) entry.element.classList.add('fut-building');
      else {
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
    } else {
      // Keeps the planet columns aligned on planets without a moon.
      link?.after(el(doc, 'span', 'fut-nomoon'));
    }
    entry.element.querySelectorAll<HTMLImageElement>('img.planetPic, img.icon-moon').forEach(guardSkin);
  }

  startAgeClock(doc);
  const colonies = (doc.getElementById('countColonies')?.textContent ?? '').replace(/\s+/g, ' ').trim();
  list.before(toolbar(o, mode, roomy, colonies), settingsPanel(o, mode, roomy, colonies));

  if (o.snapshot && o.settings.showTotals) {
    const { stock, perHour } = totals(o.snapshot, o.now);
    const msu = (r: { metal: number; crystal: number; deuterium: number }) => r.metal + r.crystal * 1.5 + r.deuterium * 3;
    const box = el(doc, 'div', 'fut-totals');
    const line = (label: string, value: number, rate: number, cls: string) => {
      box.append(el(doc, 'span', cls, `${label} ${formatUnits(value, o.locale)}`));
      box.append(el(doc, 'span', 'fut-rate', `+${formatUnits(rate, o.locale)}/h`));
    };
    line(o.t('res.metal'), stock.metal, perHour.metal, 'fut-m');
    line(o.t('res.crystal'), stock.crystal, perHour.crystal, 'fut-c');
    line(o.t('res.deuterium'), stock.deuterium, perHour.deuterium, 'fut-d');
    line('MSU', msu(stock), msu(perHour), 'fut-msu');
    list.after(box);
  }
}
