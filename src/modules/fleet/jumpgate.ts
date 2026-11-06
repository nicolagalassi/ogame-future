/**
 * Jump gate ("portale"): the game's own dialog keeps the moon's gate rule at home, as
 * OGLight's limiter does. We lower each ship's maximum (the game's `rel` attribute) and
 * the game's "all ships" button by the rule; the jump is still the player's click on
 * the game's own button. No request of ours. A small switch in the dialog turns the rule
 * on or off (a setting of ours, not a game action).
 */
import type { Store } from '../../core/storage';
import { profileFor, SETTINGS_KEY } from '../../engines/fleet';
import { pageWindow } from '../../data/fleet-dispatcher';
import { loadProfiles, loadSettings } from './index';

type T = (k: string, v?: Record<string, string | number>) => string;

const STYLE = `
.fut-jgkeep { color: #FF9A6B; font: 11px Arial, sans-serif; text-align: right; }
.fut-jgbar { display: flex; align-items: center; justify-content: flex-end; gap: 8px; margin: 4px 0; font: 11px Arial, sans-serif; color: #8A9BB0; }
.fut-jgbar button { padding: 1px 8px; border: 1px solid #2C3E57; border-radius: 5px; background: #0A111C; color: #8A9BB0; font: 11px Arial, sans-serif; cursor: pointer; }
.fut-jgbar button.on { border-color: #38C56E; color: #38C56E; }
`;

export function applyJumpgateReserve(doc: Document, store: Store, bodyId: number, t: T): number {
  const gate = doc.getElementById('jumpgate');
  if (!gate || doc.getElementById('jumpgateNotReady')) return 0;
  if (!doc.getElementById('fut-jg-style')) {
    const style = doc.createElement('style');
    style.id = 'fut-jg-style';
    style.textContent = STYLE;
    doc.head.append(style);
  }
  const on = loadSettings(store).gateOn;
  const reserve = on ? profileFor(loadProfiles(store), bodyId).gate : {};
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
    const keep = Math.min(max, reserve[id] ?? 0);
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
  switchBar(doc, gate, store, bodyId, t, on, kept);
  return kept;
}

/** "Riserva portale: −N · [attiva]": the switch re-applies the rule at once. */
function switchBar(doc: Document, gate: HTMLElement, store: Store, bodyId: number, t: T, on: boolean, kept: number): void {
  let bar = gate.querySelector<HTMLElement>('.fut-jgbar');
  if (!bar) {
    bar = doc.createElement('div');
    bar.className = 'fut-jgbar';
    gate.prepend(bar);
  }
  const label = doc.createElement('span');
  label.textContent = on ? t('fleet.jumpgateKept', { count: kept.toLocaleString() }) : t('fleet.jumpgateOff');
  const toggle = doc.createElement('button');
  toggle.type = 'button';
  toggle.className = on ? 'on' : '';
  toggle.textContent = `${t('fleet.rule.gate')}: ${on ? t('fleet.on') : t('fleet.off')}`;
  toggle.addEventListener('click', (e) => {
    e.preventDefault();
    store.set(SETTINGS_KEY, { ...loadSettings(store), gateOn: !loadSettings(store).gateOn });
    applyJumpgateReserve(doc, store, bodyId, t);
  });
  bar.replaceChildren(label, toggle);
}

/** Wraps the game's initJumpgate (called when the dialog content arrives), like OGLight. */
export function watchJumpgate(doc: Document, store: Store, bodyId: number, t: T): void {
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
