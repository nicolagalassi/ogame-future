/**
 * Jump gate ("portale"): the game's own dialog keeps the moon's gate rule at home, as
 * OGLight's limiter does. We lower each ship's maximum (the game's `rel` attribute) and
 * the game's "all ships" button by the rule; the jump is still the player's click on
 * the game's own button. No request of ours. A small switch in the dialog turns the rule
 * on or off (a setting of ours, not a game action).
 */
import type { Store } from '../../core/storage';
import { parseAmount, profileFor, PROFILES_KEY, SETTINGS_KEY } from '../../engines/fleet';
import { iconSvg } from './icons';
import { groupInt, groupWhileTyping } from '../../core/format';
import { pageWindow } from '../../data/fleet-dispatcher';
import { loadProfiles, loadSettings } from './index';

type T = (k: string, v?: Record<string, string | number>) => string;

const STYLE = `
.fut-jgkeep { color: #FF9A6B; font: 11px Arial, sans-serif; text-align: right; }
.fut-jgkeep input { box-sizing: border-box; display: block; width: 100%; max-width: 84px; margin: 2px 0 0 auto; height: 20px; padding: 0 4px; border: 1px solid #2C3E57; border-radius: 4px; background: #0A111C; color: #E6EDF5; font: 11px Arial, sans-serif; text-align: right; }
.fut-jgkeep input:focus { outline: none; border-color: #4FD1E8; }
.fut-jgbar { display: flex; align-items: center; justify-content: flex-end; gap: 6px; margin: 4px 0; font: 11px Arial, sans-serif; color: #A3AFBD; }
.fut-jgbar > span { margin-right: auto; }
.fut-jgbar button { display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 8px; border: 1px solid #24344B; border-radius: 13px; background: #0A111C; color: #8592A1; font: 11px Arial, sans-serif; cursor: pointer; }
.fut-jgbar button:hover { color: #E6EDF5; border-color: #4FD1E8; }
.fut-jgbar button:focus-visible { outline: 2px solid #4FD1E8; outline-offset: 1px; }
.fut-jgbar .track { position: relative; width: 20px; height: 12px; border-radius: 6px; background: #3A4A60; }
.fut-jgbar .track::after { content: ""; position: absolute; top: 2px; left: 2px; width: 8px; height: 8px; border-radius: 50%; background: #C9D2DC; }
.fut-jgbar button[aria-checked="true"] { border-color: #1F5A68; color: #CFF5FC; }
.fut-jgbar button[aria-checked="true"] .track { background: #4FD1E8; }
.fut-jgbar button[aria-checked="true"] .track::after { transform: translateX(8px); background: #06222A; }
.fut-jgbar button[aria-pressed="true"] { border-color: #4FD1E8; color: #CFF5FC; background: #12283A; }
`;

/** Whether the gate's rule is being edited in the dialog (ships to keep, one field per ship). */
let editing = false;

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
  const stored = profileFor(loadProfiles(store), bodyId).gate;
  const reserve = on ? stored : {};
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
    note.title = t('fleet.jumpgateKeep');
    if (editing) {
      // The rule itself, edited where it is used: how many of this ship stay on the moon.
      const field = doc.createElement('input');
      field.type = 'text';
      field.inputMode = 'numeric';
      field.placeholder = t('fleet.jumpgateStay');
      field.title = t('fleet.jumpgateKeep');
      // Thousands grouped as in every other number field (the page's own language).
      field.value = stored[id] ? groupInt(stored[id], doc.documentElement.lang || 'it') : '';
      groupWhileTyping(field, doc.documentElement.lang || 'it');
      field.setAttribute('aria-label', t('fleet.jumpgateKeep'));
      field.setAttribute('autocomplete', 'off');
      for (const ev of ['keydown', 'keyup', 'keypress']) field.addEventListener(ev, (e) => e.stopPropagation());
      field.addEventListener('change', () => {
        const profiles = loadProfiles(store);
        const profile = profileFor(profiles, bodyId);
        const gateRule = { ...profile.gate };
        const n = parseAmount(field.value);
        if (n > 0) gateRule[id] = n;
        else delete gateRule[id];
        profiles[String(bodyId)] = { ...profile, gate: gateRule };
        store.set(PROFILES_KEY, profiles);
        applyJumpgateReserve(doc, store, bodyId, t);
      });
      note.replaceChildren(field);
    } else note.textContent = keep ? `−${keep.toLocaleString()}` : '';
    all[id] = amount;
  });
  gate.querySelector('#sendall')?.setAttribute('onclick', `setMaxIntInput("#jumpgateForm", ${JSON.stringify(all)})`);
  switchBar(doc, gate, store, bodyId, t, on, kept);
  return kept;
}

/** "Restano qui N navi", the rule's switch and the pen that opens the rule's fields on the ship rows. */
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
  toggle.setAttribute('role', 'switch');
  toggle.setAttribute('aria-checked', String(on));
  toggle.setAttribute('aria-label', t('fleet.rule.gate'));
  toggle.title = `${t('fleet.rule.gate')}: ${on ? t('fleet.on') : t('fleet.off')}`;
  toggle.innerHTML = `${iconSvg('gate', 15)}<i class="track"></i>`;
  toggle.addEventListener('click', (e) => {
    e.preventDefault();
    store.set(SETTINGS_KEY, { ...loadSettings(store), gateOn: !loadSettings(store).gateOn });
    applyJumpgateReserve(doc, store, bodyId, t);
  });
  const edit = doc.createElement('button');
  edit.type = 'button';
  edit.setAttribute('aria-pressed', String(editing));
  edit.title = t('fleet.jumpgateEdit');
  edit.setAttribute('aria-label', edit.title);
  edit.innerHTML = iconSvg('rules', 15);
  edit.addEventListener('click', (e) => {
    e.preventDefault();
    editing = !editing;
    applyJumpgateReserve(doc, store, bodyId, t);
  });
  bar.replaceChildren(label, toggle, edit);
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
