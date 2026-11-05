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
  parseAmount,
  PROFILES_KEY,
  profileFor,
  SETTINGS_KEY,
  type FleetProfile,
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
import { armRepeat, decideRepeat, readRepeatParams, repeatUrl, type RepeatState } from './repeat';
import { FLEET_CSS } from './style';

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

function reserveEditor(o: FleetOptions, onSaved: (msg: string) => void): HTMLElement {
  const { doc, t } = o;
  const profile = profileFor(loadProfiles(o.store), o.bodyId);
  const moon = isMoon(o.bodies, o.bodyId);
  const panel = el(doc, 'div', 'fut-feditor');
  panel.hidden = true;
  panel.append(el(doc, 'h4', '', t(moon ? 'fleet.editTitleMoon' : 'fleet.editTitlePlanet', { body: bodyLabel(o, o.bodyId) })));

  panel.append(el(doc, 'h5', '', t('fleet.reserveShips')));
  const shipGrid = el(doc, 'div', 'fut-fgrid');
  const shipInputs: [string, HTMLInputElement][] = [];
  for (const slot of readShipSlots(doc)) {
    if (slot.available <= 0 && !profile.reserve.ships[slot.id]) continue;
    const [wrap, input] = numberField(doc, slot.name, profile.reserve.ships[slot.id] ?? null, '0');
    shipGrid.append(wrap);
    shipInputs.push([slot.id, input]);
  }
  if (!shipInputs.length) shipGrid.append(el(doc, 'span', 'fut-fnote', t('fleet.noShips')));
  panel.append(shipGrid);

  panel.append(el(doc, 'h5', '', t('fleet.reserveRes')));
  const resGrid = el(doc, 'div', 'fut-fgrid');
  const resInputs = (['metal', 'crystal', 'deuterium'] as const).map((k) => {
    const [wrap, input] = numberField(doc, t(`res.${k}`), profile.reserve.resources[k] || null, '0');
    resGrid.append(wrap);
    return [k, input] as const;
  });
  panel.append(resGrid);

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

  const read = (): FleetProfile => {
    const ships: Record<string, number> = {};
    for (const [id, input] of shipInputs) {
      const n = parseAmount(input.value);
      if (n > 0) ships[id] = n;
    }
    const resources = { metal: 0, crystal: 0, deuterium: 0 };
    for (const [k, input] of resInputs) resources[k] = parseAmount(input.value);
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
    return { reserve: { ships, resources }, save };
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
  panel.hidden = true;
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

/** Destination picker for Trasporto / Schiera, preselected on its favourite. */
function destinationPicker(o: FleetOptions, fav: number | null, onFav: (id: number) => void): { wrap: HTMLElement; value: () => number | null } {
  const { doc, t } = o;
  const wrap = el(doc, 'span', 'fut-fdest');
  const sel = el(doc, 'select');
  isolate(sel);
  const ids = o.bodies.flatMap((b) => [b.planetId, b.moonId]).filter((x): x is number => x !== null && x !== o.bodyId);
  const preferred = fav !== null && ids.includes(fav) ? fav : null;
  if (preferred === null) {
    const opt = el(doc, 'option', '', t('fleet.pickDest'));
    opt.value = '';
    sel.append(opt);
  }
  for (const id of ids) {
    const opt = el(doc, 'option', '', `${id === fav ? '★ ' : ''}${bodyLabel(o, id)}`);
    opt.value = String(id);
    opt.selected = id === preferred;
    sel.append(opt);
  }
  const star = button(doc, '★', () => {
    const v = Number(sel.value);
    if (v > 0) onFav(v);
  }, `fut-fstar${preferred !== null ? ' on' : ''}`, t('fleet.setFav'));
  sel.addEventListener('change', () => star.classList.toggle('on', Number(sel.value) === fav));
  wrap.append(sel, star);
  return { wrap, value: () => (Number(sel.value) > 0 ? Number(sel.value) : null) };
}

export function renderFleetTools(o: FleetOptions): void {
  const { doc, t } = o;
  if (!doc.getElementById(STYLE_ID)) {
    const style = el(doc, 'style');
    style.id = STYLE_ID;
    style.textContent = FLEET_CSS;
    doc.head.append(style);
  }
  doc.querySelectorAll('.fut-fbar, .fut-feditor').forEach((n) => n.remove());
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

  // State of this page: which Future button prepared the fleet, for "Ripeti". It outlives
  // redraws (saving a favourite re-renders the bar), so it is kept per document.
  const incoming = readRepeatParams(href);
  const state = pageState.get(doc) ?? { active: incoming, o };
  state.o = o;
  pageState.set(doc, state);

  const info = el(doc, 'span', 'fut-finfo', summary(o, profile));
  const report = (r: PrepareResult, okKey: string, vars: Record<string, string | number> = {}) => {
    info.classList.toggle('err', !r.ok);
    info.textContent = r.ok
      ? t(okKey, { ships: r.ships.toLocaleString(o.locale), cargo: r.cargo.toLocaleString(o.locale), ...vars })
      : t(r.reason ?? 'fleet.err.noShips');
  };
  const withDispatcher = (fn: (fd: FleetDispatcher) => void) => {
    const fd = getDispatcher();
    if (!fd) {
      info.textContent = t('fleet.err.notReady');
      return;
    }
    if (fd.currentPage !== 'fleet1') {
      info.textContent = t('fleet.err.page1');
      return;
    }
    fn(fd);
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
        if (!target) {
          info.textContent = t('fleet.err.noMoon');
          return;
        }
        begin('moon');
        report(prepareTransport(fd, doc, profile, settings, target), 'fleet.ok.cargo');
      }),
    transport: (dest) =>
      withDispatcher((fd) => {
        const target = dest ? bodyTarget(o.bodies, dest) : null;
        if (!dest || !target) {
          info.textContent = t('fleet.err.noDest');
          return;
        }
        begin('transport', dest);
        report(prepareTransport(fd, doc, profile, settings, target), 'fleet.ok.cargo');
      }),
    deploy: (dest) =>
      withDispatcher((fd) => {
        const target = dest ? bodyTarget(o.bodies, dest) : null;
        if (!dest || !target) {
          info.textContent = t('fleet.err.noDest');
          return;
        }
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
        if (!profile.save) {
          info.textContent = t('fleet.err.noFleetsave');
          return;
        }
        begin('fleetsave');
        report(prepareFleetsave(fd, doc, profile, profile.save), 'fleet.ok.cargo');
      }),
    all: () =>
      withDispatcher((fd) => {
        begin('all');
        report(prepareAllShips(fd, profile), 'fleet.ok.ships');
      }),
  };

  if (fleet1 && anchor1) {
    const bar = el(doc, 'div', 'fut-fbar');
    const row = el(doc, 'div', 'fut-frow');
    row.append(el(doc, 'span', 'fut-fbrand', 'Future'));

    const here = o.bodies.find((b) => b.planetId === o.bodyId);
    if (here?.moonId) row.append(button(doc, t('fleet.btn.moon'), () => run.moon(), '', t('fleet.tip.moon')));

    const saveFav = (key: 'favTransport' | 'favDeploy') => (id: number) => {
      o.store.set(SETTINGS_KEY, { ...loadSettings(o.store), [key]: id });
      redraw();
    };
    const tp = destinationPicker(o, settings.favTransport, saveFav('favTransport'));
    const tpGroup = el(doc, 'span', 'fut-fgroup');
    tpGroup.append(button(doc, t('fleet.btn.transport'), () => run.transport(tp.value()), '', t('fleet.tip.transport')), tp.wrap);
    const dp = destinationPicker(o, settings.favDeploy, saveFav('favDeploy'));
    const dpGroup = el(doc, 'span', 'fut-fgroup');
    dpGroup.append(button(doc, t('fleet.btn.deploy'), () => run.deploy(dp.value()), '', t('fleet.tip.deploy')), dp.wrap);
    row.append(tpGroup, dpGroup);

    row.append(button(doc, t('fleet.btn.expedition'), () => run.expedition(), '', t('fleet.tip.expedition')));
    row.append(
      button(doc, t('fleet.btn.fleetsave'), () => run.fleetsave(), profile.save ? 'primary' : 'dim', profile.save ? t('fleet.tip.fleetsave') : t('fleet.err.noFleetsave')),
    );
    row.append(button(doc, t('fleet.btn.all'), () => run.all(), '', t('fleet.tip.all')));
    bar.append(row);

    const row2 = el(doc, 'div', 'fut-frow');
    const repeat = button(doc, `${t('fleet.repeatShort')}: ${settings.repeat ? t('fleet.on') : t('fleet.off')}`, () => {
      o.store.set(SETTINGS_KEY, { ...loadSettings(o.store), repeat: !loadSettings(o.store).repeat });
      redraw();
    }, `fut-fchip${settings.repeat ? ' on' : ''}`, t('fleet.repeatHint'));
    const notify = (msg: string) => {
      redraw();
      const fresh = doc.querySelector('.fut-fbar .fut-finfo');
      if (fresh) fresh.textContent = msg;
    };
    const reserves = reserveEditor(o, notify);
    const setup = settingsEditor(o, notify);
    row2.append(
      repeat,
      button(doc, t('fleet.edit'), () => {
        reserves.hidden = !reserves.hidden;
        setup.hidden = true;
      }),
      button(doc, '⚙', () => {
        setup.hidden = !setup.hidden;
        reserves.hidden = true;
      }, '', t('fleet.settingsTitle')),
      info,
    );
    bar.append(row2);
    // Panels sit outside the game's #fleet1 form, so its own input handlers and styles stay off them.
    fleet1.before(reserves, setup);
    anchor1.before(bar);
  }

  if (fleet2 && anchor2) {
    const bar = el(doc, 'div', 'fut-fbar');
    const row = el(doc, 'div', 'fut-frow');
    const info2 = el(doc, 'span', 'fut-finfo', summary(o, profile));
    row.append(el(doc, 'span', 'fut-fbrand', 'Future'));
    row.append(
      button(doc, t('fleet.resMinusReserve'), () => {
        const fd = getDispatcher();
        if (!fd) return;
        const load = loadCargoNow(fd, profile);
        info2.textContent = t('fleet.resLoaded', { cargo: load.toLocaleString(o.locale) });
      }),
      info2,
    );
    bar.append(row);
    anchor2.before(bar);
  }

  // "Ripeti": the player's own send arms it; the page that follows the send moves on.
  const armOnSend = () => {
    const current = pageState.get(doc);
    const fd = getDispatcher();
    if (!current?.active || !fd || fd.currentPage !== 'fleet2' || !loadSettings(current.o.store).repeat) return;
    armRepeat(current.active, current.o.bodyId, fd.fleetCount);
  };
  if (!doc.documentElement.dataset.futSendHook) {
    doc.documentElement.dataset.futSendHook = '1';
    doc.addEventListener('click', (e) => {
      if ((e.target as Element | null)?.closest?.('#sendFleet')) armOnSend();
    }, true);
    doc.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') armOnSend();
    }, true);
  }

  void whenDispatcherReady().then((fd) => {
    if (!fd) return;
    const decision = decideRepeat({ bodyId: o.bodyId, fleetCount: fd.fleetCount, list: o.bodies });
    if (decision.kind === 'next') {
      info.textContent = t('fleet.repeatNext', { body: bodyLabel(o, decision.cp) });
      navigate(repeatUrl(href, decision.cp, decision.state));
      return;
    }
    if (decision.kind === 'done') {
      info.textContent = t('fleet.repeatDone');
      return;
    }
    // Opened by "Ripeti": prepare the same button here (OGLight does the same on its modes).
    // Once per page: a redraw (e.g. after saving a favourite) must not prepare it again.
    if (incoming && fd.currentPage === 'fleet1' && !doc.documentElement.dataset.futAutoRun) {
      doc.documentElement.dataset.futAutoRun = '1';
      if (incoming.mode === 'transport' || incoming.mode === 'deploy') run[incoming.mode](incoming.dest);
      else run[incoming.mode]();
    }
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
