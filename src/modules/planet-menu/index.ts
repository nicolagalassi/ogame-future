/**
 * Planet menu ("impilato"): decorates the game's own planet list.
 * - Planet row: the game's planet image behind name and coords, then metal/crystal/deuterium.
 * - Moon row: the game's moon link, restyled as its own full-width click target.
 * - Compact mode: one row per planet, moon as a square button.
 * Pure DOM work on data already loaded: it makes no network call and sends no game action.
 */
import type { AccountSnapshot, OwnBody } from '../../data/account-info';
import type { PlanetListEntry } from '../../data/planet-list';
import { formatUnits } from '../../core/format';
import { estimateResources, storageFill, totals } from '../../engines/resources';
import { MENU_WIDTH, NATIVE_WIDTH, PLANET_MENU_CSS } from './style';

export type MenuMode = 'stacked' | 'compact';

export interface PlanetMenuOptions {
  doc: Document;
  entries: PlanetListEntry[];
  snapshot: AccountSnapshot | null;
  mode: MenuMode;
  now: number;
  locale: string;
  t: (key: string) => string;
  onModeChange: (mode: MenuMode) => void;
}

const STYLE_ID = 'fut-planet-menu-style';

function el<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, className: string, text?: string) {
  const node = doc.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function resourceCells(doc: Document, body: OwnBody | undefined, now: number, locale: string): HTMLElement {
  const box = el(doc, 'span', 'fut-res');
  if (!body) {
    for (const cls of ['fut-m', 'fut-c', 'fut-d']) box.append(el(doc, 'span', `fut-cell ${cls} fut-missing`, '—'));
    return box;
  }
  const amount = estimateResources(body, now);
  const fill = storageFill(body, amount);
  const cell = (key: 'metal' | 'crystal' | 'deuterium', cls: string) => {
    const full = fill !== null && fill[key] >= 0.9;
    const wrap = el(doc, 'span', full ? `fut-cell ${cls} fut-full` : `fut-cell ${cls}`);
    wrap.append(el(doc, 'span', 'fut-num', formatUnits(amount[key], locale)));
    if (fill !== null) {
      // Storage fill bar: how full this deposit is (amber from 90%).
      const bar = el(doc, 'span', 'fut-bar');
      const level = el(doc, 'span', 'fut-bar-fill');
      level.style.width = `${Math.round(fill[key] * 100)}%`;
      bar.append(level);
      wrap.append(bar);
      wrap.title = `${Math.round(fill[key] * 100)}%`;
    }
    box.append(wrap);
  };
  cell('metal', 'fut-m');
  cell('crystal', 'fut-c');
  cell('deuterium', 'fut-d');
  return box;
}

/** Removes everything Future added, so the menu can be redrawn without duplicates. */
export function clearPlanetMenu(doc: Document): void {
  doc.querySelectorAll('.fut-res, .fut-moon-label, .fut-menu-bar, .fut-totals, .fut-idle').forEach((n) => n.remove());
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
  const mode: MenuMode = roomy ? o.mode : 'compact';
  // Only the stacked menu needs the extra width (and the banner shift).
  const wide = mode === 'stacked';
  doc.getElementById('planetbarcomponent')?.classList.toggle('fut-wide', wide);
  doc.body.classList.toggle('fut-banner-shift', wide);
  list.classList.add('fut-menu');
  list.classList.toggle('fut-mode-compact', mode === 'compact');

  const byId = new Map((o.snapshot?.bodies ?? []).map((b) => [b.id, b]));

  for (const entry of o.entries) {
    entry.element.classList.add('fut-row');
    if (entry.current) entry.element.classList.add('fut-current');

    const link = entry.planetLink;
    if (link) {
      const wrap = el(doc, 'span', 'fut-name');
      link.querySelectorAll('.planet-name, .planet-koords').forEach((n) => wrap.append(n));
      link.append(wrap, resourceCells(doc, entry.planetId ? byId.get(entry.planetId) : undefined, o.now, o.locale));
      // Queue: the game's construction icon stays as it is (its own link); a planet with
      // nothing in construction gets an amber dot, as in the mock-up.
      if (entry.construction.planet) entry.element.classList.add('fut-building');
      else {
        const idle = el(doc, 'span', 'fut-idle');
        idle.title = o.t('planetMenu.idle');
        link.append(idle);
      }
    }

    const moon = entry.moonLink;
    if (moon) {
      moon.append(
        el(doc, 'span', 'fut-moon-label', o.t('planetMenu.moon')),
        resourceCells(doc, entry.moonId ? byId.get(entry.moonId) : undefined, o.now, o.locale),
      );
    }
  }

  // Mode switch: changes Future's own display only, never a game action.
  const bar = el(doc, 'div', 'fut-menu-bar');
  const current = mode;
  for (const mode of ['stacked', 'compact'] as const) {
    const button = el(doc, 'button', '', o.t(`planetMenu.${mode}`));
    button.type = 'button';
    button.setAttribute('aria-pressed', String(mode === current));
    button.disabled = !roomy && mode === 'stacked';
    button.addEventListener('click', () => o.onModeChange(mode));
    bar.append(button);
  }
  list.before(bar);

  if (o.snapshot) {
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
