/**
 * Lifeform technologies that change resource production or costs, per level, as InfoCompte has
 * them (MIT, Vulca, benneb, The Stubbs). Each row: [metal, crystal, deuterium, cap metal, cap
 * crystal, cap deuterium]; a cap of 0 means none. Buildings count on their own planet; research
 * counts for the whole account, scaled by the research boosters of the planet it is on.
 *
 * Also the reader of the lifeform settings page (how much each species' level adds to its
 * technologies). Pure tables and DOM reads: no network call.
 */
export type LfRow = readonly [number, number, number, number, number, number];

export const LF_BUILDING_BONUS: Record<number, LfRow> = {
  11103: [0.0025, 0, 0, 0.25, 0, 0],
  11106: [0.015, 0, 0, 0, 0, 0],
  11108: [0, 0.015, 0.01, 0, 0, 0],
  11111: [0.005, 0, 0, 1, 0, 0],
  12103: [0.0025, 0, 0, 0.25, 0, 0],
  12106: [0.02, 0, 0, 0, 0, 0],
  12108: [0.01, 0, 0, 0.5, 0, 0],
  12109: [0, 0.02, 0, 0, 0, 0],
  12110: [0, 0, 0.02, 0, 0, 0],
  12111: [0.005, 0, 0, 0.5, 0, 0],
  13103: [0.0025, 0, 0, 0.25, 0, 0],
  13107: [0, 0.003, 0, 0, 0, 0],
  13110: [0, 0, 0.02, 0, 0, 0],
  13111: [0.004, 0, 0, 1, 0, 0],
  14103: [0.0025, 0, 0, 0.25, 0, 0],
  14107: [0.0025, 0, 0, 0, 0, 0],
};

export const LF_RESEARCH_BONUS: Record<number, LfRow> = {
  11202: [0.0006, 0.0006, 0.0006, 0, 0, 0],
  11208: [0.0006, 0.0006, 0.0006, 0, 0, 0],
  12202: [0, 0.0008, 0, 0, 0, 0],
  12203: [0, 0, 0.0008, 0, 0, 0],
  12205: [0.0008, 0.0008, 0.0008, 0, 0, 0],
  12207: [0.0008, 0, 0, 0, 0, 0],
  12209: [0.0015, 0, 0, 0.5, 0, 0],
  12210: [0.0008, 0, 0, 0, 0, 0],
  12211: [0, 0.0008, 0, 0, 0, 0],
  12212: [0, 0, 0.0008, 0, 0, 0],
  13201: [0, 0, 0.0008, 0, 0, 0],
  13206: [0.0006, 0.0006, 0.0006, 0, 0, 0],
  13213: [0.0006, 0.0006, 0.0006, 0, 0, 0],
  14202: [0, 0, 0.0008, 0, 0, 0],
  14212: [0.0006, 0.0006, 0.0006, 0, 0, 0],
};

/** Buildings and research that add to the mines' base output. */
export const LF_PRODUCTION_BUILDINGS = [11106, 11108, 12106, 12109, 12110, 13110];
export const LF_PRODUCTION_RESEARCH = [11202, 11208, 12202, 12203, 12205, 12207, 12210, 12211, 12212, 13201, 13206, 13213, 14202, 14212];
/** Buildings that make the planet's lifeform research stronger: [id, which column of its row]. */
export const LF_RESEARCH_BOOSTERS: [number, 0 | 1][] = [[11111, 0], [13107, 1], [13111, 0]];
/** Kaelesh building that makes Kaelesh research on its planet stronger. */
export const KAELESH_BOOSTER = 14107;
/** Cost discounts: what each building discounts on its own planet. */
export const LF_RESEARCH_DISCOUNT = [11103, 12103, 13103, 14103];
export const ROCKTAL_BUILDING_DISCOUNT = 12108;
export const PRODUCER_DISCOUNT = 12111;
/** Producers 12111 discounts: mines, solar and fusion plants, the first two lifeform buildings. */
export const PRODUCERS = new Set([1, 2, 3, 4, 12, 11101, 11102, 12101, 12102, 13101, 13102, 14101, 14102]);
/** Research 12209 discounts plasma technology. */
export const PLASMA_DISCOUNT = 12209;

export const LF_LEVELS_KEY = 'lf.levels';
/** Species (1–4) → how much its level adds to its technologies, as a fraction (0.1 = +10% at level 100). */
export type LfLevels = Record<string, number>;

/** On the lifeform settings page: each discovered species' technology bonus, else null. */
export function readLfLevels(doc: Document): LfLevels | null {
  const component = new URL(doc.location?.href ?? 'http://x/').searchParams.get('component');
  if (component !== 'lfsettings') return null;
  const out: LfLevels = {};
  for (const item of Array.from(doc.querySelectorAll('.lifeform-item'))) {
    const species = Number(/lifeform(\d)/.exec(item.querySelector('.lifeform-item-icon')?.className ?? '')?.[1]);
    if (!species) continue;
    const ps = Array.from(item.querySelectorAll('.lifeform-item-wrapper p'));
    // "Bonus Tecnologia Forme di vita: 10%" in the last paragraph; else "level N" in the one before.
    const pct = /(\d+(?:[.,]\d+)?)\s*%/.exec(ps[ps.length - 1]?.textContent ?? '');
    if (pct) out[species] = Number(pct[1]!.replace(',', '.')) / 100;
    else {
      const level = Number(/\d+/.exec(ps[ps.length - 2]?.textContent ?? '')?.[0]);
      if (level > 0) out[species] = level * 0.001;
    }
  }
  return Object.keys(out).length ? out : null;
}
