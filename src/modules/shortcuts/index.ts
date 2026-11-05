/**
 * Keyboard shortcuts, as in OGLight: one key = one action of the player (switch planet,
 * prepare a fleet). A key never sends a fleet by itself: on the fleet page the game's own
 * Enter / "Invia flotta" stays the send.
 *
 * Keys are ignored while typing in a field, with Ctrl/Alt/Meta held, on auto-repeat, and
 * while one of our windows is open.
 */

export interface Shortcut {
  key: string;
  /** i18n key of what it does, for the list in the settings. */
  label: string;
  run: () => void;
}

const registry = new Map<string, Shortcut>();
let installed: Document | null = null;

function typing(doc: Document): boolean {
  const a = doc.activeElement as HTMLElement | null;
  if (!a) return false;
  const tag = a.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || a.isContentEditable;
}

export function registerShortcuts(doc: Document, list: Shortcut[]): void {
  for (const s of list) registry.set(s.key.toLowerCase(), s);
  if (installed === doc) return;
  installed = doc;
  doc.addEventListener(
    'keydown',
    (e) => {
      if (e.repeat || e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
      if (typing(doc) || doc.getElementById('fut-fleet-modal') || doc.getElementById('fut-dashboard')) return;
      const s = registry.get(e.key.toLowerCase());
      if (!s) return;
      e.preventDefault();
      e.stopPropagation();
      s.run();
    },
    true,
  );
}

export function listShortcuts(): Shortcut[] {
  return [...registry.values()];
}

/** Test helper. */
export function resetShortcuts(): void {
  registry.clear();
  installed = null;
}

/** Same page on another planet or moon: the URL the game's planet list would open (cp). */
export function switchBodyUrl(href: string, cp: number): string {
  const u = new URL(href);
  for (const k of [...u.searchParams.keys()]) if (k.startsWith('fut')) u.searchParams.delete(k);
  u.searchParams.set('cp', String(cp));
  return u.toString();
}
