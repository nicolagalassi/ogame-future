/**
 * Future's tools on the game's fleet page.
 *
 * Page 1 bar, one button per kind of send, each preparing the whole form (ships, target,
 * mission, speed, cargo) on the game's own fleetDispatcher, as OGLight does:
 * - Trasporto / Schiera: the plain game actions, towards coordinates typed (or an own body picked)
 *   on page 1, with the resources picked there; no reserve.
 * - Raccolta spedizioni (secondary, for players who gather fleet and resources on a main moon):
 *   Luna (planet → its moon), then transport or deploy towards the favourite, with the reserves.
 * - Spedizione: best ship and expedition cargo, position 16 of this system.
 * - Fleetsave: the per-body profile (empty galaxy/system = this body's, as in PrOGect).
 * Rules per body, each with its own global switch: ships to keep, resources to keep, ships
 * the jump gate keeps (moons). The fleetsave has its own ships + resources and ignores the
 * switches. Any rule can be copied onto any chosen bodies; each shows where else it is set.
 * "Ripeti" (global): after the send, the next planet or moon opens already prepared.
 *
 * COMPLIANCE: one click prepares one fleet; the player always presses the game's own
 * "Avanti" and "Invia flotta". No request is made by Future here: the game checks the
 * target itself when page 2 opens. See ./repeat.ts for the "Ripeti" precedent (OGLight).
 */
import { icon } from '../../core/icons';
import { WINDOW_SHEET } from '../../core/sheet';
import { PLAN_KEY, SENT_KEY, type Plan, type Shipment } from '../../engines/planner';
import { expeditionItemBoost, ITEMS_KEY, LF_BONUS_KEY, type ActiveItems, type LfBonuses } from '../../data/bonuses';
import type { Store } from '../../core/storage';
import {
  CARGO_SHIPS,
  cargoLoad,
  activeProfile,
  copySections,
  RESERVE_SECTIONS,
  sameSection,
  sectionEmpty,
  settingsFrom,
  parseAmount,
  parseCoords,
  PROFILES_KEY,
  profileFor,
  SETTINGS_KEY,
  LAST_FLEET_KEY,
  DELIVERY_KEY,
  type Delivery,
  type LastFleet,
  type FleetProfile,
  type Reserve,
  type ReserveSection,
  type FleetSettings,
  type FleetsaveProfile,
  type ResourcePick,
  type SendTarget,
  pickedLoad,
  resolveSend,
} from '../../engines/fleet';
import { originCoords, readShipSlots } from '../../data/fleet-page';
import { getDispatcher, readShipsInfo, shipCapacity as shipCapacityOf, shipsOnPlanet, SHIPS_INFO_KEY, whenDispatcherReady, type FleetDispatcher } from '../../data/fleet-dispatcher';
import {
  prepareLast,
  snapshotFleet,
  prepareDeploy,
  prepareDelivery,
  prepareExpedition,
  prepareFleetsave,
  prepareSend,
  prepareTransport,
  type FleetMode,
  type PrepareResult,
  type Target,
} from './actions';
import { hookSend, nextInRound, readRepeatParams, repeatUrl, type RepeatState } from './repeat';
import { FLEET_CSS, MODAL_CSS } from './style';
import { keyLabel, keymap, registerActions } from '../shortcuts';
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
  /** Opens Future's settings on the fleet section (general fleet settings, keys). */
  onOpenSettings?: () => void;
}

const STYLE_ID = 'fut-fleet-style';
const MODAL_ID = 'fut-fleet-modal';
/** Missions offered for fleetsave, in the game's order codes. */
export const FLEETSAVE_MISSIONS = [3, 4, 6, 8, 15, 5, 1];
const pageState = new WeakMap<Document, { active: RepeatState | null; o: FleetOptions }>();
const REPEATABLE: FleetMode[] = ['moon', 'collect', 'collectDeploy', 'expedition', 'fleetsave', 'plan'];

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
  return settingsFrom(store.get<Partial<FleetSettings>>(SETTINGS_KEY, {}));
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

/** One number per ship type, for a ships rule. */
function shipFields(o: FleetOptions, ships: Record<string, number>): { el: HTMLElement; read: () => Record<string, number> } {
  const grid = el(o.doc, 'div', 'fut-fgrid');
  const inputs: [string, HTMLInputElement][] = [];
  // Every ship type, not only those on this body: the rule can be copied to other bodies.
  for (const slot of readShipSlots(o.doc)) {
    const [wrap, input] = numberField(o.doc, slot.name, ships[slot.id] ?? null, '0');
    grid.append(wrap);
    inputs.push([slot.id, input]);
  }
  if (!inputs.length) grid.append(el(o.doc, 'span', 'fut-fnote', o.t('fleet.noShips')));
  return {
    el: grid,
    read: () => {
      const out: Record<string, number> = {};
      for (const [id, input] of inputs) {
        const n = parseAmount(input.value);
        if (n > 0) out[id] = n;
      }
      return out;
    },
  };
}

/** Metal, crystal, deuterium to keep. */
function resourceFields(o: FleetOptions, res: Reserve['resources']): { el: HTMLElement; read: () => Reserve['resources'] } {
  const grid = el(o.doc, 'div', 'fut-fgrid');
  const inputs = (['metal', 'crystal', 'deuterium'] as const).map((k) => {
    const [wrap, input] = numberField(o.doc, o.t(`res.${k}`), res[k] || null, '0');
    grid.append(wrap);
    return [k, input] as const;
  });
  return {
    el: grid,
    read: () => {
      const out = { metal: 0, crystal: 0, deuterium: 0 };
      for (const [k, input] of inputs) out[k] = parseAmount(input.value);
      return out;
    },
  };
}

/** Short name of a body for the lists: "Colonia" or "Colonia ☾". */
function shortName(o: FleetOptions, id: number): string {
  const b = o.bodies.find((x) => x.planetId === id || x.moonId === id);
  return b ? `${b.name}${b.moonId === id ? ' ☾' : ''}` : String(id);
}

const SWITCH: Partial<Record<ReserveSection, 'shipsOn' | 'resourcesOn' | 'gateOn'>> = { ships: 'shipsOn', resources: 'resourcesOn', gate: 'gateOn' };

/**
 * Where a rule stands: on or off (the fleetsave has no switch), and whether the same rule is
 * set on other bodies too or only on this one.
 */
function ruleBadge(o: FleetOptions, section: ReserveSection): HTMLElement {
  const { doc, t } = o;
  const profiles = loadProfiles(o.store);
  const settings = loadSettings(o.store);
  const key = SWITCH[section];
  const badge = el(doc, 'span', 'fut-fbadge');
  if (sectionEmpty(profileFor(profiles, o.bodyId), section)) {
    badge.classList.add('empty');
    badge.textContent = t('fleet.rule.empty');
    return badge;
  }
  const on = key ? settings[key] : true;
  badge.classList.add(on ? 'on' : 'off');
  const ids = o.bodies.flatMap((b) => [b.planetId, b.moonId]).filter((x): x is number => x !== null);
  const same = sameSection(profiles, o.bodyId, ids, section);
  const names = same.map((id) => shortName(o, id));
  const where = same.length
    ? t('fleet.rule.alsoOn', { list: names.slice(0, 3).join(', ') + (names.length > 3 ? ` +${names.length - 3}` : '') })
    : t('fleet.rule.onlyHere');
  badge.textContent = `${on ? t('fleet.rule.on') : t('fleet.rule.off')} · ${where}`;
  badge.title = same.length ? `${t('fleet.rule.sameTitle')}\n${names.join('\n')}` : t('fleet.rule.onlyHereTitle');
  return badge;
}

/**
 * A box for one rule: title, where it stands and its switch (global) always in sight; the hint and
 * the fields fold away, open when the rule holds something.
 */
function ruleBox(o: FleetOptions, section: ReserveSection, title: string, hint: string, fields: HTMLElement[], onSwitch: () => void): HTMLElement {
  const { doc, t } = o;
  const box = el(doc, 'details', 'fut-freserve');
  box.open = !sectionEmpty(profileFor(loadProfiles(o.store), o.bodyId), section);
  const head = el(doc, 'summary', 'fut-frulehead');
  const mark = el(doc, 'span', 'fut-fruleico');
  mark.innerHTML = iconSvg(section, 18);
  head.append(iconEl(doc), mark, el(doc, 'h5', '', title), ruleBadge(o, section));
  const key = SWITCH[section];
  if (key) {
    // Same switch as on the fleet bar: one for every planet and moon.
    const wrap = el(doc, 'label', 'fut-fswitch');
    wrap.title = t('fleet.rule.switchHint');
    const input = el(doc, 'input');
    input.type = 'checkbox';
    input.setAttribute('role', 'switch');
    input.setAttribute('aria-label', `${title}: ${t('fleet.rule.switch')}`);
    input.checked = loadSettings(o.store)[key];
    wrap.append(input, el(doc, 'i', 'sw-track'));
    input.addEventListener('change', () => {
      o.store.set(SETTINGS_KEY, { ...loadSettings(o.store), [key]: input.checked });
      // Only the badge changes: the fields may hold edits not saved yet.
      head.querySelector('.fut-fbadge')?.replaceWith(ruleBadge(o, section));
      onSwitch();
    });
    head.append(wrap);
  }
  const inner = el(doc, 'div', 'fut-frulebody');
  inner.append(el(doc, 'p', 'fut-fnote', hint), ...fields);
  box.append(head, inner);
  return box;
}

/** The fold arrow of a rule box. */
function iconEl(doc: Document): HTMLElement {
  const span = el(doc, 'span', 'fold');
  span.innerHTML = iconSvg('caret', 14);
  return span;
}

function reserveEditor(o: FleetOptions, onSaved: (msg: string) => void): HTMLElement {
  const { doc, t } = o;
  const profile = profileFor(loadProfiles(o.store), o.bodyId);
  const moon = isMoon(o.bodies, o.bodyId);
  const panel = el(doc, 'div', 'fut-feditor');
  const refresh = () => onSaved('');

  // Ships and resources are separate rules: either can be switched off alone.
  const ships = shipFields(o, profile.reserve.ships);
  panel.append(ruleBox(o, 'ships', t('fleet.rule.ships'), t('fleet.rule.shipsHint'), [ships.el], refresh));
  const res = resourceFields(o, profile.reserve.resources);
  panel.append(ruleBox(o, 'resources', t('fleet.rule.resources'), t('fleet.rule.resourcesHint'), [res.el], refresh));
  // The jump gate only exists on moons.
  const gate = moon ? shipFields(o, profile.gate) : null;
  if (gate) panel.append(ruleBox(o, 'gate', t('fleet.rule.gate'), t('fleet.rule.gateHint'), [gate.el], refresh));

  // Fleetsave: target plus its own ships and resources to keep; no switch, it ignores the others.
  const saveGrid = el(doc, 'div', 'fut-fgrid wide');
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
  const saveShips = shipFields(o, profile.saveReserve.ships);
  const saveRes = resourceFields(o, profile.saveReserve.resources);
  panel.append(
    ruleBox(o, 'fleetsave', t('fleet.fleetsave'), t('fleet.fleetsaveHint'), [
      saveGrid,
      el(doc, 'h6', '', t('fleet.rule.saveShips')),
      saveShips.el,
      el(doc, 'h6', '', t('fleet.rule.saveResources')),
      saveRes.el,
    ], refresh),
  );

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
    return {
      reserve: { ships: ships.read(), resources: res.read() },
      gate: gate ? gate.read() : profile.gate,
      saveReserve: { ships: saveShips.read(), resources: saveRes.read() },
      save,
    };
  };
  const store = () => {
    const all = loadProfiles(o.store);
    all[String(o.bodyId)] = read();
    o.store.set(PROFILES_KEY, all);
    return all;
  };

  const copyBox = copyPanel(o, moon, (sections, ids) => {
    o.store.set(PROFILES_KEY, copySections(store(), o.bodyId, ids, sections));
    onSaved(t('fleet.copied', { count: ids.length }));
  });
  copyBox.hidden = true;
  const actions = el(doc, 'div', 'fut-factions');
  actions.append(
    button(doc, t('fleet.save'), () => {
      store();
      onSaved(t('fleet.saved'));
    }, 'primary'),
    button(doc, t('fleet.copyTo'), () => {
      copyBox.hidden = !copyBox.hidden;
    }),
  );
  panel.append(copyBox, actions);
  return panel;
}

/**
 * "Copia su…": which rules, onto which bodies. Nothing is preselected; the quick buttons pick
 * all planets or all moons. The other rules of the chosen bodies stay as they are.
 */
function copyPanel(o: FleetOptions, moon: boolean, onCopy: (sections: ReserveSection[], ids: number[]) => void): HTMLElement {
  const { doc, t } = o;
  const box = el(doc, 'div', 'fut-freserve fut-fcopy');
  box.append(el(doc, 'h5', '', t('fleet.copyTitle')), el(doc, 'p', 'fut-fnote', t('fleet.copyHint')));
  const secRow = el(doc, 'div', 'fut-fchecks');
  const sections = RESERVE_SECTIONS.filter((s) => s !== 'gate' || moon).map((s) => {
    const [wrap, input] = checkField(doc, t(s === 'fleetsave' ? 'fleet.fleetsave' : `fleet.rule.${s}`), true);
    secRow.append(wrap);
    return [s, input] as const;
  });
  box.append(el(doc, 'h6', '', t('fleet.copyWhat')), secRow);

  const bodyRow = el(doc, 'div', 'fut-fchecks');
  const targets: [number, boolean, HTMLInputElement][] = [];
  for (const b of o.bodies) {
    for (const [id, isMoonId] of [[b.planetId, false], [b.moonId, true]] as const) {
      if (id === null || id === o.bodyId) continue;
      const [wrap, input] = checkField(doc, `${shortName(o, id)} [${b.coords}]`, false);
      bodyRow.append(wrap);
      targets.push([id, isMoonId, input]);
    }
  }
  const pick = (which: 'planets' | 'moons' | 'none') => {
    for (const [, isMoonId, input] of targets) input.checked = which === 'moons' ? isMoonId : which === 'planets' ? !isMoonId : false;
  };
  const quick = el(doc, 'div', 'fut-factions');
  quick.append(
    button(doc, t('fleet.pickPlanets'), () => pick('planets')),
    button(doc, t('fleet.pickMoons'), () => pick('moons')),
    button(doc, t('fleet.pickNone'), () => pick('none')),
  );
  box.append(el(doc, 'h6', '', t('fleet.copyWhere')), quick, bodyRow);

  const status = el(doc, 'span', 'fut-fnote');
  const go = el(doc, 'div', 'fut-factions');
  go.append(
    button(doc, t('fleet.copyGo'), () => {
      const chosen = sections.filter(([, i]) => i.checked).map(([s]) => s);
      const ids = targets.filter(([, , i]) => i.checked).map(([id]) => id);
      if (!chosen.length || !ids.length) {
        status.textContent = t('fleet.copyNothing');
        return;
      }
      onCopy(chosen, ids);
    }, 'primary'),
    status,
  );
  box.append(go);
  return box;
}

/* ------------------------------------------------------------------ */
/* Bar                                                                 */
/* ------------------------------------------------------------------ */

/** What the rules keep back here right now, rule by rule; switched-off rules are named as such. */
function summary(o: FleetOptions, stored: Required<FleetProfile>, settings: FleetSettings): string {
  const { t } = o;
  const fmt = (n: number) => n.toLocaleString(o.locale);
  const parts: string[] = [];
  const off: string[] = [];
  const ships = Object.values(stored.reserve.ships).reduce((a, b) => a + b, 0);
  if (ships) (settings.shipsOn ? parts.push(`${t('fleet.rule.ships')}: ${fmt(ships)}`) : off.push(t('fleet.rule.ships')));
  const r = stored.reserve.resources;
  if (r.metal || r.crystal || r.deuterium)
    settings.resourcesOn ? parts.push(`${t('fleet.rule.resources')}: ${fmt(r.metal)} / ${fmt(r.crystal)} / ${fmt(r.deuterium)}`) : off.push(t('fleet.rule.resources'));
  if (settings.ignoreFood) parts.push(t('fleet.foodShort'));
  const text = parts.length ? `${t('fleet.reserve')}: ${parts.join(' · ')}` : t('fleet.noReserve');
  return off.length ? `${text} · ${t('fleet.rule.offList', { list: off.join(', ') })}` : text;
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
 * Opens this planet's or moon's rules over the page (reserves, jump gate, fleetsave), in a Shadow
 * DOM so the game's CSS cannot restyle our fields. The general fleet settings and the keys are in
 * Future's settings window.
 */
function openSettings(o: FleetOptions, _tab: 'body', onChange: () => void): void {
  const { doc, t } = o;
  closeModal(doc);
  const host = el(doc, 'div');
  host.id = MODAL_ID;
  const root = host.attachShadow({ mode: 'open' });
  const style = el(doc, 'style');
  style.textContent = WINDOW_SHEET + MODAL_CSS;
  const backdrop = el(doc, 'div', 'backdrop');
  const panel = el(doc, 'div', 'panel');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', t('fleet.settingsTitle'));
  const head = el(doc, 'div', 'head');
  const status = el(doc, 'span', 'sub status');
  status.setAttribute('role', 'status');
  const body = el(doc, 'div', 'body');
  const show = () => {
    // A message means something was saved or copied: redraw so every rule shows where it stands now.
    const saved = (msg: string) => {
      onChange();
      if (msg) {
        const top = backdrop.scrollTop;
        show();
        backdrop.scrollTop = top;
      }
      status.textContent = msg;
    };
    body.replaceChildren(reserveEditor(o, saved));
  };
  const close = el(doc, 'button', 'close');
  close.type = 'button';
  close.setAttribute('aria-label', t('fleet.close'));
  close.addEventListener('click', () => closeModal(doc));
  close.append(icon(doc, 'close', 16));
  const titles = el(doc, 'div', 'titles');
  titles.append(el(doc, 'h2', '', t(isMoon(o.bodies, o.bodyId) ? 'fleet.editTitleMoon' : 'fleet.editTitlePlanet', { body: bodyLabel(o, o.bodyId) })), status);
  head.append(titles, close);
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
  show();
  close.focus();
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

/**
 * The line that speaks for the icon-only bar: what happened last (role=status) and, while the
 * pointer or the focus is on a control, what that control does.
 */
function readout(doc: Document, text: string) {
  const box = el(doc, 'span', 'fut-fread');
  const tip = el(doc, 'span', 'tip');
  tip.setAttribute('aria-hidden', 'true');
  const info = el(doc, 'span', 'fut-finfo', text);
  info.setAttribute('role', 'status');
  box.append(tip, info);
  const clear = () => tip.replaceChildren();
  return {
    box,
    say(msg: string, err = false) {
      clear();
      info.textContent = msg;
      info.classList.toggle('err', err);
    },
    peek(node: HTMLElement, name: string, detail: string) {
      const show = () => tip.replaceChildren(el(doc, 'b', '', name), doc.createTextNode(detail ? ` ${detail}` : ''));
      node.addEventListener('mouseenter', show);
      node.addEventListener('focus', show);
      node.addEventListener('mouseleave', clear);
      node.addEventListener('blur', clear);
    },
  };
}

/** An action of the bar: its icon alone, the key in the corner; the name is its accessible label. */
function tile(doc: Document, icon: IconName, label: string, onClick: () => void, cls = '', key = ''): HTMLButtonElement {
  const b = el(doc, 'button', `fut-fact ${cls}`.trim());
  b.type = 'button';
  b.title = key ? `${label} [${keyLabel(key)}]` : label;
  b.setAttribute('aria-label', label);
  const ico = el(doc, 'span', 'ico');
  ico.innerHTML = iconSvg(icon, 22);
  b.append(ico);
  if (key) {
    const cap = el(doc, 'kbd', '', keyLabel(key));
    cap.setAttribute('aria-hidden', 'true');
    b.append(cap);
  }
  b.addEventListener('click', (e) => {
    e.preventDefault();
    onClick();
  });
  return b;
}

/** A rule switch: the rule's icon and a small track, knob to the right and lit when on. */
function ruleSwitch(doc: Document, icon: IconName, label: string, on: boolean, onClick: () => void): HTMLButtonElement {
  const b = el(doc, 'button', 'fut-fsw');
  b.type = 'button';
  b.title = label;
  b.setAttribute('role', 'switch');
  b.setAttribute('aria-checked', String(on));
  b.setAttribute('aria-label', label);
  const ico = el(doc, 'span', 'ico');
  ico.innerHTML = iconSvg(icon, 16);
  b.append(ico, el(doc, 'i', 'track'));
  b.addEventListener('click', (e) => {
    e.preventDefault();
    onClick();
  });
  return b;
}

/**
 * A small button on each ship of the game's page 1, as OGLight has: it inverts that ship's
 * selection (100 of 5,000 picked becomes 4,900). Typed into the game's own field, so the game
 * recounts cargo and fuel itself. No request, no send.
 */
function addInvertButtons(o: FleetOptions): void {
  const { doc, t } = o;
  for (const slot of readShipSlots(doc)) {
    const tile = slot.input.closest('li');
    if (!tile || !slot.available || tile.querySelector('.fut-finv')) continue;
    const b = el(doc, 'button', 'fut-finv');
    b.type = 'button';
    b.title = t('fleet.invert');
    b.setAttribute('aria-label', `${t('fleet.invert')}: ${slot.name}`);
    b.innerHTML = iconSvg('invert', 12);
    b.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      // Read now, not when the button was drawn: the amount changes as fleets leave and land.
      const available = Number(tile.querySelector<HTMLElement>('.amount')?.dataset.value ?? 0) || 0;
      const picked = Math.min(available, parseAmount(slot.input.value));
      typeInto(slot.input, available - picked || '');
    });
    tile.append(b);
  }
}

/** Shows `menu` under `anchor`, on <body> with fixed position, and closes it on a click away or a page scroll. */
function popup(doc: Document, anchor: HTMLElement, menu: HTMLElement): void {
  doc.querySelectorAll('.fut-fmenu').forEach((n) => n.remove());
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
  // Its own list scrolls with the wheel; only a scroll of the page behind closes it.
  const onScroll = (e: Event) => {
    if (e.target instanceof Node && menu.contains(e.target)) return;
    menu.remove();
    doc.defaultView?.removeEventListener('scroll', onScroll, true);
  };
  doc.defaultView?.addEventListener('scroll', onScroll, true);
}

/** One row per position: the planet on the left, its moon on the right. */
function bodyGrid(o: FleetOptions, menu: HTMLElement, current: number | null, onPick: (id: number) => void, allowHere = false): HTMLElement[] {
  const { doc } = o;
  const cell = (id: number | null, moon: boolean, b: FleetBody) => {
    if (id === null) return el(doc, 'span');
    const item = button(doc, moon ? '' : b.name, () => {
      menu.remove();
      onPick(id);
    }, `${moon ? 'moon' : 'planet'}${id === current ? ' on' : ''}`);
    if (moon) item.innerHTML = iconSvg('moon', 14);
    else item.append(el(doc, 'small', '', b.coords));
    item.setAttribute('aria-label', `${b.name}${moon ? ` (${o.t('fleet.typeMoon')})` : ''} [${b.coords}]`);
    if (moon) item.title = `${b.name} (${o.t('fleet.typeMoon')})`;
    if (id === current) item.setAttribute('aria-current', 'true');
    // Where the fleet leaves from cannot be where it goes.
    item.disabled = !allowHere && id === o.bodyId;
    return item;
  };
  return o.bodies.flatMap((b) => [cell(b.planetId, false, b), cell(b.moonId, true, b)]);
}

/** Small list to pick an own planet or moon. */
function destinationMenu(o: FleetOptions, anchor: HTMLElement, current: number | null, onPick: (id: number) => void): void {
  const menu = el(o.doc, 'div', 'fut-fmenu');
  menu.append(...bodyGrid(o, menu, current, onPick));
  popup(o.doc, anchor, menu);
}

/**
 * "Raccolta spedizioni": the two collection sends towards the favourite (transport, then deploy,
 * both with the reserves), and the same once towards another body.
 */
function collectMenu(
  o: FleetOptions,
  anchor: HTMLElement,
  settings: FleetSettings,
  keys: { transport: string; deploy: string },
  run: (mode: 'collect' | 'collectDeploy', dest: number | null) => void,
): void {
  const { doc, t } = o;
  const menu = el(doc, 'div', 'fut-fmenu fut-fcollect');
  menu.setAttribute('role', 'menu');
  menu.append(el(doc, 'p', 'fut-fmhead', t('fleet.btn.collect')));
  const main = (mode: 'collect' | 'collectDeploy', ico: IconName, label: string, fav: number | null, key: string) => {
    const b = button(doc, '', () => {
      menu.remove();
      run(mode, fav);
    }, 'fut-fmain');
    b.setAttribute('role', 'menuitem');
    const i = el(doc, 'span', 'ico');
    i.innerHTML = iconSvg(ico, 18);
    const text = el(doc, 'span', 'txt');
    text.append(el(doc, 'b', '', label), el(doc, 'span', '', fav ? `→ ${shortLabel(o, fav)}` : t('fleet.collectNoFav')));
    b.append(i, text);
    if (key) b.append(el(doc, 'kbd', '', keyLabel(key)));
    if (!fav) b.classList.add('dim');
    return b;
  };
  menu.append(
    main('collect', 'transport', t('fleet.collect.transport'), settings.favTransport, keys.transport),
    main('collectDeploy', 'deploy', t('fleet.collect.deploy'), settings.favDeploy, keys.deploy),
  );
  // Once towards another body: which of the two, then where.
  let mode: 'collect' | 'collectDeploy' = 'collect';
  const seg = el(doc, 'div', 'fut-fseg');
  seg.setAttribute('role', 'group');
  seg.setAttribute('aria-label', t('fleet.collectOnce'));
  const segBtn = (m: typeof mode, label: string) => {
    const b = button(doc, label, () => {
      mode = m;
      seg.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    });
    b.setAttribute('aria-pressed', String(m === mode));
    return b;
  };
  seg.append(segBtn('collect', t('fleet.collect.transport')), segBtn('collectDeploy', t('fleet.collect.deploy')));
  menu.append(el(doc, 'p', 'fut-fmsub', t('fleet.collectOnce')), seg);
  menu.append(...bodyGrid(o, menu, null, (id) => run(mode, id)));
  popup(doc, anchor, menu);
}

/** The typed destination as a game target: empty galaxy/system = the origin's; named when it is an own body. */
function sendTargetOf(o: FleetOptions, t: SendTarget | null, origin: { galaxy: number; system: number }): Target | null {
  if (!t || !(t.position >= 1 && t.position <= 17)) return null;
  const r = resolveSend(t, origin);
  const b = o.bodies.find((x) => x.coords === `${r.galaxy}:${r.system}:${r.position}`);
  return { ...r, name: b?.name };
}

/** Cargo ships offered by CL / CP: small and large cargo. */
const SEND_CARGO = [202, 203] as const;

/**
 * Page 1 panel of the plain Trasporto / Schiera, shown while one of the two is on: where to
 * (galaxy, system, position; empty galaxy/system = this body's; the arrow picks an own body),
 * planet or moon, the resources to bring (empty = all, 0 = none), and CL / CP, which prepare
 * the fleet with as many small or large cargo ships as those resources need. Kept between pages.
 */
function sendPanel(
  o: FleetOptions,
  peek: (node: HTMLElement, name: string, detail: string) => void,
  onCargo: (ship: number) => void,
): HTMLElement {
  const { doc, t } = o;
  const settings = loadSettings(o.store);
  const save = (part: Partial<FleetSettings>) => o.store.set(SETTINGS_KEY, { ...loadSettings(o.store), ...part });
  const origin = originCoords(doc);
  const panel = el(doc, 'div', 'fut-fsend');
  panel.setAttribute('role', 'group');
  panel.setAttribute('aria-label', t('fleet.send.label'));

  // Destination: galaxy, system, position; the list of own bodies; planet or moon.
  const st = settings.sendTarget;
  let type: 1 | 3 = st?.type ?? 1;
  const coordIn = (label: string, ph: string, v: number | null | undefined, cls: string) => {
    const input = el(doc, 'input', `fut-fin ${cls}`);
    input.type = 'text';
    input.inputMode = 'numeric';
    input.placeholder = ph;
    input.value = v ? String(v) : '';
    input.setAttribute('aria-label', label);
    input.title = label;
    isolate(input);
    return input;
  };
  const gIn = coordIn(t('fleet.galaxy'), origin ? String(origin.galaxy) : 'G', st?.galaxy, 'g');
  const sIn = coordIn(t('fleet.system'), origin ? String(origin.system) : 'S', st?.system, 's');
  const pIn = coordIn(t('fleet.position'), 'P', st?.position, 'p');
  const typeSeg = el(doc, 'span', 'fut-fseg');
  typeSeg.setAttribute('role', 'group');
  typeSeg.setAttribute('aria-label', t('fleet.type'));
  const showType = () => typeSeg.querySelectorAll<HTMLElement>('button').forEach((x) => x.setAttribute('aria-pressed', String(Number(x.dataset.type) === type)));
  const store = () => {
    const num = (i: HTMLInputElement) => parseAmount(i.value) || null;
    const position = num(pIn) ?? 0;
    pIn.classList.toggle('bad', Boolean(pIn.value.trim()) && !(position >= 1 && position <= 17));
    const empty = !gIn.value.trim() && !sIn.value.trim() && !pIn.value.trim();
    save({ sendTarget: empty ? null : { galaxy: num(gIn), system: num(sIn), position, type } });
  };
  const fill = (g: number, sys: number, pos: number) => {
    gIn.value = String(g);
    sIn.value = String(sys);
    pIn.value = String(pos);
  };
  for (const input of [gIn, sIn, pIn]) {
    input.addEventListener('input', () => {
      // "1:234:5" pasted or typed in any field fills all three.
      const c = /\D/.test(input.value.trim()) ? parseCoords(input.value) : null;
      if (c) fill(c[0], c[1], c[2]);
      store();
    });
  }
  const typeBtn = (v: 1 | 3, ico: IconName, label: string) => {
    const b = el(doc, 'button', 'fut-ftype');
    b.type = 'button';
    b.dataset.type = String(v);
    b.title = label;
    b.setAttribute('aria-label', label);
    b.innerHTML = iconSvg(ico, 15);
    b.addEventListener('click', (e) => {
      e.preventDefault();
      type = v;
      showType();
      store();
    });
    return b;
  };
  typeSeg.append(typeBtn(1, 'planet', t('fleet.typePlanet')), typeBtn(3, 'moon', t('fleet.typeMoon')));
  showType();
  const dest = el(doc, 'span', 'fut-fdest');
  const pick = el(doc, 'button', 'fut-fpick');
  pick.type = 'button';
  pick.setAttribute('aria-label', t('fleet.send.pick'));
  pick.setAttribute('aria-haspopup', 'menu');
  pick.innerHTML = iconSvg('caret', 14);
  peek(pick, t('fleet.send.pick'), t('fleet.send.pickHint'));
  pick.addEventListener('click', (e) => {
    e.preventDefault();
    destinationMenu(o, dest, null, (id) => {
      const tg = bodyTarget(o.bodies, id);
      if (!tg) return;
      fill(tg.galaxy, tg.system, tg.position);
      type = tg.type === 3 ? 3 : 1;
      showType();
      store();
    });
  });
  const sep = () => el(doc, 'span', 'colon', ':');
  dest.append(gIn, sep(), sIn, sep(), pIn, pick, typeSeg);
  for (const input of [gIn, sIn, pIn]) peek(input, t('fleet.send.dest'), t('fleet.send.destHint'));

  // Resources: each with its symbol; empty = all, a number = at most that much (k / m / g understood).
  const res = el(doc, 'span', 'fut-fres');
  const inputs = (['metal', 'crystal', 'deuterium'] as const).map((k) => {
    const wrap = el(doc, 'span', `fut-fresin ${k}`);
    // The symbol is a button: it fills the field with all of that resource here.
    const sym = el(doc, 'button', 'sym');
    sym.type = 'button';
    sym.innerHTML = iconSvg(k, 18);
    sym.setAttribute('aria-label', `${t(`res.${k}`)}: ${t('fleet.send.max')}`);
    peek(sym, t(`res.${k}`), t('fleet.send.maxHint'));
    const input = el(doc, 'input', 'fut-fin amount');
    input.type = 'text';
    input.inputMode = 'numeric';
    input.placeholder = '0';
    input.setAttribute('aria-label', t(`res.${k}`));
    const v = settings.sendPick[k];
    input.value = v === null ? '' : v.toLocaleString(o.locale);
    isolate(input);
    wrap.append(sym, input);
    res.append(wrap);
    peek(input, t(`res.${k}`), t('fleet.send.resHint'));
    return [k, input] as const;
  });
  const readPick = (): ResourcePick => {
    const out: ResourcePick = { metal: null, crystal: null, deuterium: null };
    for (const [k, input] of inputs) out[k] = input.value.trim() ? parseAmount(input.value) : null;
    return out;
  };
  const clear = el(doc, 'button', 'fut-fclear');
  clear.type = 'button';
  clear.textContent = t('fleet.send.clearBtn');
  peek(clear, t('fleet.send.clearBtn'), t('fleet.send.clearHint'));
  res.append(clear);

  // CL / CP: how many of each the resources need, recounted while typing (fuel is added when preparing).
  const cargoBox = el(doc, 'span', 'fut-fcargo');
  const counts = new Map<number, HTMLElement>();
  for (const id of SEND_CARGO) {
    const b = el(doc, 'button', 'fut-fcl');
    b.type = 'button';
    const short = t(id === 202 ? 'fleet.send.small' : 'fleet.send.large');
    const full = t(`ship.${id}`);
    b.setAttribute('aria-label', `${t('fleet.send.cargoWith')} ${full}`);
    const n = el(doc, 'small', 'n');
    b.append(el(doc, 'b', '', short), n);
    counts.set(id, n);
    peek(b, `${short} · ${full}`, t('fleet.send.cargoHint'));
    b.addEventListener('click', (e) => {
      e.preventDefault();
      onCargo(id);
    });
    cargoBox.append(b);
  }
  const recount = () => {
    const fd = getDispatcher();
    for (const [id, n] of counts) {
      if (!fd) {
        n.textContent = '';
        continue;
      }
      const have = shipsOnPlanet(fd)[String(id)] ?? 0;
      const cap = shipCapacityOf(fd, id);
      const w = pickedLoad({ metal: fd.metalOnPlanet, crystal: fd.crystalOnPlanet, deuterium: fd.deuteriumOnPlanet }, readPick(), 0, Number.MAX_SAFE_INTEGER);
      const need = cap > 0 ? Math.ceil((w.metal + w.crystal + w.deuterium) / cap) : 0;
      n.textContent = have ? `×${Math.min(need, have).toLocaleString(o.locale)}` : '0';
      n.parentElement?.classList.toggle('short', need > have);
      n.parentElement?.classList.toggle('none', !have);
    }
  };
  for (const [k, input] of inputs) {
    input.addEventListener('input', () => {
      save({ sendPick: readPick() });
      recount();
    });
    input.parentElement?.querySelector('.sym')?.addEventListener('click', (e) => {
      e.preventDefault();
      const fd = getDispatcher();
      if (!fd) return;
      const have = { metal: fd.metalOnPlanet, crystal: fd.crystalOnPlanet, deuterium: fd.deuteriumOnPlanet }[k];
      // All of it: the flight's fuel is kept back when loading.
      input.value = Math.max(0, Math.floor(have || 0)).toLocaleString(o.locale);
      save({ sendPick: readPick() });
      recount();
    });
  }
  clear.addEventListener('click', (e) => {
    e.preventDefault();
    for (const [, input] of inputs) input.value = '';
    save({ sendPick: readPick() });
    recount();
  });
  recount();
  void whenDispatcherReady().then(recount);

  const label = (text: string) => el(doc, 'span', 'lbl', text);
  panel.append(label(t('fleet.send.dest')), dest, label(t('fleet.send.res')), res, cargoBox);
  return panel;
}

/**
 * The game's own Trasporto / Schiera links (galaxy view, planet menu) open the fleet page with the
 * target in the URL: mission 3 or 4, galaxy, system, position, type. Read once per page.
 */
export function readMissionLink(href: string): { mode: 'transport' | 'deploy'; target: SendTarget } | null {
  let p: URLSearchParams;
  try {
    p = new URL(href).searchParams;
  } catch {
    return null;
  }
  if (p.get('futmode')) return null;
  const mission = Number(p.get('mission'));
  const mode = mission === 3 ? 'transport' : mission === 4 ? 'deploy' : null;
  const [g, sys, pos] = ['galaxy', 'system', 'position'].map((k) => Number(p.get(k)));
  if (!mode || !(g! > 0) || !(sys! > 0) || !(pos! >= 1 && pos! <= 17)) return null;
  return { mode, target: { galaxy: g!, system: sys!, position: pos!, type: p.get('type') === '3' ? 3 : 1 } };
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
  // Opened from the galaxy's Trasporto / Schiera: that mode on, its target typed, the panel open.
  // Only fills our fields (no request, nothing selected); once per page so a redraw keeps the player's edits.
  const link = readMissionLink(href);
  let focusRes = false;
  if (link && !doc.documentElement.dataset.futMissionLink) {
    doc.documentElement.dataset.futMissionLink = '1';
    o.store.set(SETTINGS_KEY, { ...loadSettings(o.store), sendMode: link.mode, sendTarget: link.target });
    focusRes = true;
  }
  const settings = loadSettings(o.store);
  const stored = profileFor(loadProfiles(o.store), o.bodyId);
  // Switched-off rules are kept in the settings, not applied. The fleetsave's own reserve always is.
  const profile = activeProfile(stored, settings);
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

  const out = readout(doc, summary(o, stored, settings));
  const say = out.say;
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
    collect: (dest) =>
      withDispatcher((fd) => {
        const target = dest ? bodyTarget(o.bodies, dest) : null;
        if (!dest || !target) return say(t('fleet.err.noDest'), true);
        begin('collect', dest);
        report(prepareTransport(fd, doc, profile, settings, target), 'fleet.ok.cargo');
      }),
    collectDeploy: (dest) =>
      withDispatcher((fd) => {
        const target = dest ? bodyTarget(o.bodies, dest) : null;
        if (!dest || !target) return say(t('fleet.err.noDest'), true);
        begin('collectDeploy', dest);
        report(prepareDeploy(fd, doc, profile, settings, target), 'fleet.ok.cargo');
      }),
    // Plain game actions: destination and resources from the row on page 1, read when pressed.
    // Plain game actions: a switch that stays on; CL / CP below then prepare the fleet.
    transport: () => toggleSend('transport'),
    deploy: () => toggleSend('deploy'),
    expedition: () =>
      withDispatcher((fd) => {
        begin('expedition');
        const r = prepareExpedition(fd, doc, profile, settings, {
          economySpeed: universeSpeed(doc),
          lfBooster: o.store.get<LfBonuses | null>(LF_BONUS_KEY, null)?.expedition ?? 0,
          itemBoost: expeditionItemBoost(o.store.get<ActiveItems | null>(ITEMS_KEY, null)),
        });
        report(r, 'fleet.ok.expedition', { target: r.target.toLocaleString(o.locale) });
      }),
    fleetsave: () =>
      withDispatcher((fd) => {
        if (!profile.save) return say(t('fleet.err.noFleetsave'), true);
        begin('fleetsave');
        report(prepareFleetsave(fd, doc, profile, profile.save), 'fleet.ok.cargo');
      }),
    plan: (dest) =>
      withDispatcher((fd) => {
        const delivery = o.store.get<Delivery | null>(DELIVERY_KEY, null);
        const target = dest ? bodyTarget(o.bodies, dest) : null;
        if (!delivery || !dest || delivery.target !== dest || !target) return say(t('fleet.err.noDelivery'), true);
        begin('plan', dest);
        const r = prepareDelivery(fd, doc, profile, settings, target, delivery.need);
        const left = delivery.need.metal + delivery.need.crystal + delivery.need.deuterium;
        report(r, 'fleet.ok.delivery', { left: left.toLocaleString(o.locale) });
      }),
    last: () =>
      withDispatcher((fd) => {
        const last = o.store.get<LastFleet | null>(LAST_FLEET_KEY, null);
        if (!last) return say(t('fleet.err.noLast'), true);
        begin('last');
        report(prepareLast(fd, doc, profile, last), 'fleet.ok.ships');
      }),
  };
  function toggleSend(mode: 'transport' | 'deploy'): void {
    const now = loadSettings(o.store);
    const next = now.sendMode === mode ? null : mode;
    o.store.set(SETTINGS_KEY, { ...now, sendMode: next });
    redraw();
    if (next) say(t(next === 'transport' ? 'fleet.send.onTransport' : 'fleet.send.onDeploy'));
    doc.querySelector<HTMLInputElement>('.fut-fsend .fut-fin.p')?.focus();
  }
  function sendWith(ship: number): void {
    withDispatcher((fd) => {
      const now = loadSettings(o.store);
      if (!now.sendMode) return;
      const target = sendTargetOf(o, now.sendTarget, fd.currentPlanet);
      if (!target) return say(t('fleet.err.noTarget'), true);
      const c = fd.currentPlanet;
      if (c.galaxy === target.galaxy && c.system === target.system && c.position === target.position && (c.type ?? 1) === target.type)
        return say(t('fleet.err.sameBody'), true);
      begin(now.sendMode);
      const r = prepareSend(fd, doc, now, target, now.sendPick, now.sendMode, ship);
      if (r.ok && r.missing > 0)
        return say(t('fleet.ok.cargoShort', { ships: r.ships.toLocaleString(o.locale), cargo: r.cargo.toLocaleString(o.locale), missing: r.missing.toLocaleString(o.locale) }), true);
      report(r, 'fleet.ok.cargo');
    });
  }
  const favRun = {
    collect: () => (settings.favTransport ? run.collect(settings.favTransport) : say(t('fleet.err.noDefault'), true)),
    collectDeploy: () => (settings.favDeploy ? run.collectDeploy(settings.favDeploy) : say(t('fleet.err.noDefault'), true)),
  };

  if (fleet1 && anchor1) {
    const bar = el(doc, 'div', 'fut-fbar');
    const keys = keymap(o.store);
    const k = (id: string) => keys.get(id) ?? '';
    const tiles = el(doc, 'div', 'fut-facts');
    tiles.setAttribute('role', 'group');
    tiles.setAttribute('aria-label', t('fleet.actionsLabel'));
    const here = o.bodies.find((b) => b.planetId === o.bodyId);
    /** One action: icon-only tile, described in the readout while pointed at. */
    const act = (ico: IconName, id: string, name: string, where: string, tip: string, onClick: () => void, dim = false) => {
      const b = tile(doc, ico, where ? `${name} ${where}` : name, onClick, dim ? 'dim' : '', k(id));
      out.peek(b, where ? `${name} ${where}` : name, tip);
      return b;
    };
    const to = (id: number | null) => `→ ${shortLabel(o, id)}`;
    const last = o.store.get<LastFleet | null>(LAST_FLEET_KEY, null);
    // Collection of the expeditions: a secondary tool, its two sends behind one tile.
    const collect = tile(doc, 'collect', t('fleet.btn.collect'), () =>
      collectMenu(o, collect, settings, { transport: k('fleet.collect'), deploy: k('fleet.collectDeploy') }, (mode, dest) =>
        dest ? run[mode](dest) : say(t('fleet.err.noDefault'), true),
      ), 'more');
    collect.setAttribute('aria-haspopup', 'menu');
    collect.append(el(doc, 'i', 'more-mark'));
    out.peek(collect, t('fleet.btn.collect'), t('fleet.tip.collect'));
    tiles.append(
      ...(['transport', 'deploy'] as const).map((m) => {
        const b = act(m, `fleet.${m}`, t(`fleet.btn.${m}`), '', t(`fleet.tip.${m}`), () => run[m]());
        b.setAttribute('aria-pressed', String(settings.sendMode === m));
        return b;
      }),
      act('expedition', 'fleet.expedition', t('fleet.btn.expedition'), '', t('fleet.tip.expedition'), () => run.expedition()),
      act(
        'fleetsave',
        'fleet.fleetsave',
        t('fleet.btn.fleetsave'),
        profile.save ? `→ ${profile.save.galaxy ?? '·'}:${profile.save.system ?? '·'}:${profile.save.position}` : '',
        profile.save ? t('fleet.tip.fleetsave') : t('fleet.err.noFleetsave'),
        () => (profile.save ? run.fleetsave() : openSettings(o, 'body', redraw)),
        !profile.save,
      ),
      act('last', 'fleet.last', t('fleet.btn.last'), '', last ? t('fleet.tip.last') : t('fleet.err.noLast'), () => run.last(), !last),
    );
    const secondary = el(doc, 'span', 'fut-fsecond');
    if (here?.moonId) secondary.append(act('moon', 'fleet.moon', t('fleet.btn.moon'), to(here.moonId), t('fleet.tip.moon'), () => run.moon()));
    secondary.append(collect);
    tiles.append(secondary);
    // Same actions on their keys and in the touch bar, like OGLight (one key = one prepared fleet, never a send).
    registerActions(doc, o.store, t, {
      ...(here?.moonId ? { 'fleet.moon': () => run.moon() } : {}),
      'fleet.transport': () => run.transport(),
      'fleet.deploy': () => run.deploy(),
      'fleet.collect': favRun.collect,
      'fleet.collectDeploy': favRun.collectDeploy,
      'fleet.expedition': () => run.expedition(),
      'fleet.fleetsave': () => run.fleetsave(),
      'fleet.last': () => run.last(),
    });

    // Rules: what the actions keep back, one switch each.
    const rules = el(doc, 'div', 'fut-frules');
    rules.setAttribute('role', 'group');
    rules.setAttribute('aria-label', t('fleet.rulesLabel'));
    type Flag = 'shipsOn' | 'resourcesOn' | 'gateOn' | 'ignoreFood' | 'repeat';
    const sw = (ico: IconName, label: string, hint: string, key: Flag, after?: () => void) => {
      const b = ruleSwitch(doc, ico, label, settings[key], () => {
        o.store.set(SETTINGS_KEY, { ...loadSettings(o.store), [key]: !loadSettings(o.store)[key] });
        after?.();
        redraw();
      });
      out.peek(b, `${label}: ${settings[key] ? t('fleet.on') : t('fleet.off')}.`, hint);
      return b;
    };
    rules.append(
      sw('ships', t('fleet.rule.ships'), t('fleet.rule.shipsHint'), 'shipsOn'),
      sw('resources', t('fleet.rule.resources'), t('fleet.rule.resourcesHint'), 'resourcesOn'),
      ...(isMoon(o.bodies, o.bodyId) ? [sw('gate', t('fleet.rule.gate'), t('fleet.rule.gateHint'), 'gateOn')] : []),
      sw('food', t('fleet.foodShort'), t('fleet.foodHint'), 'ignoreFood', () => applyFood(o.store)),
      sw('repeat', t('fleet.repeatShort'), t('fleet.repeatHint'), 'repeat'),
    );

    // The editors: this body's rules, and Future's general fleet settings.
    const edit = el(doc, 'span', 'fut-fedit');
    const tool = (ico: IconName, label: string, hint: string, onClick: () => void, cls = '') => {
      const b = el(doc, 'button', `fut-ftool ${cls}`.trim());
      b.type = 'button';
      b.title = label;
      b.setAttribute('aria-label', label);
      b.innerHTML = iconSvg(ico, 18);
      b.addEventListener('click', (e) => {
        e.preventDefault();
        onClick();
      });
      out.peek(b, label, hint);
      return b;
    };
    edit.append(tool('rules', t('fleet.editRules', { body: shortLabel(o, o.bodyId) }), t('fleet.editRulesHint'), () => openSettings(o, 'body', redraw), 'fut-frules-open'));
    if (o.onOpenSettings) edit.append(tool('settings', t('fleet.general'), t('fleet.generalHint'), () => o.onOpenSettings?.()));

    const top = el(doc, 'div', 'fut-frow');
    top.append(tiles, edit);
    const bottom = el(doc, 'div', 'fut-frow');
    bottom.append(rules, out.box);
    bar.append(top);
    if (settings.sendMode) bar.append(sendPanel(o, out.peek, sendWith));
    if (focusRes) doc.querySelector<HTMLInputElement>('.fut-fsend .fut-fresin.metal input')?.focus();
    bar.append(bottom);
    anchor1.before(bar);
    addInvertButtons(o);
  }

  if (fleet2 && anchor2) {
    const bar = el(doc, 'div', 'fut-fbar');
    const out2 = readout(doc, summary(o, stored, settings));
    const load = tile(doc, 'cargo', t('fleet.resMinusReserve'), () => {
      const fd = getDispatcher();
      if (!fd) return;
      out2.say(t('fleet.resLoaded', { cargo: loadCargoNow(fd, profile).toLocaleString(o.locale) }));
    });
    out2.peek(load, t('fleet.resMinusReserve'), t('fleet.tip.cargo'));
    const row = el(doc, 'div', 'fut-frow');
    row.append(load, out2.box);
    bar.append(row);
    anchor2.before(bar);
  }
  // Touch bar on both pages (Avanti / Invia), even when no action is on a key here.
  registerActions(doc, o.store, t, {});

  void whenDispatcherReady().then((fd) => {
    if (!fd) return;
    applyFood(o.store, fd);
    // Names and capacities for the inbox summaries (spy loot, ships found): kept locally.
    const ships = readShipsInfo(fd);
    if (ships) o.store.set(SHIPS_INFO_KEY, ships);
    // "Ripeti": know when the game accepted the send, and move on as OGLight does.
    hookSend(fd, () => {
      // Remember what was sent, for "Ultima flotta".
      try {
        o.store.set(LAST_FLEET_KEY, snapshotFleet(fd));
        recordShipment(o, fd);
      } catch {
        /* storage full or blocked: the send itself is unaffected */
      }
      const current = pageState.get(doc);
      if (current?.active?.mode === 'plan') {
        // Planner delivery: count what left, go on while something is still missing.
        const d = current.o.store.get<Delivery | null>(DELIVERY_KEY, null);
        if (!d) return false;
        const need = {
          metal: Math.max(0, d.need.metal - fd.cargoMetal),
          crystal: Math.max(0, d.need.crystal - fd.cargoCrystal),
          deuterium: Math.max(0, d.need.deuterium - fd.cargoDeuterium),
        };
        const done = need.metal + need.crystal + need.deuterium <= 0;
        current.o.store.set(DELIVERY_KEY, done ? null : { ...d, need });
        if (done) return false;
        const nextBody = nextInRound(current.active, current.o.bodyId, current.o.bodies);
        if (nextBody === null) return false;
        navigate(repeatUrl(href, nextBody, current.active));
        return true;
      }
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
        if (incoming.mode === 'collect' || incoming.mode === 'collectDeploy' || incoming.mode === 'plan') run[incoming.mode](incoming.dest);
        else run[incoming.mode]();
      };
      if (doc.readyState === 'complete') setTimeout(go, 0);
      else doc.defaultView?.addEventListener('load', () => setTimeout(go, 0), { once: true });
    }
  });
}

/**
 * Resources sent to a body that has a construction plan are marked as sent in the planner,
 * whether they left from "Porta qui le risorse" or from any other transport.
 */
function recordShipment(o: FleetOptions, fd: FleetDispatcher): void {
  if (fd.mission !== 3 && fd.mission !== 4) return;
  const cargo = { metal: Math.floor(fd.cargoMetal || 0), crystal: Math.floor(fd.cargoCrystal || 0), deuterium: Math.floor(fd.cargoDeuterium || 0) };
  if (cargo.metal + cargo.crystal + cargo.deuterium <= 0) return;
  const tp = fd.targetPlanet;
  const coords = `${tp.galaxy}:${tp.system}:${tp.position}`;
  const body = o.bodies.find((b) => b.coords === coords);
  const target = body ? (tp.type === 3 ? body.moonId : body.planetId) : null;
  if (!target) return;
  const plan = o.store.get<Plan>(PLAN_KEY, {});
  if (!plan[String(target)]?.length) return;
  const seconds = Number((fd as { getDuration?: () => number }).getDuration?.()) || 0;
  const now = Date.now();
  const list = o.store.get<Shipment[]>(SENT_KEY, []);
  o.store.set(SENT_KEY, [...list, { target, cargo, sentAt: now, arriveAt: now + Math.max(0, seconds) * 1000 }]);
}

const initialFood = new WeakMap<FleetDispatcher, number>();

/**
 * "Ignora cibo", as OGLight's limiter does: the game sees no food on the planet, so neither
 * our buttons nor the game's own "max" ones load it. Switching it off gives it back.
 */
export function applyFood(store: Store, fd: FleetDispatcher | null = getDispatcher()): void {
  if (!fd) return;
  const f = fd as FleetDispatcher & { foodOnPlanet?: number; cargoFood?: number };
  if (f.foodOnPlanet === undefined) return;
  if (!initialFood.has(fd)) initialFood.set(fd, f.foodOnPlanet);
  const ignore = loadSettings(store).ignoreFood;
  f.foodOnPlanet = ignore ? 0 : (initialFood.get(fd) ?? f.foodOnPlanet);
  if (ignore) f.cargoFood = 0;
  try {
    fd.refresh();
  } catch {
    /* refresh is cosmetic here */
  }
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
