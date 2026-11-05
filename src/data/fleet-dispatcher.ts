/**
 * The game's own fleet form object (`window.fleetDispatcher`, created by the game when the
 * fleet page is ready). Future sets its fields the same way OGLight does, so the game's
 * "Avanti" opens page 2 already filled. Nothing here sends anything: sending stays the
 * game's own button, pressed by the player.
 */

export interface DispatcherShip {
  id: number;
  number: number;
}

export interface DispatcherTarget {
  galaxy: number;
  system: number;
  position: number;
  type: number;
  name?: string;
}

/** The fields and methods of the game's FleetDispatcher that Future uses. */
export interface FleetDispatcher {
  currentPage: string;
  currentPlanet: DispatcherTarget;
  targetPlanet: DispatcherTarget;
  shipsOnPlanet: DispatcherShip[];
  shipsToSend: DispatcherShip[];
  mission: number;
  speedPercent: number;
  expeditionTime: number;
  cargoMetal: number;
  cargoCrystal: number;
  cargoDeuterium: number;
  metalOnPlanet: number;
  crystalOnPlanet: number;
  deuteriumOnPlanet: number;
  fleetCount: number;
  maxFleetCount: number;
  expeditionCount: number;
  maxExpeditionCount: number;
  fleetHelper: { shipsData?: Record<string, { cargoCapacity?: number; baseCargoCapacity?: number; name?: string }> };
  apiDataJson?: { characterClassId?: number; bonuses?: { characterClassBooster?: Record<string, number> } };
  resetShips(): void;
  resetCargo(): void;
  selectShip(id: number, count: number): void;
  getCargoCapacity(): number;
  getConsumption(): number;
  refresh(): void;
  focusSubmitFleet1(): void;
}

type PageWindow = Window & { fleetDispatcher?: FleetDispatcher | null; jQuery?: (arg: unknown) => unknown };

declare const unsafeWindow: PageWindow | undefined;

/** The page's own window: Tampermonkey runs us in a sandbox, the game's objects live there. */
export function pageWindow(): PageWindow {
  return (typeof unsafeWindow !== 'undefined' && unsafeWindow) || (window as PageWindow);
}

export function getDispatcher(win: PageWindow = pageWindow()): FleetDispatcher | null {
  return win.fleetDispatcher ?? null;
}

/**
 * Resolves once the game has created its fleetDispatcher (it does so on jQuery ready).
 * Purely local: no request, only waiting for the game's own script.
 */
export function whenDispatcherReady(win: PageWindow = pageWindow(), timeoutMs = 5000): Promise<FleetDispatcher | null> {
  const ready = getDispatcher(win);
  if (ready) return Promise.resolve(ready);
  return new Promise((resolve) => {
    const started = Date.now();
    const check = () => {
      const fd = getDispatcher(win);
      if (fd) return resolve(fd);
      if (Date.now() - started > timeoutMs) return resolve(null);
      setTimeout(check, 50);
    };
    check();
  });
}

export function shipCapacity(fd: FleetDispatcher, id: number): number {
  const data = fd.fleetHelper.shipsData?.[String(id)];
  return data?.cargoCapacity || data?.baseCargoCapacity || 0;
}

export function shipsOnPlanet(fd: FleetDispatcher): Record<string, number> {
  return Object.fromEntries(fd.shipsOnPlanet.map((s) => [String(s.id), s.number]));
}

export const SHIPS_INFO_KEY = 'ships.info';
export type ShipsInfo = Record<string, { name: string; capacity: number }>;

/** Ship names (in the game's language) and cargo capacities, as the fleet page knows them. */
export function readShipsInfo(fd: FleetDispatcher): ShipsInfo | null {
  const data = fd.fleetHelper?.shipsData;
  if (!data) return null;
  const out: ShipsInfo = {};
  for (const [id, s] of Object.entries(data)) out[id] = { name: s.name ?? '', capacity: s.cargoCapacity || s.baseCargoCapacity || 0 };
  return Object.keys(out).length ? out : null;
}
