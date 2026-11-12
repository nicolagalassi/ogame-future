/**
 * Technology groups and names for the Dashboard. Built-in names are a fallback: the names
 * the game shows on its own pages (in the player's language) are learned while the player
 * browses them (`learnTechNames`) and always win. Pure data, no network call.
 */
import type { TechListEntry } from './tech-details';

export const TECH_NAMES_KEY = 'tech.names';

export const MINES = [1, 2, 3, 4, 12, 212, 217, 22, 23, 24] as const;
export const PLANET_FACILITIES = [14, 15, 21, 31, 33, 34, 36, 44] as const;
export const MOON_FACILITIES = [41, 42, 43, 14, 21, 22, 23, 24] as const;
export const RESEARCH = [106, 108, 109, 110, 111, 113, 114, 115, 117, 118, 120, 121, 122, 123, 124, 199] as const;
export const SHIPS = [202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 213, 214, 215, 218, 219, 212, 217] as const;
export const DEFENCES = [401, 402, 403, 404, 405, 406, 407, 408, 502, 503] as const;

/** Lifeform species: 1 humans, 2 Rock'tal, 3 Mechas, 4 Kaelesh. Ids are 1s1nn (buildings) and 1s2nn (research). */
export const SPECIES = [1, 2, 3, 4] as const;
export type Species = (typeof SPECIES)[number];
export const lfBuildings = (s: Species): number[] => Array.from({ length: 12 }, (_, i) => 10000 + s * 1000 + 101 + i);
export const lfResearch = (s: Species): number[] => Array.from({ length: 18 }, (_, i) => 10000 + s * 1000 + 201 + i);
export const speciesOf = (id: number): Species | null => {
  const s = Math.floor((id % 10000) / 1000);
  return id > 10000 && s >= 1 && s <= 4 ? (s as Species) : null;
};

const EN: Record<number, string> = {
  1: 'Metal Mine', 2: 'Crystal Mine', 3: 'Deuterium Synthesizer', 4: 'Solar Plant', 12: 'Fusion Reactor',
  14: 'Robotics Factory', 15: 'Nanite Factory', 21: 'Shipyard', 22: 'Metal Storage', 23: 'Crystal Storage',
  24: 'Deuterium Tank', 31: 'Research Lab', 33: 'Terraformer', 34: 'Alliance Depot', 36: 'Space Dock',
  41: 'Lunar Base', 42: 'Sensor Phalanx', 43: 'Jump Gate', 44: 'Missile Silo', 45: 'Interstellar Anomaly Scanner',
  106: 'Espionage', 108: 'Computer', 109: 'Weapons', 110: 'Shielding', 111: 'Armour', 113: 'Energy',
  114: 'Hyperspace', 115: 'Combustion Drive', 117: 'Impulse Drive', 118: 'Hyperspace Drive', 120: 'Laser',
  121: 'Ion', 122: 'Plasma', 123: 'Intergalactic Research Network', 124: 'Astrophysics', 199: 'Graviton',
  202: 'Small Cargo', 203: 'Large Cargo', 204: 'Light Fighter', 205: 'Heavy Fighter', 206: 'Cruiser',
  207: 'Battleship', 208: 'Colony Ship', 209: 'Recycler', 210: 'Espionage Probe', 211: 'Bomber',
  212: 'Solar Satellite', 213: 'Destroyer', 214: 'Deathstar', 215: 'Battlecruiser', 217: 'Crawler',
  218: 'Reaper', 219: 'Pathfinder',
  401: 'Rocket Launcher', 402: 'Light Laser', 403: 'Heavy Laser', 404: 'Gauss Cannon', 405: 'Ion Cannon',
  406: 'Plasma Turret', 407: 'Small Shield Dome', 408: 'Large Shield Dome', 502: 'Anti-Ballistic Missile',
  503: 'Interplanetary Missile',
};

const LF_EN: Record<Species, { b: string[]; r: string[] }> = {
  1: {
    b: ['Residential Sector', 'Biosphere Farm', 'Research Centre', 'Academy of Sciences', 'Neuro-Calibration Centre', 'High Energy Smelting', 'Food Silo', 'Fusion-Powered Production', 'Skyscraper', 'Biotech Lab', 'Metropolis', 'Planetary Shield'],
    r: ['Intergalactic Envoys', 'High-Performance Extractors', 'Fusion Drives', 'Stealth Field Generator', 'Orbital Den', 'Research AI', 'High-Performance Terraformer', 'Enhanced Production Technologies', 'Light Fighter Mk II', 'Cruiser Mk II', 'Improved Lab Technology', 'Plasma Terraformer', 'Low-Temperature Drives', 'Bomber Mk II', 'Destroyer Mk II', 'Battlecruiser Mk II', 'Robot Assistants', 'Supercomputer'],
  },
  2: {
    b: ['Meditation Enclave', 'Crystal Farm', 'Rune Technologium', 'Rune Forge', 'Oriktorium', 'Magma Forge', 'Disruption Chamber', 'Megalith', 'Crystal Refinery', 'Deuterium Synthesiser', 'Mineral Research Centre', 'Advanced Recycling Plant'],
    r: ['Volcanic Batteries', 'Acoustic Scanning', 'High Energy Pump Systems', 'Cargo Hold Expansion', 'Magma-Powered Production', 'Geothermal Power Plants', 'Depth Sounding', 'Ion Crystal Enhancement', 'Improved Stellarator', 'Hardened Diamond Drill Heads', 'Seismic Mining Technology', 'Magma-Powered Pump Systems', 'Ion Crystal Modules', 'Optimised Silo Construction', 'Diamond Energy Transmitter', 'Obsidian Shield Reinforcement', 'Rune Shields', "Rock'tal Collector Enhancement"],
  },
  3: {
    b: ['Assembly Line', 'Fusion Cell Factory', 'Robotics Research Centre', 'Update Network', 'Quantum Computer Centre', 'Automatised Assembly Centre', 'High-Performance Transformer', 'Microchip Assembly Line', 'Production Assembly Hall', 'High-Performance Synthesiser', 'Chip Mass Production', 'Nano Repair Bots'],
    r: ['Catalyser Technology', 'Plasma Drive', 'Efficiency Module', 'Depot AI', 'General Overhaul (Light Fighter)', 'Automated Transport Lines', 'Improved Drone AI', 'Experimental Recycling Technology', 'General Overhaul (Cruiser)', 'Slingshot Autopilot', 'High-Temperature Superconductors', 'General Overhaul (Battleship)', 'Artificial Swarm Intelligence', 'General Overhaul (Battlecruiser)', 'General Overhaul (Bomber)', 'General Overhaul (Destroyer)', 'Experimental Weapons Technology', 'Mechan General Enhancement'],
  },
  4: {
    b: ['Sanctuary', 'Antimatter Condenser', 'Vortex Chamber', 'Halls of Realisation', 'Forum of Transcendence', 'Antimatter Convector', 'Cloning Laboratory', 'Chrysalis Accelerator', 'Bio Modifier', 'Psionic Modulator', 'Ship Manufacturing Hall', 'Supra Refractor'],
    r: ['Heat Recovery', 'Sulphide Process', 'Psionic Network', 'Telekinetic Tractor Beam', 'Enhanced Sensor Technology', 'Neuromodal Compressor', 'Neuro-Interface', 'Interplanetary Analysis Network', 'Overclocking (Heavy Fighter)', 'Telekinetic Drive', 'Sixth Sense', 'Psychoharmoniser', 'Efficient Swarm Intelligence', 'Overclocking (Large Cargo)', 'Gravitation Sensors', 'Overclocking (Battleship)', 'Psionic Shield Matrix', 'Kaelesh Discoverer Enhancement'],
  },
};

const IT: Record<number, string> = {
  1: 'Miniera di metallo', 2: 'Miniera di cristallo', 3: 'Sintetizzatore di deuterio', 4: 'Centrale solare', 12: 'Centrale a fusione',
  14: 'Fabbrica dei robot', 15: 'Fabbrica di naniti', 21: 'Cantiere spaziale', 22: 'Deposito di metallo', 23: 'Deposito di cristallo',
  24: 'Cisterna di deuterio', 31: 'Laboratorio di ricerca', 33: 'Terraformer', 34: "Deposito dell'alleanza", 36: 'Porto spaziale',
  41: 'Base lunare', 42: 'Falange di sensori', 43: 'Portale iperspaziale', 44: 'Silos missilistico', 45: 'Scanner di anomalie interstellari',
  106: 'Spionaggio', 108: 'Computer', 109: 'Armi', 110: 'Scudi', 111: 'Corazze', 113: 'Energia',
  114: 'Iperspazio', 115: 'Propulsore a combustione', 117: 'Propulsore a impulso', 118: 'Propulsore iperspaziale', 120: 'Laser',
  121: 'Ionica', 122: 'Plasma', 123: 'Rete di ricerca intergalattica', 124: 'Astrofisica', 199: 'Gravitoni',
  217: 'Crawler', 218: 'Reaper', 219: 'Pathfinder',
  401: 'Lanciamissili', 402: 'Laser leggero', 403: 'Laser pesante', 404: 'Cannone Gauss', 405: 'Cannone ionico',
  406: 'Cannone al plasma', 407: 'Cupola scudo piccola', 408: 'Cupola scudo potente', 502: 'Missili anti-balistici',
  503: 'Missili interplanetari',
};

const BUILT_IN: Record<string, Record<number, string>> = { it: IT };

export type TechNames = Record<string, string>;

/** Name of a technology: learned from the game first, then the built-in table, then English. */
export function techName(id: number, locale: string, learned: TechNames = {}, t?: (key: string) => string): string {
  const seen = learned[String(id)];
  if (seen) return seen;
  const local = BUILT_IN[locale]?.[id];
  if (local) return local;
  if (t && id >= 202 && id <= 219) {
    const ship = t(`ship.${id}`);
    if (ship !== `ship.${id}`) return ship;
  }
  const s = speciesOf(id);
  if (s) {
    const group = Math.floor((id % 1000) / 100) === 1 ? LF_EN[s].b : LF_EN[s].r;
    return group[(id % 100) - 1] ?? String(id);
  }
  return EN[id] ?? String(id);
}

/** Adds the names shown on a technology page; returns true when something new was learned. */
export function learnTechNames(names: TechNames, list: TechListEntry[]): boolean {
  let changed = false;
  for (const e of list) {
    if (!e.name || e.name === String(e.id) || names[String(e.id)] === e.name) continue;
    names[String(e.id)] = e.name;
    changed = true;
  }
  return changed;
}
