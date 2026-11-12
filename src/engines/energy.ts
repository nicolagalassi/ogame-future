/**
 * Energy maths for the tech panel: how many solar satellites bring a planet's energy back
 * above zero, now or after the levels picked on a mine. Pure functions: no DOM, no network.
 *
 * The game's own numbers come first: the energy balance of the resource bar, the extra
 * consumption the mine panel shows, the production the satellite panel shows. The formulas
 * below only extend them (further mine levels, planets whose satellite panel was never opened).
 */

/** Energy one solar satellite gives before any bonus: the game's (Tmax + 140) / 6. */
export const satelliteBase = (maxTemp: number): number => Math.max(0, Math.floor((maxTemp + 140) / 6));

/** Energy mines use at a level: 10·L·1.1^L (metal, crystal), 20·L·1.1^L (deuterium). Checked in game. */
const MINE_FACTOR: Record<number, number> = { 1: 10, 2: 10, 3: 20 };

export const mineConsumption = (id: number, level: number): number | null => {
  const k = MINE_FACTOR[id];
  if (k === undefined) return null;
  return level > 0 ? Math.ceil(k * level * Math.pow(1.1, level)) : 0;
};

/**
 * Extra energy for building levels `from`..`to`. The game gives the first level (`gameFirst`);
 * mines add the formula's difference for the next ones. Other techs: the game's number only.
 */
export function extraConsumption(id: number, from: number, to: number, gameFirst: number): number | null {
  if (to <= from) return gameFirst;
  const atTo = mineConsumption(id, to);
  const atFrom = mineConsumption(id, from);
  return atTo === null || atFrom === null ? null : gameFirst + atTo - atFrom;
}

/** What one satellite gives on each planet, learned from the game's satellite panel. */
export interface SatelliteEnergy {
  perUnit: number;
  /** Max temperature of that planet when learned, to carry its bonuses to other planets. */
  maxTemp: number | null;
  at: number;
}

export type SatelliteBook = Record<string, SatelliteEnergy>;

/**
 * Energy of one satellite on a planet: the game's value when its satellite panel was opened
 * there, else an estimate from the temperature and the bonuses seen on the last planet learned.
 */
export function perSatellite(book: SatelliteBook, bodyId: number, maxTemp: number | null): { value: number; exact: boolean } | null {
  const own = book[String(bodyId)];
  if (own && own.perUnit > 0) return { value: own.perUnit, exact: true };
  if (maxTemp === null) return null;
  const base = satelliteBase(maxTemp);
  if (base <= 0) return null;
  const ref = Object.values(book)
    .filter((e) => e.perUnit > 0 && e.maxTemp !== null && satelliteBase(e.maxTemp) > 0)
    .sort((a, b) => b.at - a.at)[0];
  const ratio = ref ? ref.perUnit / satelliteBase(ref.maxTemp as number) : 1;
  return { value: base * ratio, exact: false };
}

/** Satellites (and energy) still needed to cover `need` more energy than the planet has now. */
export function satellitesFor(balance: number, need: number, perUnit: number): { count: number; energy: number } | null {
  const energy = need - balance;
  if (energy <= 0 || perUnit <= 0) return null;
  return { count: Math.ceil(energy / perUnit), energy };
}
