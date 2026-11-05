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

export function currentBodyId(doc: Document): number | null {
  const id = Number(doc.querySelector('meta[name="ogame-planet-id"]')?.getAttribute('content'));
  return Number.isFinite(id) && id > 0 ? id : null;
}
