/**
 * Reads the player's points from the overview page (#scoreContentField), e.g.
 * "1.977.533.840 (Posizione 6 su 345)". Pure DOM read: no network call.
 * The game types the field in letter by letter ("_", "1_", …) after the page loads, so it can
 * still be empty or half written when Future starts: watchScore waits for the closing bracket, then stops.
 */
export interface Score {
  points: number;
  rank: number | null;
  of: number | null;
  at: number;
}

export const SCORE_KEY = 'account.score';

export function readScore(doc: Document, now: number): Score | null {
  const text = doc.getElementById('scoreContentField')?.textContent?.trim();
  if (!text) return null;
  // Thousands separators differ by language (".", ",", spaces): drop them inside each number.
  const numbers = (text.match(/\d[\d.,\s  ]*/g) ?? []).map((n) => Number(n.replace(/[^\d]/g, '')));
  const [points, rank, of] = numbers;
  if (points === undefined || !Number.isFinite(points)) return null;
  return { points, rank: rank ?? null, of: of ?? null, at: now };
}

/** Reports the score now if the field is filled, else once the game fills it (then stops watching). */
export function watchScore(doc: Document, now: () => number, onScore: (score: Score) => void): void {
  const field = doc.getElementById('scoreContentField');
  if (!field) return;
  // The text ends with ")" once the game has finished typing it.
  const typed = () => /\)\s*$/.test(field.textContent ?? '');
  const seen = typed() ? readScore(doc, now()) : null;
  if (seen) return onScore(seen);
  const view = doc.defaultView;
  if (!view) return;
  const observer = new view.MutationObserver(() => {
    const score = typed() ? readScore(doc, now()) : null;
    if (!score) return;
    observer.disconnect();
    onScore(score);
  });
  observer.observe(field, { childList: true, characterData: true, subtree: true });
}
