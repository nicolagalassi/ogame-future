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
import { PLANET_MENU_CSS } from './style';

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
    for (const cls of ['fut-m', 'fut-c', 'fut-d']) box.append(el(doc, 'span', `${cls} fut-missing`, '—'));
    return box;
  }
  const amount = estimateResources(body, now);
  const fill = storageFill(body, amount);
  const cell = (key: 'metal' | 'crystal' | 'deuterium', cls: string) => {
    const full = fill !== null && fill[key] >= 0.9;
    box.append(el(doc, 'span', full ? `${cls} fut-full` : cls, formatUnits(amount[key], locale)));
  };
  cell('metal', 'fut-m');
  cell('crystal', 'fut-c');
  cell('deuterium', 'fut-d');
  return box;
}

/** Removes everything Future added, so the menu can be redrawn without duplicates. */
export function clearPlanetMenu(doc: Document): void {
  doc.querySelectorAll('.fut-res, .fut-moon-label, .fut-menu-bar, .fut-totals').forEach((n) => n.remove());
  doc.querySelectorAll('.fut-name').forEach((wrap) => wrap.replaceWith(...Array.from(wrap.childNodes)));
  doc.querySelectorAll('.fut-row').forEach((n) => n.classList.remove('fut-row', 'fut-current'));
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
  list.classList.add('fut-menu');
  list.classList.toggle('fut-mode-compact', o.mode === 'compact');

  const byId = new Map((o.snapshot?.bodies ?? []).map((b) => [b.id, b]));

  for (const entry of o.entries) {
    entry.element.classList.add('fut-row');
    if (entry.current) entry.element.classList.add('fut-current');

    const link = entry.planetLink;
    if (link) {
      const wrap = el(doc, 'span', 'fut-name');
      link.querySelectorAll('.planet-name, .planet-koords').forEach((n) => wrap.append(n));
      link.append(wrap, resourceCells(doc, entry.planetId ? byId.get(entry.planetId) : undefined, o.now, o.locale));
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
  for (const mode of ['stacked', 'compact'] as const) {
    const button = el(doc, 'button', '', o.t(`planetMenu.${mode}`));
    button.type = 'button';
    button.setAttribute('aria-pressed', String(o.mode === mode));
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
