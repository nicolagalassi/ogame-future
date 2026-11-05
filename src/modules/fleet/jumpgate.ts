/**
 * Jump gate ("portale"): the game's own dialog keeps reserve 1 of the moon at home, as
 * OGLight's limiter does. We lower each ship's maximum (the game's `rel` attribute) and
 * the game's "all ships" button by the reserve; the jump is still the player's click on
 * the game's own button. No request of ours.
 */
import type { Store } from '../../core/storage';
import { profileFor } from '../../engines/fleet';
import { pageWindow } from '../../data/fleet-dispatcher';
import { loadProfiles } from './index';

export function applyJumpgateReserve(doc: Document, store: Store, bodyId: number, t: (k: string, v?: Record<string, string | number>) => string): number {
  const gate = doc.getElementById('jumpgate');
  if (!gate || doc.getElementById('jumpgateNotReady')) return 0;
  if (!doc.getElementById('fut-jg-style')) {
    const style = doc.createElement('style');
    style.id = 'fut-jg-style';
    style.textContent = '.fut-jgkeep { color: #FF9A6B; font: 11px Arial, sans-serif; text-align: right; }';
    doc.head.append(style);
  }
  const reserve = profileFor(loadProfiles(store), bodyId).reserve;
  const all: Record<string, number> = {};
  let kept = 0;
  gate.querySelectorAll<HTMLElement>('.ship_input_row').forEach((row) => {
    const head = row.previousElementSibling as HTMLElement | null;
    if (head?.classList.contains('tdInactive')) return;
    const input = row.querySelector<HTMLInputElement>('input[id^="ship_"]');
    if (!input) return;
    const id = input.id.replace('ship_', '');
    // Remember the game's own maximum once, so re-applying never subtracts twice.
    if (!input.dataset.futMax) input.dataset.futMax = input.getAttribute('rel') ?? '0';
    const max = Number(input.dataset.futMax) || 0;
    const keep = Math.min(max, reserve.ships[id] ?? 0);
    const amount = max - keep;
    kept += keep;
    input.setAttribute('rel', String(amount));
    if (Number(input.value) > amount) input.value = String(amount);
    // Same handlers OGLight rewrites: the game's own "max" for this ship.
    head?.querySelector('.quantity')?.setAttribute('onclick', `toggleMaxShips('#jumpgateForm', ${id}, ${amount})`);
    head?.querySelector('a')?.setAttribute('onclick', `toggleMaxShips('#jumpgateForm', ${id}, ${amount})`);
    let note = row.querySelector<HTMLElement>('.fut-jgkeep');
    if (!note) {
      note = doc.createElement('div');
      note.className = 'fut-jgkeep';
      row.append(note);
    }
    note.textContent = keep ? `−${keep.toLocaleString()}` : '';
    note.title = t('fleet.jumpgateKeep');
    all[id] = amount;
  });
  gate.querySelector('#sendall')?.setAttribute('onclick', `setMaxIntInput("#jumpgateForm", ${JSON.stringify(all)})`);
  return kept;
}

/** Wraps the game's initJumpgate (called when the dialog content arrives), like OGLight. */
export function watchJumpgate(doc: Document, store: Store, bodyId: number, t: (k: string, v?: Record<string, string | number>) => string): void {
  const win = pageWindow() as unknown as { initJumpgate?: (...args: unknown[]) => unknown };
  const original = win.initJumpgate;
  if (typeof original !== 'function' || (original as { futHooked?: boolean }).futHooked) return;
  const wrapped = function (this: unknown, ...args: unknown[]) {
    const result = original.apply(this, args);
    try {
      applyJumpgateReserve(doc, store, bodyId, t);
    } catch {
      /* never break the game's dialog */
    }
    return result;
  };
  (wrapped as { futHooked?: boolean }).futHooked = true;
  win.initJumpgate = wrapped;
}
