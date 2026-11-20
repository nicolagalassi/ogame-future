/**
 * Links to the game's own pages, as the player would open them (a normal navigation on a click,
 * no request of Future's, no `cp=`: AGENTS.md §4.2).
 */

/** The players' highscore on the page that shows this player (100 per page), the row highlighted by the game. */
export function highscoreHref(playerId: number, rank?: number | null): string {
  const site = rank && rank > 0 ? `&site=${Math.max(1, Math.ceil(rank / 100))}` : '';
  return `/game/index.php?page=ingame&component=highscore&category=1${site}&searchRelId=${playerId}`;
}
