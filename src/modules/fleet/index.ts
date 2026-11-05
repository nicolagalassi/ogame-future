/**
 * Future's tools on the game's fleet page.
 *
 * Page 1 bar, one button per kind of send, each preparing the whole form (ships, target,
 * mission, speed, cargo) on the game's own fleetDispatcher, as OGLight does:
 * - Luna: empties the planet onto its moon with the main cargo ship (second ship for the rest).
 * - Trasporto / Schiera: towards a chosen own planet or moon, with a favourite per button.
 * - Spedizione: best ship and expedition cargo, position 16 of this system.
 * - Fleetsave: the per-body profile (empty galaxy/system = this body's, as in PrOGect).
 * - Tutte − riserva: every ship minus the reserve.
 * Reserves (ships and resources to keep) are per body and copied planet→planets, moon→moons.
 * "Ripeti" (global): after the send, the next planet or moon opens already prepared.
 *
 * COMPLIANCE: one click prepares one fleet; the player always presses the game's own
 * "Avanti" and "Invia flotta". No request is made by Future here: the game checks the
 * target itself when page 2 opens. See ./repeat.ts for the "Ripeti" precedent (OGLight).
 */
import type { Store } from '../../core/storage';
import {
  CARGO_SHIPS,
  cargoLoad,
  copyProfileToAll,
  DEFAULT_SETTINGS,
  EMPTY_RESERVE,
  parseAmount,
  PROFILES_KEY,
  profileFor,
  SETTINGS_KEY,
  type FleetProfile,
  type Reserve,
  type FleetSettings,
  type FleetsaveProfile,
} from '../../engines/fleet';
import { originCoords, readShipSlots } from '../../data/fleet-page';
import { getDispatcher, whenDispatcherReady, type FleetDispatcher } from '../../data/fleet-dispatcher';
import {
  prepareAllShips,
  prepareDeploy,
  prepareExpedition,
  prepareFleetsave,
  prepareTransport,
  type FleetMode,
  type PrepareResult,
  type Target,
} from './actions';
import { hookSend, nextInRound, readRepeatParams, repeatUrl, type RepeatState } from './repeat';
import { FLEET_CSS, MODAL_CSS } from './style';
import { iconSvg, type IconName } from './icons';

export interface FleetBody {
  planetId: number | null;
  moonId: number | null;
  name: string;
  /** "g:s:p" */
  coords: string;
}

export interface FleetOptions {
  doc: Document;
  store: Store;
  bodyId: number;
  bodies: FleetBody[];
  t: (key: string, vars?: Record<string, string | number>) => string;
  locale: string;
  /** Current URL, and how to open another one (overridable in tests). */
  href?: string;
  navigate?: (url: string) => void;
}

const STYLE_ID = 'fut-fleet-style';
const MODAL_ID = 'fut-fleet-modal';
/** Missions offered for fleetsave, in the game's order codes. */
export const FLEETSAVE_MISSIONS = [3, 4, 6, 8, 15, 5, 1];
const pageState = new WeakMap<Document, { active: RepeatState | null; o: FleetOptions }>();
const REPEATABLE: FleetMode[] = ['moon', 'transport', 'deploy', 'expedition', 'fleetsave'];

function el<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, className = '', text?: string) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Sets a game input the way typing does, so the game's own handlers pick it up. */
export function typeInto(input: HTMLInputElement, value: number | string): void {
  input.value = String(value);
  input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

/** PrOGect-style: typing only the position fills empty galaxy/system with the origin's. */
export function enableOriginAutofill(doc: Document): void {
  const p = doc.querySelector<HTMLInputElement>('#fleet2 #position');
  if (!p || p.dataset.futAutofill) return;
  p.dataset.futAutofill = '1';
  // On the element itself, so it runs before the game's handler delegated on #fleet2.
  p.addEventListener('keyup', () => {
    if (!p.value.trim()) return;
    const origin = originCoords(doc);
    const g = doc.querySelector<HTMLInputElement>('#fleet2 #galaxy');
    const s = doc.querySelector<HTMLInputElement>('#fleet2 #system');
    if (!origin || !g || !s) return;
    if (!g.value.trim()) g.value = String(origin.galaxy);
    if (!s.value.trim()) s.value = String(origin.system);
  });
}

export function loadProfiles(store: Store): Record<string, FleetProfile> {
  return store.get<Record<string, FleetProfile>>(PROFILES_KEY, {});
}

export function loadSettings(store: Store): FleetSettings {
  return { ...DEFAULT_SETTINGS, ...store.get<Partial<FleetSettings>>(SETTINGS_KEY, {}) };
}

function button(doc: Document, text: string, onClick: () => void, cls = '', title = ''): HTMLButtonElement {
  const b = el(doc, 'button', `fut-fbtn ${cls}`.trim(), text);
  b.type = 'button';
  if (title) b.title = title;
  b.addEventListener('click', (e) => {
    e.preventDefault();
    onClick();
  });
  return b;
}

/** Our fields must not feed the game's keyboard shortcuts nor get browser autofill. */
function isolate(input: HTMLInputElement | HTMLSelectElement): void {
  input.setAttribute('autocomplete', 'off');
  input.addEventListener('keydown', (e) => e.stopPropagation());
  input.addEventListener('keyup', (e) => e.stopPropagation());
  input.addEventListener('keypress', (e) => e.stopPropagation());
}

function numberField(doc: Document, label: string, value: number | string | null, placeholder = ''): [HTMLLabelElement, HTMLInputElement] {
  const wrap = el(doc, 'label', 'fut-ffield');
  wrap.append(el(doc, 'span', '', label));
  const input = el(doc, 'input');
  input.type = 'text';
  input.inputMode = 'numeric';
  input.placeholder = placeholder;
  input.value = value ? String(value) : '';
  isolate(input);
  wrap.append(input);
  return [wrap, input];
}

function selectField(doc: Document, label: string, options: [string, string][], value: string): [HTMLLabelElement, HTMLSelectElement] {
  const wrap = el(doc, 'label', 'fut-ffield');
  wrap.append(el(doc, 'span', '', label));
  const sel = el(doc, 'select');
  for (const [v, text] of options) {
    const opt = el(doc, 'option', '', text);
    opt.value = v;
    opt.selected = v === value;
    sel.append(opt);
  }
  isolate(sel);
  wrap.append(sel);
  return [wrap, sel];
}

function checkField(doc: Document, label: string, checked: boolean): [HTMLLabelElement, HTMLInputElement] {
  const wrap = el(doc, 'label', 'fut-fcheck');
  const input = el(doc, 'input');
  input.type = 'checkbox';
  input.checked = checked;
  wrap.append(input, el(doc, 'span', '', label));
  return [wrap, input];
}

/* ------------------------------------------------------------------ */
/* Bodies                                                              */
/* ------------------------------------------------------------------ */

function parseCoords(coords: string): [number, number, number] | null {
  const parts = coords.replace(/[^\d:]/g, '').split(':').map(Number);
  return parts.length === 3 && parts.every((n) => n > 0) ? (parts as [number, number, number]) : null;
}

function bodyTarget(bodies: FleetBody[], id: number): Target | null {
  for (const b of bodies) {
    const c = parseCoords(b.coords);
    if (!c) continue;
    if (b.planetId === id) return { galaxy: c[0], system: c[1], position: c[2], type: 1, name: b.name };
    if (b.moonId === id) return { galaxy: c[0], system: c[1], position: c[2], type: 3, name: b.name };
  }
  return null;
}

function isMoon(bodies: FleetBody[], id: number): boolean {
  return bodies.some((b) => b.moonId === id);
}

function sameTypeIds(bodies: FleetBody[], id: number): number[] {
  const moon = isMoon(bodies, id);
  return bodies.map((b) => (moon ? b.moonId : b.planetId)).filter((x): x is number => x !== null);
}

function bodyLabel(o: FleetOptions, id: number): string {
  const b = o.bodies.find((x) => x.planetId === id || x.moonId === id);
  if (!b) return String(id);
  return `${b.name} [${b.coords}]${b.moonId === id ? ` · ${o.t('fleet.typeMoon')}` : ''}`;
}

/* ------------------------------------------------------------------ */
/* Panels                                                              */
/* ------------------------------------------------------------------ */

/** Ships and resources to keep on the body, as a block of fields. */
function reserveFields(o: FleetOptions, reserve: Reserve, title: string, hint: string): { el: HTMLElement; read: () => Reserve } {
  const { doc, t } = o;
  const box = el(doc, 'div', 'fut-freserve');
  box.append(el(doc, 'h5', '', title), el(doc, 'p', 'fut-fnote', hint));
  const shipGrid = el(doc, 'div', 'fut-fgrid');
  const shipInputs: [string, HTMLInputElement][] = [];
  for (const slot of readShipSlots(doc)) {
    if (slot.available <= 0 && !reserve.ships[slot.id]) continue;
    const [wrap, input] = numberField(doc, slot.name, reserve.ships[slot.id] ?? null, '0');
    shipGrid.append(wrap);
    shipInputs.push([slot.id, input]);
  }
  if (!shipInputs.length) shipGrid.append(el(doc, 'span', 'fut-fnote', t('fleet.noShips')));
  const resGrid = el(doc, 'div', 'fut-fgrid');
  const resInputs = (['metal', 'crystal', 'deuterium'] as const).map((k) => {
    const [wrap, input] = numberField(doc, t(`res.${k}`), reserve.resources[k] || null, '0');
    resGrid.append(wrap);
    return [k, input] as const;
  });
  box.append(el(doc, 'h6', '', t('fleet.reserveShips')), shipGrid, el(doc, 'h6', '', t('fleet.reserveRes')), resGrid);
  return {
    el: box,
    read: () => {
      const ships: Record<string, number> = {};
      for (const [id, input] of shipInputs) {
        const n = parseAmount(input.value);
        if (n > 0) ships[id] = n;
      }
      const resources = { metal: 0, crystal: 0, deuterium: 0 };
      for (const [k, input] of resInputs) resources[k] = parseAmount(input.value);
      return { ships, resources };
    },
  };
}

function reserveEditor(o: FleetOptions, onSaved: (msg: string) => void): HTMLElement {
  const { doc, t } = o;
  const profile = profileFor(loadProfiles(o.store), o.bodyId);
  const moon = isMoon(o.bodies, o.bodyId);
  const panel = el(doc, 'div', 'fut-feditor');
  panel.append(el(doc, 'h4', '', t(moon ? 'fleet.editTitleMoon' : 'fleet.editTitlePlanet', { body: bodyLabel(o, o.bodyId) })));

  // Reserve 1: Trasporto, Schiera, Su luna, Spedizione, Tutte. Reserve 2: Fleetsave only.
  const r1 = reserveFields(o, profile.reserve, t('fleet.reserve1Title'), t('fleet.reserve1Hint'));
  panel.append(r1.el);
  panel.append(el(doc, 'h5', '', t('fleet.fleetsave')));
  const saveGrid = el(doc, 'div', 'fut-fgrid');
  const origin = originCoords(doc);
  const [gWrap, gIn] = numberField(doc, t('fleet.galaxy'), profile.save?.galaxy ?? null, origin ? String(origin.galaxy) : '');
  const [sWrap, sIn] = numberField(doc, t('fleet.system'), profile.save?.system ?? null, origin ? String(origin.system) : '');
  const [pWrap, pIn] = numberField(doc, t('fleet.position'), profile.save?.position ?? null, '16');
  const [typeWrap, typeSel] = selectField(
    doc,
    t('fleet.type'),
    [['1', t('fleet.typePlanet')], ['3', t('fleet.typeMoon')], ['2', t('fleet.typeDebris')]],
    String(profile.save?.type ?? 1),
  );
  const [misWrap, misSel] = selectField(doc, t('fleet.mission'), FLEETSAVE_MISSIONS.map((m) => [String(m), t(`mission.${m}`)]), String(profile.save?.mission ?? 6));
  const [spdWrap, spdSel] = selectField(
    doc,
    t('fleet.speed'),
    Array.from({ length: 10 }, (_, i) => [String((i + 1) * 10), `${(i + 1) * 10}%`]),
    String(profile.save?.speed ?? 10),
  );
  saveGrid.append(gWrap, sWrap, pWrap, typeWrap, misWrap, spdWrap);
  panel.append(saveGrid);
  panel.append(el(doc, 'p', 'fut-fnote', t('fleet.fleetsaveHint')));
  const r2 = reserveFields(o, profile.saveReserve ?? EMPTY_RESERVE, t('fleet.reserve2Title'), t('fleet.reserve2Hint'));
  panel.append(r2.el);

  const read = (): FleetProfile => {
    const position = parseAmount(pIn.value);
    const save: FleetsaveProfile | null =
      position >= 1 && position <= 17
        ? {
            galaxy: parseAmount(gIn.value) || null,
            system: parseAmount(sIn.value) || null,
            position,
            type: Number(typeSel.value) as 1 | 2 | 3,
            mission: Number(misSel.value),
            speed: Number(spdSel.value),
          }
        : null;
    return { reserve: r1.read(), saveReserve: r2.read(), save };
  };

  const same = sameTypeIds(o.bodies, o.bodyId);
  const actions = el(doc, 'div', 'fut-factions');
  actions.append(
    button(doc, t('fleet.save'), () => {
      const all = loadProfiles(o.store);
      all[String(o.bodyId)] = read();
      o.store.set(PROFILES_KEY, all);
      onSaved(t('fleet.saved'));
    }, 'primary'),
    button(doc, t(moon ? 'fleet.copyMoons' : 'fleet.copyPlanets', { count: same.length }), () => {
      const all = loadProfiles(o.store);
      all[String(o.bodyId)] = read();
      o.store.set(PROFILES_KEY, copyProfileToAll(all, o.bodyId, same));
      onSaved(t('fleet.copied', { count: same.length }));
    }),
  );
  panel.append(actions);
  return panel;
}

function settingsEditor(o: FleetOptions, onSaved: (msg: string) => void): HTMLElement {
  const { doc, t } = o;
  const s = loadSettings(o.store);
  const names = new Map(readShipSlots(doc).map((x) => [Number(x.id), x.name || `#${x.id}`]));
  const shipName = (id: number) => names.get(id) ?? `#${id}`;
  const panel = el(doc, 'div', 'fut-feditor');
  panel.append(el(doc, 'h4', '', t('fleet.settingsTitle')));

  panel.append(el(doc, 'h5', '', t('fleet.transportTitle')));
  const g1 = el(doc, 'div', 'fut-fgrid');
  const cargoOptions = CARGO_SHIPS.map((id) => [String(id), shipName(id)] as [string, string]);
  const [mainW, mainSel] = selectField(doc, t('fleet.mainShip'), cargoOptions, String(s.mainShip));
  const [secW, secSel] = selectField(doc, t('fleet.secondShip'), [['0', t('fleet.none')], ...cargoOptions], String(s.secondShip));
  const [spdW, spdSel] = selectField(
    doc,
    t('fleet.speed'),
    Array.from({ length: 10 }, (_, i) => [String((i + 1) * 10), `${(i + 1) * 10}%`]),
    String(s.transportSpeed),
  );
  g1.append(mainW, secW, spdW);
  panel.append(g1);

  panel.append(el(doc, 'h5', '', t('fleet.favTitle')));
  const gf = el(doc, 'div', 'fut-fgrid');
  const destOptions: [string, string][] = [
    ['0', t('fleet.none')],
    ...o.bodies
      .flatMap((b) => [b.planetId, b.moonId])
      .filter((x): x is number => x !== null)
      .map((id) => [String(id), bodyLabel(o, id)] as [string, string]),
  ];
  const [favTW, favTSel] = selectField(doc, t('fleet.favTransport'), destOptions, String(s.favTransport ?? 0));
  const [favDW, favDSel] = selectField(doc, t('fleet.favDeploy'), destOptions, String(s.favDeploy ?? 0));
  gf.append(favTW, favDW);
  panel.append(gf);

  panel.append(el(doc, 'h5', '', t('fleet.expeditionTitle')));
  const g2 = el(doc, 'div', 'fut-fgrid');
  const [expW, expSel] = selectField(
    doc,
    t('fleet.expeditionShip'),
    [['0', t('fleet.bestShip')], ...[219, 203, 202].map((id) => [String(id), shipName(id)] as [string, string])],
    String(s.expeditionShip),
  );
  const [valW, valIn] = numberField(doc, t('fleet.expeditionValue'), s.expeditionValue, t('fleet.auto'));
  valIn.inputMode = 'text';
  const [extW, extIn] = checkField(doc, t('fleet.expeditionExtras'), s.expeditionExtras);
  g2.append(expW, valW, extW);
  panel.append(g2);
  panel.append(el(doc, 'p', 'fut-fnote', t('fleet.expeditionHint')));

  panel.append(el(doc, 'h5', '', t('fleet.repeatTitle')));
  const [repW, repIn] = checkField(doc, t('fleet.repeat'), s.repeat);
  panel.append(repW, el(doc, 'p', 'fut-fnote', t('fleet.repeatHint')));

  const actions = el(doc, 'div', 'fut-factions');
  actions.append(
    button(doc, t('fleet.save'), () => {
      const next: FleetSettings = {
        ...loadSettings(o.store),
        mainShip: Number(mainSel.value),
        secondShip: Number(secSel.value),
        transportSpeed: Number(spdSel.value),
        favTransport: Number(favTSel.value) || null,
        favDeploy: Number(favDSel.value) || null,
        expeditionShip: Number(expSel.value),
        expeditionValue: valIn.value.trim(),
        expeditionExtras: extIn.checked,
        repeat: repIn.checked,
      };
      o.store.set(SETTINGS_KEY, next);
      onSaved(t('fleet.saved'));
    }, 'primary'),
  );
  panel.append(actions);
  return panel;
}

/* ------------------------------------------------------------------ */
/* Bar                                                                 */
/* ------------------------------------------------------------------ */

function summary(o: FleetOptions, profile: FleetProfile): string {
  const ships = Object.values(profile.reserve.ships).reduce((a, b) => a + b, 0);
  const r = profile.reserve.resources;
  const fmt = (n: number) => n.toLocaleString(o.locale);
  const parts = [];
  if (ships) parts.push(o.t('fleet.summaryShips', { count: fmt(ships) }));
  if (r.metal || r.crystal || r.deuterium) parts.push(`${fmt(r.metal)} / ${fmt(r.crystal)} / ${fmt(r.deuterium)}`);
  return parts.length ? `${o.t('fleet.reserve')}: ${parts.join(' · ')}` : o.t('fleet.noReserve');
}

function universeSpeed(doc: Document): number {
  const n = Number(doc.querySelector('meta[name="ogame-universe-speed"]')?.getAttribute('content'));
  return Number.isFinite(n) && n > 0 ? n : 1;
}


/* ------------------------------------------------------------------ */
/* Settings window: separate from the action bar                       */
/* ------------------------------------------------------------------ */

let modalKeyHandler: ((e: KeyboardEvent) => void) | null = null;

function closeModal(doc: Document): void {
  doc.getElementById(MODAL_ID)?.remove();
  if (modalKeyHandler) doc.removeEventListener('keydown', modalKeyHandler, true);
  modalKeyHandler = null;
}

/**
 * Opens the fleet settings over the page, in a Shadow DOM so the game's CSS cannot
 * restyle our fields. Tab "this body": reserves and fleetsave; tab "general": the rest.
 */
function openSettings(o: FleetOptions, tab: 'body' | 'general', onChange: () => void): void {
  const { doc, t } = o;
  closeModal(doc);
  const host = el(doc, 'div');
  host.id = MODAL_ID;
  const root = host.attachShadow({ mode: 'open' });
  const style = el(doc, 'style');
  style.textContent = MODAL_CSS;
  const backdrop = el(doc, 'div', 'backdrop');
  const panel = el(doc, 'div', 'panel');
  const head = el(doc, 'div', 'head');
  const tabs = el(doc, 'div', 'tabs');
  const moon = isMoon(o.bodies, o.bodyId);
  const status = el(doc, 'span', 'status');
  const body = el(doc, 'div', 'body');
  const show = (which: 'body' | 'general') => {
    tabs.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.tab === which));
    const saved = (msg: string) => {
      status.textContent = msg;
      onChange();
    };
    body.replaceChildren(which === 'body' ? reserveEditor(o, saved) : settingsEditor(o, saved));
  };
  for (const [id, label] of [
    ['body', t(moon ? 'fleet.tabMoon' : 'fleet.tabPlanet')],
    ['general', t('fleet.tabGeneral')],
  ] as const) {
    const b = button(doc, label, () => show(id), 'tab');
    b.dataset.tab = id;
    tabs.append(b);
  }
  const close = button(doc, '×', () => closeModal(doc), 'close', t('fleet.close'));
  head.append(tabs, status, close);
  panel.append(head, body);
  backdrop.append(panel);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeModal(doc);
  });
  root.append(style, backdrop);
  doc.body.append(host);
  modalKeyHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') closeModal(doc);
  };
  doc.addEventListener('keydown', modalKeyHandler, true);
  show(tab);
}

/* ------------------------------------------------------------------ */
/* Action bar                                                          */
/* ------------------------------------------------------------------ */

function shortLabel(o: FleetOptions, id: number | null): string {
  if (!id) return o.t('fleet.pickDest');
  const b = o.bodies.find((x) => x.planetId === id || x.moonId === id);
  if (!b) return o.t('fleet.pickDest');
  return `${b.name}${b.moonId === id ? ' ☾' : ''}`;
}

function tile(doc: Document, icon: IconName, label: string, caption: string, title: string, onClick: () => void, cls = ''): HTMLButtonElement {
  const b = el(doc, 'button', `fut-ftile ${cls}`.trim());
  b.type = 'button';
  b.title = title;
  b.innerHTML = iconSvg(icon);
  b.append(el(doc, 'span', 'fut-flabel', label));
  if (caption) b.append(el(doc, 'span', 'fut-fcaption', caption));
  b.addEventListener('click', (e) => {
    e.preventDefault();
    onClick();
  });
  return b;
}

function iconToggle(doc: Document, icon: IconName, title: string, onClick: () => void, cls = ''): HTMLButtonElement {
  const b = el(doc, 'button', `fut-ficon ${cls}`.trim());
  b.type = 'button';
  b.title = title;
  b.innerHTML = iconSvg(icon, 18);
  b.addEventListener('click', (e) => {
    e.preventDefault();
    onClick();
  });
  return b;
}

/** Small list to pick the destination of Trasporto / Schiera; the pick becomes the favourite. */
function destinationMenu(o: FleetOptions, anchor: HTMLElement, current: number | null, onPick: (id: number) => void): void {
  const { doc } = o;
  doc.querySelectorAll('.fut-fmenu').forEach((n) => n.remove());
  const menu = el(doc, 'div', 'fut-fmenu');
  for (const b of o.bodies) {
    for (const id of [b.planetId, b.moonId]) {
      if (id === null || id === o.bodyId) continue;
      const item = button(doc, `${b.name}${id === b.moonId ? ' ☾' : ''}  [${b.coords}]`, () => {
        menu.remove();
        onPick(id);
      }, id === current ? 'on' : '');
      menu.append(item);
    }
  }
  // On <body> with fixed position: inside the bar the game's ship panels covered and clipped it.
  const r = anchor.getBoundingClientRect();
  menu.style.top = `${Math.round(r.bottom + 4)}px`;
  menu.style.left = `${Math.round(r.left)}px`;
  doc.body.append(menu);
  const away = (e: MouseEvent) => {
    if (!menu.contains(e.target as Node)) {
      menu.remove();
      doc.removeEventListener('mousedown', away, true);
    }
  };
  doc.addEventListener('mousedown', away, true);
  // Fixed on screen: close it when the page scrolls instead of leaving it floating.
  doc.defaultView?.addEventListener('scroll', () => menu.remove(), { once: true, capture: true });
}

export function renderFleetTools(o: FleetOptions): void {
  const { doc, t } = o;
  if (!doc.getElementById(STYLE_ID)) {
    const style = el(doc, 'style');
    style.id = STYLE_ID;
    style.textContent = FLEET_CSS;
    doc.head.append(style);
  }
  doc.querySelectorAll('.fut-fbar').forEach((n) => n.remove());
  const href = o.href ?? doc.location?.href ?? '';
  const navigate = o.navigate ?? ((url: string) => doc.location.assign(url));
  const profile = profileFor(loadProfiles(o.store), o.bodyId);
  const settings = loadSettings(o.store);
  const redraw = () => renderFleetTools(o);

  const fleet1 = doc.getElementById('fleet1');
  const anchor1 = fleet1?.querySelector('#technologies') ?? null;
  const fleet2 = doc.getElementById('fleet2');
  const anchor2 = fleet2?.querySelector('#buttonz') ?? null;
  if (fleet2) enableOriginAutofill(doc);

  // Which button prepared the fleet on this page, for "Ripeti". Kept per document so a
  // redraw (after changing a setting) does not forget it.
  const incoming = readRepeatParams(href);
  const state = pageState.get(doc) ?? { active: incoming, o };
  state.o = o;
  pageState.set(doc, state);

  const info = el(doc, 'span', 'fut-finfo', summary(o, profile));
  const say = (text: string, err = false) => {
    info.textContent = text;
    info.classList.toggle('err', err);
  };
  const report = (r: PrepareResult, okKey: string, vars: Record<string, string | number> = {}) =>
    r.ok
      ? say(t(okKey, { ships: r.ships.toLocaleString(o.locale), cargo: r.cargo.toLocaleString(o.locale), ...vars }))
      : say(t(r.reason ?? 'fleet.err.noShips'), true);
  const withDispatcher = (fn: (fd: FleetDispatcher) => void) => {
    const fd = getDispatcher();
    if (!fd) return say(t('fleet.err.notReady'), true);
    if (fd.currentPage !== 'fleet1') return say(t('fleet.err.page1'), true);
    // The game checks the target on its own (e.g. right after the page loads): when that
    // answer lands it rewrites the target, so we prepare only once it is back.
    void whenTargetIdle(fd).then(() => fn(fd));
  };
  const begin = (mode: FleetMode, dest: number | null = null) => {
    const prev = state.active;
    state.active = REPEATABLE.includes(mode) ? { mode, first: prev && prev.mode === mode ? prev.first : o.bodyId, dest } : null;
  };

  const run: Record<FleetMode, (dest?: number | null) => void> = {
    moon: () =>
      withDispatcher((fd) => {
        const here = o.bodies.find((b) => b.planetId === o.bodyId);
        const target = here?.moonId ? bodyTarget(o.bodies, here.moonId) : null;
        if (!target) return say(t('fleet.err.noMoon'), true);
        begin('moon');
        report(prepareTransport(fd, doc, profile, settings, target), 'fleet.ok.cargo');
      }),
    transport: (dest) =>
      withDispatcher((fd) => {
        const target = dest ? bodyTarget(o.bodies, dest) : null;
        if (!dest || !target) return say(t('fleet.err.noDest'), true);
        begin('transport', dest);
        report(prepareTransport(fd, doc, profile, settings, target), 'fleet.ok.cargo');
      }),
    deploy: (dest) =>
      withDispatcher((fd) => {
        const target = dest ? bodyTarget(o.bodies, dest) : null;
        if (!dest || !target) return say(t('fleet.err.noDest'), true);
        begin('deploy', dest);
        report(prepareDeploy(fd, doc, profile, settings, target), 'fleet.ok.cargo');
      }),
    expedition: () =>
      withDispatcher((fd) => {
        begin('expedition');
        const r = prepareExpedition(fd, doc, profile, settings, { economySpeed: universeSpeed(doc) });
        report(r, 'fleet.ok.expedition', { target: r.target.toLocaleString(o.locale) });
      }),
    fleetsave: () =>
      withDispatcher((fd) => {
        if (!profile.save) return say(t('fleet.err.noFleetsave'), true);
        begin('fleetsave');
        report(prepareFleetsave(fd, doc, profile, profile.save), 'fleet.ok.cargo');
      }),
    all: () =>
      withDispatcher((fd) => {
        begin('all');
        report(prepareAllShips(fd, profile), 'fleet.ok.ships');
      }),
  };

  const setFav = (key: 'favTransport' | 'favDeploy', id: number) => {
    o.store.set(SETTINGS_KEY, { ...loadSettings(o.store), [key]: id });
    redraw();
  };
  const withCaret = (tileEl: HTMLButtonElement, key: 'favTransport' | 'favDeploy') => {
    const wrap = el(doc, 'span', 'fut-ftilewrap');
    const caret = iconToggle(doc, 'caret', t('fleet.pickDest'), () => destinationMenu(o, wrap, settings[key], (id) => setFav(key, id)), 'fut-fcaret');
    wrap.append(tileEl, caret);
    return wrap;
  };

  if (fleet1 && anchor1) {
    const bar = el(doc, 'div', 'fut-fbar');
    const tiles = el(doc, 'div', 'fut-ftiles');
    const here = o.bodies.find((b) => b.planetId === o.bodyId);
    if (here?.moonId) tiles.append(tile(doc, 'moon', t('fleet.btn.moon'), '', t('fleet.tip.moon'), () => run.moon()));
    tiles.append(
      withCaret(
        tile(doc, 'transport', t('fleet.btn.transport'), `→ ${shortLabel(o, settings.favTransport)}`, t('fleet.tip.transport'), () =>
          settings.favTransport ? run.transport(settings.favTransport) : say(t('fleet.err.noDest'), true),
        ),
        'favTransport',
      ),
      withCaret(
        tile(doc, 'deploy', t('fleet.btn.deploy'), `→ ${shortLabel(o, settings.favDeploy)}`, t('fleet.tip.deploy'), () =>
          settings.favDeploy ? run.deploy(settings.favDeploy) : say(t('fleet.err.noDest'), true),
        ),
        'favDeploy',
      ),
      tile(doc, 'expedition', t('fleet.btn.expedition'), '', t('fleet.tip.expedition'), () => run.expedition()),
      tile(
        doc,
        'fleetsave',
        t('fleet.btn.fleetsave'),
        profile.save ? `→ ${profile.save.position}` : '',
        profile.save ? t('fleet.tip.fleetsave') : t('fleet.err.noFleetsave'),
        () => (profile.save ? run.fleetsave() : openSettings(o, 'body', redraw)),
        profile.save ? '' : 'dim',
      ),
      tile(doc, 'all', t('fleet.btn.all'), '', t('fleet.tip.all'), () => run.all()),
    );
    const side = el(doc, 'div', 'fut-fside');
    side.append(
      iconToggle(doc, 'repeat', `${t('fleet.repeatShort')}: ${settings.repeat ? t('fleet.on') : t('fleet.off')}. ${t('fleet.repeatHint')}`, () => {
        o.store.set(SETTINGS_KEY, { ...loadSettings(o.store), repeat: !loadSettings(o.store).repeat });
        redraw();
      }, settings.repeat ? 'on' : ''),
      iconToggle(doc, 'settings', t('fleet.settingsTitle'), () => openSettings(o, 'body', redraw)),
    );
    const top = el(doc, 'div', 'fut-frow');
    top.append(tiles, side);
    bar.append(top, info);
    anchor1.before(bar);
  }

  if (fleet2 && anchor2) {
    const bar = el(doc, 'div', 'fut-fbar');
    const row = el(doc, 'div', 'fut-frow');
    const info2 = el(doc, 'span', 'fut-finfo', summary(o, profile));
    const tiles = el(doc, 'div', 'fut-ftiles');
    tiles.append(
      tile(doc, 'cargo', t('fleet.resMinusReserve'), '', t('fleet.tip.cargo'), () => {
        const fd = getDispatcher();
        if (!fd) return;
        const load = loadCargoNow(fd, profile);
        info2.textContent = t('fleet.resLoaded', { cargo: load.toLocaleString(o.locale) });
      }),
    );
    row.append(tiles);
    bar.append(row, info2);
    anchor2.before(bar);
  }

  void whenDispatcherReady().then((fd) => {
    if (!fd) return;
    // "Ripeti": know when the game accepted the send, and move on as OGLight does.
    hookSend(fd, () => {
      const current = pageState.get(doc);
      if (!current?.active || !loadSettings(current.o.store).repeat) return false;
      const next = nextInRound(current.active, current.o.bodyId, current.o.bodies);
      if (next === null) return false;
      navigate(repeatUrl(href, next, current.active));
      return true;
    });
    // Opened by "Ripeti": prepare the same button here (OGLight does the same on its modes).
    // Once per page: a redraw must not prepare it again.
    if (incoming && fd.currentPage === 'fleet1' && !doc.documentElement.dataset.futAutoRun) {
      doc.documentElement.dataset.futAutoRun = '1';
      // After the page has fully loaded, so the game's own first target check has started
      // (withDispatcher then waits for its answer before preparing).
      const go = () => {
        if (incoming.mode === 'transport' || incoming.mode === 'deploy') run[incoming.mode](incoming.dest);
        else run[incoming.mode]();
      };
      if (doc.readyState === 'complete') setTimeout(go, 0);
      else doc.defaultView?.addEventListener('load', () => setTimeout(go, 0), { once: true });
    }
  });
}

/** Resolves when the game's own target check is not running (client-side wait, at most 5 s). */
function whenTargetIdle(fd: FleetDispatcher, timeoutMs = 5000): Promise<void> {
  const busy = () => Boolean((fd as { fetchTargetPlayerDataTimeout?: unknown }).fetchTargetPlayerDataTimeout);
  if (!busy()) return Promise.resolve();
  const started = Date.now();
  return new Promise((resolve) => {
    const check = () => (!busy() || Date.now() - started > timeoutMs ? resolve() : setTimeout(check, 50));
    check();
  });
}

function loadCargoNow(fd: FleetDispatcher, profile: FleetProfile): number {
  const onPlanet = { metal: fd.metalOnPlanet, crystal: fd.crystalOnPlanet, deuterium: fd.deuteriumOnPlanet };
  const load = cargoLoad(onPlanet, profile.reserve, Math.ceil(Number(fd.getConsumption()) || 0), fd.getCargoCapacity());
  fd.cargoMetal = load.metal;
  fd.cargoCrystal = load.crystal;
  fd.cargoDeuterium = load.deuterium;
  fd.refresh();
  return load.metal + load.crystal + load.deuterium;
}
