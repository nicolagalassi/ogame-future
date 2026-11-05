/**
 * Reads the player's points from the overview page (#scoreContentField), e.g.
 * "1.977.533.840 (Posizione 6 su 345)". Pure DOM read: no network call.
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
