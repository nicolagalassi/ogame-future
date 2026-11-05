/**
 * Fleet page helpers on the game's own fleet dispatch form:
 * - Reserves per planet (ships and resources to always leave home), copyable to all planets.
 * - "Navi − riserva" / "Risorse − riserva": fill the game's inputs, leaving the reserve.
 * - Fleetsave per planet, as in PrOGect: empty galaxy/system = the origin's.
 * - Typing only the position fills galaxy and system from the origin when they are empty.
 *
 * COMPLIANCE: every button fills the game's form once, on a real click, and never sends:
 * the player still presses the game's own "Avanti" and "Invia flotta" (AGENTS.md §1).
 * The only request that can follow is the game's own target check, which the game makes
 * whenever the target changes, exactly as when the player types it.
 */
import type { Store } from '../../core/storage';
import {
  copyProfileToAll,
  parseAmount,
  PROFILES_KEY,
  profileFor,
  resolveTarget,
  resourcesAfterReserve,
  shipsAfterReserve,
  type FleetProfile,
  type FleetsaveProfile,
} from '../../engines/fleet';
import {
  originCoords,
  readAvailableResources,
  readFuel,
  readShipSlots,
} from '../../data/fleet-page';
import { FLEET_CSS } from './style';

export interface FleetOptions {
  doc: Document;
  store: Store;
  bodyId: number;
  /** All own planet and moon ids, for "copy to all". */
  bodyIds: number[];
  t: (key: string, vars?: Record<string, string | number>) => string;
  locale: string;
}

const STYLE_ID = 'fut-fleet-style';
const PENDING_KEY = 'fut.fleetsave.pending';
/** Missions offered for fleetsave, in the game's order codes. */
export const FLEETSAVE_MISSIONS = [3, 4, 6, 8, 15, 5, 1];

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

/**
 * The game's speed bar reads the mouse position on mouseup: release over the wanted step.
 * Purely local, like the player clicking that step.
 */
export function setSpeed(doc: Document, percent: number): void {
  const step = doc.querySelector<HTMLElement>(`#speedPercentage .step[data-step="${Math.round(percent / 10)}"]`);
  if (!step) return;
  const r = step.getBoundingClientRect();
  step.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
}

/** Waits (client side only) until a mission button becomes available, or gives up. */
function waitForMission(doc: Document, mission: number, timeoutMs = 5000): Promise<boolean> {
  const li = () => doc.getElementById(`button${mission}`);
  if (li()?.classList.contains('on')) return Promise.resolve(true);
  return new Promise((resolve) => {
    const missions = doc.getElementById('missions');
    if (!missions) return resolve(false);
    const timer = setTimeout(() => {
      observer.disconnect();
      resolve(false);
    }, timeoutMs);
    const observer = new MutationObserver(() => {
      if (li()?.classList.contains('on')) {
        clearTimeout(timer);
        observer.disconnect();
        resolve(true);
      }
    });
    observer.observe(missions, { subtree: true, attributes: true, attributeFilter: ['class'] });
  });
}

export function fillShipsAfterReserve(doc: Document, profile: FleetProfile): number {
  const slots = readShipSlots(doc);
  const available = Object.fromEntries(slots.map((s) => [s.id, s.available]));
  const pick = shipsAfterReserve(available, profile.reserve);
  let total = 0;
  for (const slot of slots) {
    const n = pick[slot.id] ?? 0;
    typeInto(slot.input, n > 0 ? n : '');
    slot.input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    total += n;
  }
  return total;
}

export function fillResourcesAfterReserve(doc: Document, profile: FleetProfile): void {
  const load = resourcesAfterReserve(readAvailableResources(doc), profile.reserve, readFuel(doc));
  for (const key of ['metal', 'crystal', 'deuterium'] as const) {
    const input = doc.querySelector<HTMLInputElement>(`#fleet2 #${key}`);
    if (input) typeInto(input, load[key]);
  }
}

export async function applyFleetsave(doc: Document, save: FleetsaveProfile, profile: FleetProfile): Promise<boolean> {
  const origin = originCoords(doc);
  if (!origin) return false;
  const target = resolveTarget(save, origin);
  const g = doc.querySelector<HTMLInputElement>('#fleet2 #galaxy');
  const s = doc.querySelector<HTMLInputElement>('#fleet2 #system');
  const p = doc.querySelector<HTMLInputElement>('#fleet2 #position');
  if (!g || !s || !p) return false;
  g.value = String(target.galaxy);
  s.value = String(target.system);
  typeInto(p, target.position);
  // Target type: click the game's own button only if it is not already selected.
  const typeButton = doc.getElementById(target.type === 3 ? 'mbutton' : target.type === 2 ? 'dbutton' : 'pbutton');
  if (typeButton && !typeButton.className.endsWith('_selected')) typeButton.click();
  setSpeed(doc, save.speed);
  const ready = await waitForMission(doc, save.mission);
  if (ready) doc.getElementById(`missionButton${save.mission}`)?.click();
  fillResourcesAfterReserve(doc, profile);
  return ready;
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

function loadProfiles(store: Store): Record<string, FleetProfile> {
  return store.get<Record<string, FleetProfile>>(PROFILES_KEY, {});
}

function button(doc: Document, text: string, onClick: () => void, cls = ''): HTMLButtonElement {
  const b = el(doc, 'button', `fut-fbtn ${cls}`.trim(), text);
  b.type = 'button';
  b.addEventListener('click', (e) => {
    e.preventDefault();
    onClick();
  });
  return b;
}

function numberField(doc: Document, label: string, value: number | null, placeholder = ''): [HTMLLabelElement, HTMLInputElement] {
  const wrap = el(doc, 'label', 'fut-ffield');
  wrap.append(el(doc, 'span', '', label));
  const input = el(doc, 'input');
  input.type = 'text';
  input.inputMode = 'numeric';
  input.placeholder = placeholder;
  input.value = value ? String(value) : '';
  // Keep the game's keyboard shortcuts out of our fields.
  input.addEventListener('keydown', (e) => e.stopPropagation());
  input.addEventListener('keyup', (e) => e.stopPropagation());
  wrap.append(input);
  return [wrap, input];
}

function editor(o: FleetOptions, onSaved: () => void): HTMLElement {
  const { doc, t } = o;
  const profiles = loadProfiles(o.store);
  const profile = profileFor(profiles, o.bodyId);
  const panel = el(doc, 'div', 'fut-feditor');
  panel.hidden = true;

  panel.append(el(doc, 'h4', '', t('fleet.reserveShips')));
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

  panel.append(el(doc, 'h4', '', t('fleet.reserveRes')));
  const resGrid = el(doc, 'div', 'fut-fgrid');
  const resInputs = (['metal', 'crystal', 'deuterium'] as const).map((k) => {
    const [wrap, input] = numberField(doc, t(`res.${k}`), profile.reserve.resources[k] || null, '0');
    resGrid.append(wrap);
    return [k, input] as const;
  });
  panel.append(resGrid);

  panel.append(el(doc, 'h4', '', t('fleet.fleetsave')));
  const saveGrid = el(doc, 'div', 'fut-fgrid');
  const origin = originCoords(doc);
  const [gWrap, gIn] = numberField(doc, t('fleet.galaxy'), profile.save?.galaxy ?? null, origin ? String(origin.galaxy) : '');
  const [sWrap, sIn] = numberField(doc, t('fleet.system'), profile.save?.system ?? null, origin ? String(origin.system) : '');
  const [pWrap, pIn] = numberField(doc, t('fleet.position'), profile.save?.position ?? null, '16');
  const select = (label: string, options: [string, string][], value: string) => {
    const wrap = el(doc, 'label', 'fut-ffield');
    wrap.append(el(doc, 'span', '', label));
    const sel = el(doc, 'select');
    for (const [v, text] of options) {
      const opt = el(doc, 'option', '', text);
      opt.value = v;
      opt.selected = v === value;
      sel.append(opt);
    }
    wrap.append(sel);
    return [wrap, sel] as const;
  };
  const [typeWrap, typeSel] = select(
    t('fleet.type'),
    [['1', t('fleet.typePlanet')], ['3', t('fleet.typeMoon')], ['2', t('fleet.typeDebris')]],
    String(profile.save?.type ?? 1),
  );
  const [misWrap, misSel] = select(
    t('fleet.mission'),
    FLEETSAVE_MISSIONS.map((m) => [String(m), t(`mission.${m}`)]),
    String(profile.save?.mission ?? 6),
  );
  const [spdWrap, spdSel] = select(
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

  const status = el(doc, 'span', 'fut-fstatus');
  const actions = el(doc, 'div', 'fut-factions');
  actions.append(
    button(doc, t('fleet.save'), () => {
      const all = loadProfiles(o.store);
      all[String(o.bodyId)] = read();
      o.store.set(PROFILES_KEY, all);
      status.textContent = t('fleet.saved');
      onSaved();
    }, 'primary'),
    button(doc, t('fleet.copyAll'), () => {
      const all = loadProfiles(o.store);
      all[String(o.bodyId)] = read();
      o.store.set(PROFILES_KEY, copyProfileToAll(all, o.bodyId, o.bodyIds));
      status.textContent = t('fleet.copied', { count: o.bodyIds.length });
      onSaved();
    }),
    status,
  );
  panel.append(actions);
  return panel;
}

function reserveSummary(o: FleetOptions, profile: FleetProfile): string {
  const ships = Object.values(profile.reserve.ships).reduce((a, b) => a + b, 0);
  const r = profile.reserve.resources;
  const fmt = (n: number) => n.toLocaleString(o.locale);
  const parts = [];
  if (ships) parts.push(o.t('fleet.summaryShips', { count: fmt(ships) }));
  if (r.metal || r.crystal || r.deuterium) parts.push(`${fmt(r.metal)} / ${fmt(r.crystal)} / ${fmt(r.deuterium)}`);
  return parts.length ? `${o.t('fleet.reserve')}: ${parts.join(' · ')}` : o.t('fleet.noReserve');
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
  const profile = profileFor(loadProfiles(o.store), o.bodyId);
  const redraw = () => renderFleetTools(o);

  // Page 1: ships.
  const fleet1 = doc.getElementById('fleet1');
  const anchor1 = fleet1?.querySelector('#technologies') ?? null;
  if (fleet1 && anchor1) {
    const bar = el(doc, 'div', 'fut-fbar');
    bar.append(el(doc, 'span', 'fut-fbrand', 'Future'));
    const info = el(doc, 'span', 'fut-finfo', reserveSummary(o, profile));
    bar.append(
      button(doc, t('fleet.shipsMinusReserve'), () => {
        const n = fillShipsAfterReserve(doc, profile);
        info.textContent = t('fleet.shipsSelected', { count: n.toLocaleString(o.locale) });
      }),
    );
    if (profile.save) {
      bar.append(
        button(doc, t('fleet.fleetsaveStart'), () => {
          const n = fillShipsAfterReserve(doc, profile);
          try {
            sessionStorage.setItem(PENDING_KEY, String(o.bodyId));
          } catch {
            /* private mode: the page-2 button still works */
          }
          info.textContent = t('fleet.fleetsaveNext', { count: n.toLocaleString(o.locale) });
          doc.querySelector('#fleet2 .fut-fapply')?.classList.add('pulse');
        }, 'primary'),
      );
    }
    const edit = button(doc, t('fleet.edit'), () => {
      panel.hidden = !panel.hidden;
    });
    bar.append(edit, info);
    const panel = editor(o, redraw);
    anchor1.before(bar, panel);
  }

  // Page 2: target and resources.
  const fleet2 = doc.getElementById('fleet2');
  const anchor2 = fleet2?.querySelector('#buttonz') ?? null;
  if (fleet2 && anchor2) {
    enableOriginAutofill(doc);
    const bar = el(doc, 'div', 'fut-fbar');
    bar.append(el(doc, 'span', 'fut-fbrand', 'Future'));
    const info = el(doc, 'span', 'fut-finfo', reserveSummary(o, profile));
    bar.append(
      button(doc, t('fleet.resMinusReserve'), () => {
        fillResourcesAfterReserve(doc, profile);
        info.textContent = t('fleet.resLoaded');
      }),
    );
    if (profile.save) {
      const save = profile.save;
      let pending = false;
      try {
        pending = sessionStorage.getItem(PENDING_KEY) === String(o.bodyId);
      } catch {
        pending = false;
      }
      const target = resolveTarget(save, originCoords(doc) ?? { galaxy: 0, system: 0 });
      const label = t('fleet.fleetsaveApply', { coords: `${target.galaxy}:${target.system}:${target.position}`, mission: t(`mission.${save.mission}`) });
      bar.append(
        button(doc, label, () => {
          try {
            sessionStorage.removeItem(PENDING_KEY);
          } catch {
            /* ignore */
          }
          info.textContent = t('fleet.applying');
          void applyFleetsave(doc, save, profile).then((ok) => {
            info.textContent = ok ? t('fleet.applied') : t('fleet.missionMissing');
          });
        }, pending ? 'primary fut-fapply pulse' : 'primary fut-fapply'),
      );
    }
    bar.append(info);
    anchor2.before(bar);
  }
}

