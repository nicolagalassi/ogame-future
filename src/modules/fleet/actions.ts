/**
 * Fleet actions: each one prepares the game's fleet form in one go (ships, target,
 * mission, speed, cargo), the way OGLight's collect / expedition / fleetsave buttons do.
 *
 * COMPLIANCE: one click prepares one fleet. Nothing is sent: the player presses the
 * game's own "Avanti" and "Invia flotta". No request is made here; the game itself checks
 * the target when page 2 opens, as it always does.
 */
import {
  EMPTY_RESERVE,
  cargoLoad,
  cargoShipsFor,
  expeditionFleet,
  expeditionMax,
  expeditionTarget,
  resolveTarget,
  shipsAfterReserve,
  type FleetProfile,
  type LastFleet,
  type FleetSettings,
  type FleetsaveProfile,
  type ShipStock,
} from '../../engines/fleet';
import { pageWindow, shipCapacity, shipsOnPlanet, type FleetDispatcher } from '../../data/fleet-dispatcher';

export type FleetMode = 'moon' | 'transport' | 'deploy' | 'expedition' | 'fleetsave' | 'all' | 'last';

export interface Target {
  galaxy: number;
  system: number;
  position: number;
  /** 1 planet, 2 debris, 3 moon */
  type: number;
  name?: string;
}

export interface PrepareResult {
  ok: boolean;
  /** i18n key explaining why nothing was prepared. */
  reason?: string;
  ships: number;
  cargo: number;
}

const TRANSPORT = 3;
const DEPLOY = 4;
const EXPEDITION = 15;

function stock(fd: FleetDispatcher, profile: FleetProfile): ShipStock[] {
  const left = shipsAfterReserve(shipsOnPlanet(fd), profile.reserve);
  return fd.shipsOnPlanet.map((s) => ({ id: s.id, available: left[String(s.id)] ?? 0, capacity: shipCapacity(fd, s.id) }));
}

function onPlanet(fd: FleetDispatcher) {
  return { metal: fd.metalOnPlanet, crystal: fd.crystalOnPlanet, deuterium: fd.deuteriumOnPlanet };
}

function setSpeedBar(fd: FleetDispatcher, percent: number): void {
  const step = Math.max(1, Math.min(10, Math.round(percent / 10)));
  fd.speedPercent = step;
  // The game's own speed bar, so what the player sees matches what will be sent.
  const $ = pageWindow().jQuery as ((s: string) => { data(k: string): { setValue?(v: number): void } | undefined }) | undefined;
  try {
    $?.('#speedPercentage').data('percentageBarInstance')?.setValue?.(step);
  } catch {
    /* the bar is cosmetic: speedPercent is already set */
  }
  fd.speedPercent = step;
}

function setTarget(fd: FleetDispatcher, doc: Document, target: Target): void {
  fd.targetPlanet.galaxy = target.galaxy;
  fd.targetPlanet.system = target.system;
  fd.targetPlanet.position = target.position;
  fd.targetPlanet.type = target.type;
  if (target.name) fd.targetPlanet.name = target.name;
  // The game reads these inputs again when page 2 opens.
  const set = (id: string, v: number) => {
    const input = doc.querySelector<HTMLInputElement>(`#fleet2 #${id}`);
    if (input) input.value = String(v);
  };
  set('galaxy', target.galaxy);
  set('system', target.system);
  set('position', target.position);
}

function selectShips(fd: FleetDispatcher, ships: Record<number, number>): number {
  fd.resetShips();
  fd.resetCargo();
  let total = 0;
  for (const [id, n] of Object.entries(ships)) {
    if (n > 0) {
      fd.selectShip(Number(id), n);
      total += n;
    }
  }
  return total;
}

/** Loads cargo after ships, target and speed are set (fuel depends on all three). */
function loadCargo(fd: FleetDispatcher, profile: FleetProfile): number {
  const load = cargoLoad(onPlanet(fd), profile.reserve, Math.ceil(Number(fd.getConsumption()) || 0), fd.getCargoCapacity());
  fd.cargoMetal = load.metal;
  fd.cargoCrystal = load.crystal;
  fd.cargoDeuterium = load.deuterium;
  return load.metal + load.crystal + load.deuterium;
}

function finish(fd: FleetDispatcher, mission: number, ships: number, cargo: number): PrepareResult {
  fd.mission = mission;
  fd.refresh();
  fd.focusSubmitFleet1();
  return { ok: ships > 0, reason: ships > 0 ? undefined : 'fleet.err.noShips', ships, cargo };
}

/** Resources to move after the reserve (fuel is taken care of when loading). */
function toMove(fd: FleetDispatcher, profile: FleetProfile): number {
  const r = profile.reserve.resources;
  return (
    Math.max(0, fd.metalOnPlanet - r.metal) + Math.max(0, fd.crystalOnPlanet - r.crystal) + Math.max(0, fd.deuteriumOnPlanet - r.deuterium)
  );
}

/** Transport to an own body with the main cargo ship, the second one covering the rest. */
export function prepareTransport(fd: FleetDispatcher, doc: Document, profile: FleetProfile, settings: FleetSettings, target: Target): PrepareResult {
  const amount = toMove(fd, profile);
  if (amount <= 0) return { ok: false, reason: 'fleet.err.noResources', ships: 0, cargo: 0 };
  const ships = cargoShipsFor(amount, stock(fd, profile), settings.mainShip, settings.secondShip);
  const count = selectShips(fd, ships);
  setTarget(fd, doc, target);
  setSpeedBar(fd, settings.transportSpeed);
  fd.mission = TRANSPORT;
  const cargo = count > 0 ? loadCargo(fd, profile) : 0;
  return finish(fd, TRANSPORT, count, cargo);
}

/** All ships after the reserve, with as much cargo as they carry. */
export function prepareDeploy(fd: FleetDispatcher, doc: Document, profile: FleetProfile, settings: FleetSettings, target: Target): PrepareResult {
  const ships = Object.fromEntries(stock(fd, profile).map((s) => [s.id, s.available]));
  const count = selectShips(fd, ships);
  setTarget(fd, doc, target);
  setSpeedBar(fd, settings.transportSpeed);
  fd.mission = DEPLOY;
  const cargo = count > 0 ? loadCargo(fd, profile) : 0;
  return finish(fd, DEPLOY, count, cargo);
}

/** All ships after the reserve, no target change, no cargo (the old "Navi − riserva"). */
export function prepareAllShips(fd: FleetDispatcher, profile: FleetProfile): PrepareResult {
  const ships = Object.fromEntries(stock(fd, profile).map((s) => [s.id, s.available]));
  const count = selectShips(fd, ships);
  fd.refresh();
  fd.focusSubmitFleet1();
  return { ok: count > 0, reason: count > 0 ? undefined : 'fleet.err.noShips', ships: count, cargo: 0 };
}

export function prepareFleetsave(fd: FleetDispatcher, doc: Document, base: FleetProfile, save: FleetsaveProfile): PrepareResult {
  // The fleetsave has its own reserve (reserve 2), separate from the one of transports.
  const profile: FleetProfile = { ...base, reserve: base.saveReserve ?? EMPTY_RESERVE };
  const ships = Object.fromEntries(stock(fd, profile).map((s) => [s.id, s.available]));
  const count = selectShips(fd, ships);
  setTarget(fd, doc, resolveTarget(save, fd.currentPlanet));
  setSpeedBar(fd, save.speed);
  fd.mission = save.mission;
  const cargo = count > 0 ? loadCargo(fd, profile) : 0;
  return finish(fd, save.mission, count, cargo);
}

export function prepareExpedition(
  fd: FleetDispatcher,
  doc: Document,
  profile: FleetProfile,
  settings: FleetSettings,
  universe: { economySpeed: number; topScore?: number; lfBooster?: number; itemBoost?: number },
): PrepareResult & { target: number } {
  if (fd.expeditionCount >= fd.maxExpeditionCount) return { ok: false, reason: 'fleet.err.noExpSlots', ships: 0, cargo: 0, target: 0 };
  const cls = fd.apiDataJson?.characterClassId ?? 0;
  const booster = fd.apiDataJson?.bonuses?.characterClassBooster?.[String(cls)] ?? 0;
  const limits = expeditionMax({
    topScore: universe.topScore,
    characterClass: cls,
    economySpeed: universe.economySpeed,
    classBooster: booster,
    lfBooster: universe.lfBooster,
    itemBoost: universe.itemBoost,
  });
  const target = expeditionTarget(limits.max, settings.expeditionValue);
  // As in OGLight: the minimum fleet size only applies to the calculated value, not to a value the player typed.
  const base = settings.expeditionValue.trim() ? 0 : limits.base;
  const ships = expeditionFleet(stock(fd, profile), { ship: settings.expeditionShip, target, base, extras: settings.expeditionExtras });
  const count = selectShips(fd, ships);
  const here = fd.currentPlanet;
  setTarget(fd, doc, { galaxy: here.galaxy, system: here.system, position: 16, type: 1 });
  setSpeedBar(fd, 100);
  fd.expeditionTime = 1;
  const $ = pageWindow().jQuery as ((s: string) => { val(v: string): unknown }) | undefined;
  try {
    $?.('#expeditiontime').val('1');
  } catch {
    /* expeditionTime is already set on the dispatcher */
  }
  return { ...finish(fd, EXPEDITION, count, 0), target };
}

/** "Ripeti ultima flotta": the same ships (within what is here after reserve 1), target, mission, speed. */
export function prepareLast(fd: FleetDispatcher, doc: Document, profile: FleetProfile, last: LastFleet): PrepareResult {
  const left = Object.fromEntries(stock(fd, profile).map((s) => [s.id, s.available]));
  const ships: Record<number, number> = {};
  for (const [id, n] of Object.entries(last.ships)) ships[Number(id)] = Math.min(n, left[Number(id)] ?? 0);
  const count = selectShips(fd, ships);
  setTarget(fd, doc, last.target);
  setSpeedBar(fd, last.speed);
  return finish(fd, last.mission, count, 0);
}

/** What was just sent, to offer it again later. */
export function snapshotFleet(fd: FleetDispatcher): LastFleet {
  return {
    ships: Object.fromEntries(fd.shipsToSend.map((s) => [String(s.id), s.number])),
    target: { galaxy: fd.targetPlanet.galaxy, system: fd.targetPlanet.system, position: fd.targetPlanet.position, type: fd.targetPlanet.type },
    mission: fd.mission,
    speed: Math.round(fd.speedPercent * 10),
  };
}
