/**
 * Expedition bonuses the fleet page does not carry:
 * - the lifeform "ResultBooster" (more resources from expeditions), from the game's own
 *   speciesBonuses export, read once per session at page load like accountInfo (and on Sync);
 * - active expedition items, read from the overview's buff bar (no request).
 * Precedent and values: OGLight calcExpeditionMax (MIT, © 2019 Oz).
 */
import type { CallReason, NetworkGuard } from '../core/guard';
import type { Store } from '../core/storage';

export const SPECIES_BONUSES_PATH =
  '/game/index.php?page=componentOnly&component=externaldataexport&action=speciesBonuses&asJson=1';
export const LF_BONUS_KEY = 'lf.bonuses';
export const ITEMS_KEY = 'items.active';

export interface LfBonuses {
  /** Extra expedition resources, as a fraction (0.92 = +92%). */
  expedition: number;
  at: number;
}

export interface ActiveItems {
  uuids: string[];
  at: number;
}

/** Expedition resource amplifiers by item uuid (7, 30 and 90 day versions). */
export const EXPEDITION_ITEMS: Record<string, number> = {
  '83e5d5b5e3e6ba16eb73edd6731a25ed1feff8a1': 0.1,
  f2f1bf68ded681adf6b45b24a8084b3861a5ce94: 0.15,
  d831a85f8f53defc3e51b7551401b21fb98c28ad: 0.2,
  fd38bf4fa0e07377c2a18556424eee14a6700654: 0.25,
  '7e05baae79bde905f5b2c89bb881d7ff04e8fa73': 0.3,
  '23c859c9f8b4ea7c562719ac829bfc9799250b33': 0.35,
  a5ab323cadd8c172957451f8ddd9950f1c101966: 0.4,
  '6c482898a61fa9ad20e9ce330975f07aa1f76520': 0.15,
  '335efdb763687e956dfe6a330ceddd32f174d753': 0.2,
  '75154767d49fc6867c9d7465a095371993377c88': 0.25,
  b9d9a0d57544363a4ac5531fa01f4b0b17256e24: 0.3,
  edd5cb7bfed46a64d4351fa6f4ef2076dc305e10: 0.35,
  '505fa6275e34b816d5059e26632dcaa8c18bde9a': 0.4,
  '586b20cfd60ef85c6670b62435ca2f44f1071bd8': 0.1,
  e4b33192361f45f4c61691844d0e8ec95fa5a231: 0.15,
  '03ece11ef535f5ef49b203ff50a0466fda5a76e2': 0.2,
  '0049d2538081bea1dc5264a2899a194fe79107f1': 0.25,
  '5e42748915b5cab0ca7fd8e58e842ae9abb12745': 0.3,
  '2466f93d624ef96ffcc9e36f8c953699f525a5eb': 0.35,
  '3876b353a7f99b28520a82df01cd86c31b4cbfe0': 0.4,
  be998009fff22d7eea987cf974a25cacc06d330c: 0.1,
  '93eab867affae30157fc660899d9eac7d3b4f971': 0.15,
  '01c49a959ed989bd1b86abf0526f91ac0b716bfe': 0.2,
  '4cfd5bef27f891a1608b0d1e595cf8bf8cb144c0': 0.25,
  '9c069cb845b9225f9bb191f15d4f6abb0e7e144e': 0.3,
  '1b709fc34003e171528ec345430cbb2e3aa090e5': 0.35,
  b0f6477d68c9683170cb8d32be2df1177669c5a0: 0.4,
};

export function parseSpeciesBonuses(json: unknown, at: number): LfBonuses {
  const data = ((json ?? {}) as { data?: { expedition?: { ResultBooster?: { totalBonus?: { ResultBooster?: unknown } } } } }).data;
  const value = Number(data?.expedition?.ResultBooster?.totalBonus?.ResultBooster);
  return { expedition: Number.isFinite(value) && value > 0 ? value : 0, at };
}

const sessionKey = (store: Store) => `${store.namespace}:lf.hydrated`;

export async function fetchLfBonuses(deps: { guard: NetworkGuard; store: Store }, reason: CallReason, now = Date.now()): Promise<LfBonuses> {
  const response = await deps.guard.request(SPECIES_BONUSES_PATH, reason);
  const bonuses = parseSpeciesBonuses(await response.json(), now);
  deps.store.set(LF_BONUS_KEY, bonuses);
  return bonuses;
}

/** Once per session, at page load (same rule as accountInfo, AGENTS.md §4.1). */
export async function hydrateLfOncePerSession(deps: {
  guard: NetworkGuard;
  store: Store;
  session: Pick<Storage, 'getItem' | 'setItem'>;
}): Promise<LfBonuses | null> {
  const stored = deps.store.get<LfBonuses | null>(LF_BONUS_KEY, null);
  if (stored && deps.session.getItem(sessionKey(deps.store)) === '1') return stored;
  const fresh = await fetchLfBonuses(deps, 'page-load');
  deps.session.setItem(sessionKey(deps.store), '1');
  return fresh;
}

/** Active items on the overview's buff bar; null on pages without it. */
export function readActiveItems(doc: Document, now = Date.now()): ActiveItems | null {
  const bar = doc.getElementById('buffBar');
  if (!bar) return null;
  const uuids = Array.from(bar.querySelectorAll<HTMLElement>('[data-uuid]'))
    .map((e) => e.dataset.uuid ?? '')
    .filter((u) => /^[0-9a-f]{40}$/.test(u));
  return { uuids: [...new Set(uuids)], at: now };
}

/** Sum of the active expedition amplifiers (0.4 = +40%). */
export function expeditionItemBoost(items: ActiveItems | null): number {
  return (items?.uuids ?? []).reduce((sum, u) => sum + (EXPEDITION_ITEMS[u] ?? 0), 0);
}
