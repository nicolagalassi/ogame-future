/**
 * Storage adapter. Today it wraps GM_getValue/GM_setValue; when Future becomes a
 * browser extension only GMStore needs a sibling, nothing else changes.
 * Data never leaves the player's machine (AGENTS.md §1.9).
 */

export interface KeyValueStore {
  get<T>(key: string, fallback: T): T;
  set(key: string, value: unknown): void;
  /** Every key held, across all universes and players (for the backup). */
  keys(): string[];
}

export class GMStore implements KeyValueStore {
  get<T>(key: string, fallback: T): T {
    return GM_getValue<T>(key, fallback);
  }
  set(key: string, value: unknown): void {
    GM_setValue(key, value);
  }
  keys(): string[] {
    return GM_listValues();
  }
}

export class MemoryStore implements KeyValueStore {
  private readonly data = new Map<string, unknown>();
  get<T>(key: string, fallback: T): T {
    return this.data.has(key) ? (this.data.get(key) as T) : fallback;
  }
  set(key: string, value: unknown): void {
    this.data.set(key, value);
  }
  keys(): string[] {
    return [...this.data.keys()];
  }
}

/** Keeps each universe and player apart: one install can serve several accounts. */
export class Store {
  constructor(
    private readonly kv: KeyValueStore,
    readonly namespace: string,
  ) {}

  get<T>(key: string, fallback: T): T {
    return this.kv.get<T>(`${this.namespace}:${key}`, fallback);
  }

  set(key: string, value: unknown): void {
    this.kv.set(`${this.namespace}:${key}`, value);
  }
}

/** Reads universe and player id from the meta tags OGame puts on every game page. */
export function serverNamespace(doc: Document): string | null {
  const meta = (name: string) => doc.querySelector(`meta[name="${name}"]`)?.getAttribute('content') ?? null;
  const universe = meta('ogame-universe');
  const player = meta('ogame-player-id');
  return universe && player ? `future:${universe}:${player}` : null;
}
