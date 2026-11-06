/**
 * Links to the community battle simulators and the combat report converter, built from the
 * report's API key (the code the game itself offers "for a compatible battle simulator").
 * Same tools and URL shapes as OGLight / PrOGect.
 *
 * COMPLIANCE (AGENTS.md §1.9): nothing is sent by Future. The player clicks a link that opens the
 * tool in a new tab with the report's API key and, for the simulators, the player's own combat
 * research levels so the attacker side is filled in. Opening it is the player's choice.
 */

export const OSIMS = 'https://www.ogameutilities.it/Osims/';
export const OGAME_TOOLS_SIM = 'https://simulator.ogame-tools.com/';
export const OGOTCHA = 'https://ogotcha.oplanet.eu/';

/** Combat research the simulators use: weapons, shielding, armour, hyperspace, the three drives. */
const SIM_RESEARCH = [109, 110, 111, 114, 115, 117, 118];
/** Character class id of the General (2): +2 levels to weapons, shielding and armour in battle. */
const GENERAL = 2;

export interface Attacker {
  coords: string;
  researches: Record<string, number>;
  classId: number;
}

/** Language path the tools understand ("us" → "en", "ar" → "es", as OGLight). */
export const toolLang = (lang: string) => (lang === 'us' ? 'en' : lang === 'ar' ? 'es' : lang || 'en');

/** The `#prefill=` payload: attacker planet and research; the defender comes from the key. */
export function simPrefill(server: string, attacker: Attacker | null, defenderCoords: string): string {
  const planet = (c: string) => {
    const [galaxy, system, position] = c.split(':');
    return { galaxy, system, position };
  };
  const research: Record<string, { level: number }> = {};
  const bonus = attacker?.classId === GENERAL ? 2 : 0;
  for (const id of SIM_RESEARCH) research[id] = { level: (attacker?.researches[String(id)] ?? 0) + (id <= 111 ? bonus : 0) };
  const data = {
    settings: { server },
    0: [{ planet: planet(attacker?.coords ?? '0:0:0'), research, class: attacker?.classId ?? 0, characterClassesEnabled: true, allianceClass: 0 }],
    1: [{ planet: planet(defenderCoords), research: {}, resources: {}, defence: {} }],
  };
  return btoa(JSON.stringify(data));
}

export function osimsLink(apiKey: string, prefill: string): string {
  return `${OSIMS}?SR_KEY=${encodeURIComponent(apiKey)}#prefill=${prefill}`;
}

export function ogameToolsSimLink(apiKey: string, lang: string, prefill: string): string {
  return `${OGAME_TOOLS_SIM}${toolLang(lang)}?SR_KEY=${encodeURIComponent(apiKey)}#prefill=${prefill}`;
}

/** The game's own simulator, opened from the report like its own button does. */
export const gameSimLink = (apiKey: string) => `/game/index.php?page=standalone&component=combatsim&reportHash=${encodeURIComponent(apiKey)}`;

export function converterLink(apiKey: string, lang: string): string {
  return `${OGOTCHA}${toolLang(lang)}?CR_KEY=${encodeURIComponent(apiKey)}`;
}
