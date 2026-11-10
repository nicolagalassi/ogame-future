/**
 * Links to the community battle simulators and the combat report converter, built from the
 * report's API key (the code the game itself offers "for a compatible battle simulator").
 * Same tools and URL shapes as OGLight / PrOGect.
 *
 * COMPLIANCE (AGENTS.md §1.9): nothing is sent by Future. The player clicks a link that opens the
 * tool in a new tab with the report's API key and, for the simulators, the player's own combat
 * research levels so the attacker side is filled in. Opening it is the player's choice.
 */
import type { ShipBonus } from '../data/bonuses';

export const OSIMS = 'https://www.ogameutilities.it/Osims/';
export const OGAME_TOOLS_SIM = 'https://simulator.ogame-tools.com/';
export const OGOTCHA = 'https://ogotcha.oplanet.eu/';

/** The simulator the player picked in the settings (Osims by default). */
export type SimTool = 'osims' | 'ogametools';
export const SIM_KEY = 'sim.tool';
export const SIM_TOOLS: Record<SimTool, { name: string; url: string }> = {
  osims: { name: 'Osims', url: OSIMS },
  ogametools: { name: 'OGame Simulator', url: OGAME_TOOLS_SIM },
};
export const simTool = (v: unknown): SimTool => (v === 'ogametools' ? 'ogametools' : 'osims');

/** Combat research the simulators use: weapons, shielding, armour, hyperspace, the three drives. */
const SIM_RESEARCH = [109, 110, 111, 114, 115, 117, 118];
/** Character class id of the General (2): +2 levels to weapons, shielding and armour in battle. */
const GENERAL = 2;
/** Alliance class id of the Warriors (1): +1 level to the three combat techs. */
const WARRIORS = 1;

export interface Attacker {
  coords: string;
  researches: Record<string, number>;
  classId: number;
  /** Alliance class id (0 none, 1 warriors, 2 traders, 3 researchers). */
  allianceClass?: number;
  /** Lifeform bonuses: per ship (fractions) and the class booster per class id. */
  lf?: { ships?: Record<string, ShipBonus>; classBooster?: Record<string, number> };
}

/** Language path the tools understand ("us" → "en", "ar" → "es", as OGLight). */
export const toolLang = (lang: string) => (lang === 'us' ? 'en' : lang === 'ar' ? 'es' : lang || 'en');

/**
 * The `#prefill=` payload, filled like OGLight's: the attacker's planet, combat research (with the
 * General's +2 and its lifeform boost, and the Warriors' +1), class, alliance class and the lifeform
 * bonuses of each ship. The defender comes from the report's key.
 */
export function simPrefill(server: string, attacker: Attacker | null, defenderCoords: string): string {
  const planet = (c: string) => {
    const [galaxy, system, position] = c.split(':');
    return { galaxy, system, position };
  };
  const cls = attacker?.classId ?? 0;
  const booster = attacker?.lf?.classBooster?.[String(cls)] ?? 0;
  // OGLight: the General gets +2 combat levels, +1 more for every 50% of class booster.
  let bonus = cls === GENERAL ? 2 + Math.floor((booster * 100) / 50) : 0;
  if (attacker?.allianceClass === WARRIORS) bonus++;
  const research: Record<string, { level: number }> = {};
  for (const id of SIM_RESEARCH) research[id] = { level: (attacker?.researches[String(id)] ?? 0) + (id <= 111 ? bonus : 0) };
  const lifeformBonuses: Record<string, unknown> = { BaseStatsBooster: {}, CharacterClassBooster: { [cls]: booster } };
  for (const [id, b] of Object.entries(attacker?.lf?.ships ?? {})) {
    (lifeformBonuses.BaseStatsBooster as Record<string, unknown>)[id] = { weapon: b.weapon, shield: b.shield, armor: b.armor, cargo: b.cargo, speed: b.speed };
    if (b.fuel) lifeformBonuses.ShipFuelConsumption = Math.abs(b.fuel);
  }
  const data = {
    settings: { server },
    0: [{ planet: planet(attacker?.coords ?? '0:0:0'), research, class: cls, characterClassesEnabled: true, allianceClass: attacker?.allianceClass ?? 0, lifeformBonuses }],
    1: [{ planet: planet(defenderCoords), research: {}, resources: {}, defence: {} }],
  };
  return btoa(JSON.stringify(data));
}

/** The picked simulator with the report loaded: `<tool>/<lang>?SR_KEY=…#prefill=…`, as OGLight builds it. */
export function simLink(tool: SimTool, apiKey: string, lang: string, prefill: string): string {
  return `${SIM_TOOLS[tool].url}${toolLang(lang)}?SR_KEY=${encodeURIComponent(apiKey)}#prefill=${prefill}`;
}


export function converterLink(apiKey: string, lang: string): string {
  return `${OGOTCHA}${toolLang(lang)}?CR_KEY=${encodeURIComponent(apiKey)}`;
}
