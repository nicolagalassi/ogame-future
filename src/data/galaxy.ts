/**
 * Reads the solar system the game shows in the galaxy view (#galaxyContent), as the game drew it.
 * Pure DOM reads: the game loads each system itself when the player moves; Future only reads.
 */

export type PlayerStatus = 'vacation' | 'banned' | 'longinactive' | 'inactive' | 'noob' | 'strong' | 'honorableTarget' | 'outlaw' | 'admin' | 'active';

export interface Debris {
  metal: number;
  crystal: number;
  deuterium: number;
}

export interface GalaxyRow {
  position: number;
  row: Element;
  planetId: number | null;
  planetName: string;
  moonId: number | null;
  playerId: number | null;
  playerName: string;
  statuses: PlayerStatus[];
  /** Overall rank from the game's player tooltip. */
  rank: number | null;
  alliance: string;
  debris: Debris | null;
}

export interface GalaxySystem {
  galaxy: number;
  system: number;
  rows: GalaxyRow[];
  /** Debris in deep space (position 16), when the game shows any. */
  deepDebris: Debris | null;
}

const KNOWN: PlayerStatus[] = ['vacation', 'banned', 'longinactive', 'inactive', 'noob', 'strong', 'honorableTarget', 'outlaw', 'admin', 'active'];

const int = (text: string | null | undefined): number | null => {
  const digits = (text ?? '').replace(/[^\d]/g, '');
  return digits ? Number(digits) : null;
};

/** Metal, crystal and deuterium from the game's debris list items (".debris-content"). */
export function readDebris(container: Element | null): Debris | null {
  const items = [...(container?.querySelectorAll('.debris-content') ?? [])];
  if (!items.length) return null;
  const [metal, crystal, deuterium] = items.map((li) => int(li.textContent) ?? 0);
  const d = { metal: metal ?? 0, crystal: crystal ?? 0, deuterium: deuterium ?? 0 };
  return d.metal + d.crystal + d.deuterium > 0 ? d : null;
}

function statusesOf(cell: Element | null): PlayerStatus[] {
  const found = new Set<PlayerStatus>();
  for (const node of cell?.querySelectorAll('[class*="status_abbr_"]') ?? []) {
    for (const cls of node.classList) {
      const s = cls.replace('status_abbr_', '') as PlayerStatus;
      if (cls.startsWith('status_abbr_') && KNOWN.includes(s)) found.add(s);
    }
  }
  if (found.size > 1) found.delete('active');
  return KNOWN.filter((s) => found.has(s));
}

/** The system on screen, or null when the galaxy table is not there. */
export function readGalaxy(doc: Document): GalaxySystem | null {
  const content = doc.getElementById('galaxyContent');
  if (!content) return null;
  const galaxy = int((doc.getElementById('galaxy_input') as HTMLInputElement | null)?.value);
  const system = int((doc.getElementById('system_input') as HTMLInputElement | null)?.value);
  if (!galaxy || !system) return null;
  const rows: GalaxyRow[] = [];
  for (const row of content.querySelectorAll('.galaxyRow.ctContentRow')) {
    const position = int(row.querySelector('.cellPosition')?.textContent);
    if (!position) continue;
    const nameCell = row.querySelector('.cellPlayerName');
    const playerSpan = nameCell?.querySelector('.playerName');
    const rel = playerSpan?.getAttribute('rel') ?? '';
    // The span's own text, without the hidden tooltip inside it.
    const playerName = playerSpan ? [...playerSpan.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim() : '';
    rows.push({
      position,
      row,
      planetId: int(row.querySelector('[data-planet-id]')?.getAttribute('data-planet-id')),
      planetName: row.querySelector('.cellPlanetName')?.textContent?.trim() ?? '',
      moonId: int(row.querySelector('[data-moon-id]')?.getAttribute('data-moon-id')),
      playerId: rel.startsWith('player') ? int(rel) : null,
      playerName,
      statuses: statusesOf(nameCell ?? null),
      rank: int(nameCell?.querySelector('.rank a')?.textContent),
      alliance: [...(row.querySelector('.cellAlliance > span')?.childNodes ?? [])].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim(),
      debris: readDebris(row.querySelector('.cellDebris')),
    });
  }
  return { galaxy, system, rows, deepDebris: readDebris(doc.getElementById('expeditionDebrisSlotDebrisContainer')) };
}

/** Debris in metal-standard units (metal 1, crystal 1.5, deuterium 3), as elsewhere in Future. */
export const debrisMsu = (d: Debris): number => d.metal + d.crystal * 1.5 + d.deuterium * 3;
