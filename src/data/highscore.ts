/**
 * Reads the game's highscore page (component=highscore, players tab). Pure DOM read.
 */
export interface HighscoreRow {
  row: HTMLElement;
  playerId: number;
  rank: number;
  name: string;
  score: number;
  mine: boolean;
}

export interface Highscore {
  /** Active category button id: points, economy, research, fleet, lifeform, achievement. */
  category: string;
  rows: HighscoreRow[];
}

const int = (text: string | null | undefined) => Number((text ?? '').replace(/[^\d]/g, '')) || 0;

/** The players' table on screen, or null on the alliances tab or when the table is not there. */
export function readHighscore(doc: Document): Highscore | null {
  const table = doc.getElementById('ranks');
  if (!table || !doc.querySelector('#player.active')) return null;
  // Category buttons (points, economy, …) are the .stat_filter ones; #categoryButtons holds player/alliance.
  const category = doc.querySelector('a.stat_filter.active')?.id ?? '';
  const rows: HighscoreRow[] = [];
  for (const row of table.querySelectorAll<HTMLElement>('tbody tr[id^="position"]')) {
    const playerId = int(row.id);
    if (!playerId) continue;
    rows.push({
      row,
      playerId,
      rank: int(row.querySelector('td.position')?.textContent),
      name: row.querySelector('.playername')?.textContent?.trim() ?? '',
      // The cell's own text only: Future adds its figures inside the same cell.
      score: int([...(row.querySelector('td.score')?.childNodes ?? [])].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('')),
      mine: row.classList.contains('myrank'),
    });
  }
  return { category, rows };
}

/**
 * Days until the player catches someone `gap` points ahead, when the player gains `mine` points a
 * day and the other `theirs` (0 when unknown). Null when never at these paces.
 */
export function daysToCatch(gap: number, mine: number, theirs = 0): number | null {
  const closing = mine - theirs;
  if (gap <= 0) return 0;
  return closing > 0 ? gap / closing : null;
}
