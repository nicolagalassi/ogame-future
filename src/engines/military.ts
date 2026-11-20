/**
 * Fleet and defences inside a player's military score, from the public highscore alone (no spy
 * report). The game's rules (highscore help): the total counts every resource once; economy counts
 * buildings and defences; military counts warships and defences; half of civil ships, phalanx and
 * jump gate go to economy and half to military; research and lifeforms have their own scores.
 * Defences are the one part counted twice, so:
 *   defences = economy + research + military + lifeform − total,   fleet = military − defences.
 * Points are 1 per 1,000 resources. An estimate: the scores are read at slightly different moments
 * and rounded by the game, so it is clamped between 0 and the military score.
 */
export interface MilitarySplit {
  fleet: number;
  defence: number;
}

type Scores = Partial<Record<'total' | 'economy' | 'research' | 'military' | 'lifeform', { points: number }>>;

export function splitMilitary(scores: Scores): MilitarySplit | null {
  const { total, economy, research, military } = scores;
  if (!total || !economy || !research || !military) return null;
  // Lifeforms count in the total: a universe without them simply has no lifeform score (0).
  const raw = economy.points + research.points + military.points + (scores.lifeform?.points ?? 0) - total.points;
  const defence = Math.min(military.points, Math.max(0, raw));
  return { fleet: military.points - defence, defence };
}
