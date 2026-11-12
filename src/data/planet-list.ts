/**
 * Reads the game's own planet list (#planetList). Pure DOM read: no network call.
 * Future decorates these elements instead of replacing them, so every click still
 * goes through the game's own planet and moon links (AGENTS.md §1.5, OGLight rule 6).
 */

export interface PlanetListEntry {
  element: HTMLElement;
  planetLink: HTMLAnchorElement | null;
  moonLink: HTMLAnchorElement | null;
  planetId: number | null;
  moonId: number | null;
  name: string;
  coords: string;
  current: 'planet' | 'moon' | null;
  /** The game's own construction icons on this entry (planet / moon), if something is being built. */
  construction: { planet: HTMLAnchorElement | null; moon: HTMLAnchorElement | null };
}

const idFromLink = (a: HTMLAnchorElement | null): number | null => {
  const href = a?.getAttribute('href');
  if (!href) return null;
  const cp = new URLSearchParams(href.split('?')[1] ?? '').get('cp');
  const id = Number(cp?.split('#')[0]);
  return Number.isFinite(id) && id > 0 ? id : null;
};

export function readPlanetList(doc: Document): PlanetListEntry[] {
  return Array.from(doc.querySelectorAll<HTMLElement>('#planetList .smallplanet')).map((element) => {
    const planetLink = element.querySelector<HTMLAnchorElement>('a.planetlink');
    const moonLink = element.querySelector<HTMLAnchorElement>('a.moonlink');
    const coords = (element.querySelector('.planet-koords')?.textContent ?? '').replace(/[[\]\s]/g, '');
    const current = element.classList.contains('hightlightMoon')
      ? 'moon'
      : element.classList.contains('hightlightPlanet')
        ? 'planet'
        : null;
    return {
      element,
      planetLink,
      moonLink,
      planetId: idFromLink(planetLink),
      moonId: idFromLink(moonLink),
      name: element.querySelector('.planet-name')?.textContent?.trim() ?? '',
      coords,
      current,
      construction: {
        planet: element.querySelector<HTMLAnchorElement>('a.constructionIcon:not(.moon)'),
        moon: element.querySelector<HTMLAnchorElement>('a.constructionIcon.moon'),
      },
    };
  });
}

/** Resources of the body the player is looking at, read from the game's resource bar. */
export function readCurrentResources(doc: Document): { metal: number; crystal: number; deuterium: number } | null {
  const raw = (id: string): number | null => {
    const el = doc.getElementById(id);
    const value = el?.getAttribute('data-raw') ?? el?.textContent?.replace(/\D/g, '');
    const n = Number(value);
    return value != null && value !== '' && Number.isFinite(n) ? n : null;
  };
  const metal = raw('resources_metal');
  const crystal = raw('resources_crystal');
  const deuterium = raw('resources_deuterium');
  return metal == null || crystal == null || deuterium == null ? null : { metal, crystal, deuterium };
}

/** Energy balance of the body on screen (production − consumption), signed, from the resource bar. */
export function readCurrentEnergy(doc: Document): number | null {
  const el = doc.getElementById('resources_energy');
  const value = el?.getAttribute('data-raw') ?? el?.textContent?.replace(/[^\d-]/g, '');
  const n = Number(value);
  return value != null && value !== '' && Number.isFinite(n) ? n : null;
}

/**
 * Max temperature of the planet on screen, from its tooltip in the game's planet list
 * ("da 27°C a 67°C"): the second value. Null on a moon or when the list does not say.
 */
export function currentMaxTemperature(doc: Document): number | null {
  if (doc.querySelector('meta[name="ogame-planet-type"]')?.getAttribute('content') === 'moon') return null;
  const id = currentBodyId(doc);
  const link = id ? doc.querySelector<HTMLElement>(`#planet-${id} .planetlink`) : null;
  const tip = link?.getAttribute('data-tooltip-title') ?? link?.getAttribute('title') ?? '';
  const temps = Array.from(tip.matchAll(/(-?\d+)\s*°\s*C/g), (m) => Number(m[1]));
  return temps.length >= 2 ? Math.max(...temps.slice(0, 2)) : null;
}

export function currentBodyId(doc: Document): number | null {
  const id = Number(doc.querySelector('meta[name="ogame-planet-id"]')?.getAttribute('content'));
  return Number.isFinite(id) && id > 0 ? id : null;
}
