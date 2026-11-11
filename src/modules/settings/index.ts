/**
 * Settings window: every Future preference in one place, in sections (planet menu, inbox and
 * spy table, fleet, keys and touch bar, data). The gear in the toolbar opens it. Each choice applies at once and is saved
 * locally; nothing here reaches the server.
 */
import { icon } from '../../core/icons';
import type { Store } from '../../core/storage';
import { WINDOW_SHEET } from '../../core/sheet';
import { SIM_KEY, SIM_TOOLS, simTool, type SimTool } from '../../engines/sim-links';
import { FOLD_KEY } from '../messages';
import { SPY_SHARED_KEY } from '../messages/spy-table';
import type { MenuSettings } from '../planet-menu';
import { CARGO_SHIPS, parseAmount, SETTINGS_KEY as FLEET_SETTINGS_KEY, settingsFrom, type FleetSettings } from '../../engines/fleet';
import { formatUnits } from '../../core/format';
import { BIG_DEBRIS, BIG_DEBRIS_KEY } from '../marks/side';
import { SHIPS_INFO_KEY, type ShipsInfo } from '../../data/fleet-dispatcher';
import { iconSvg, type IconName as FleetIcon } from '../fleet/icons';
import { ACTIONS, assignKey, glyph, keyLabel, keymap, resetKeys, TOUCH_KEY, usableKey, type TouchMode } from '../shortcuts';

export const SETTINGS_ID = 'fut-settings-window';
const TAB_KEY = 'settings.tab';
export type Section = 'menu' | 'mail' | 'galaxy' | 'fleet' | 'keys' | 'data';
const SECTIONS: Section[] = ['menu', 'mail', 'galaxy', 'fleet', 'keys', 'data'];

export interface SettingsOptions {
  doc: Document;
  store: Store;
  t: (key: string, vars?: Record<string, string | number>) => string;
  menu: {
    settings: MenuSettings;
    /** False when the screen is too narrow for the side-by-side view. */
    canSide: boolean;
    onChange: (next: MenuSettings) => void;
  };
  /** Backup and OGLight import; the import returns how many values or a message. */
  backup?: { onExport: () => number; onImport: (text: string) => number | string };
  /** Facts shown at the bottom of the data section (colonies, last sync). */
  notes?: string[];
  /** Called after an inbox choice, so the open inbox redraws. */
  onMailChange?: () => void;
  /** The player's planets and moons, for the fleet favourites. */
  bodies?: { id: number; label: string }[];
  /** Called after a fleet or key choice, so the fleet bar and the touch bar redraw. */
  onFleetChange?: () => void;
  /** Section to open on, instead of the last one used. */
  section?: Section;
}

const CSS = `
:host { --panel-w: 620px; }
.body { display: flex; flex-direction: column; }
/* Rows that follow each other read as one card, split by hairlines. */
.row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 2px 16px; padding: 9px 12px;
  border: 1px solid var(--line); border-top-color: var(--line-soft); margin-top: -1px; background: var(--raised); }
.row:first-child, :not(.row) + .row { margin-top: 0; border-top-color: var(--line); border-radius: 7px 7px 0 0; }
.row:last-child, .row:has(+ :not(.row)) { border-radius: 0 0 7px 7px; }
.row:first-child:last-child, .row:first-child:has(+ :not(.row)), :not(.row) + .row:last-child, :not(.row) + .row:has(+ :not(.row)) { border-radius: 7px; }
.row + :not(.row) { margin-top: 6px; }
.row .name { color: var(--text); font-size: 12px; font-weight: 700; }
.row .desc { grid-column: 1; color: var(--muted); font-size: 11px; line-height: 1.4; }
.row .control { grid-column: 2; grid-row: 1 / span 2; display: inline-flex; }
.seg { height: 26px; padding: 0 12px; border: 1px solid var(--line); background: #0A111C; color: var(--muted); font: 12px Arial, sans-serif; cursor: pointer; white-space: nowrap; }
.seg:first-child { border-radius: 13px 0 0 13px; }
.seg:last-child { border-radius: 0 13px 13px 0; }
.seg + .seg { border-left: 0; }
.seg:only-child { border-radius: 13px; }
.seg:hover { color: var(--text); }
.seg[aria-pressed="true"] { background: var(--accent-soft); border-color: var(--accent); color: var(--text); font-weight: 700; }
.seg[aria-pressed="true"] + .seg { border-left: 1px solid var(--line); }
.seg:disabled { opacity: 0.45; cursor: not-allowed; }
.status { min-height: 16px; padding: 0 4px; color: var(--accent); font-size: 11px; }
.notes { padding: 2px 4px; color: var(--muted); font-size: 11px; line-height: 1.5; }
.field { height: 26px; width: 190px; padding: 0 8px; border: 1px solid var(--line); border-radius: 6px; background: #0A111C; color: var(--text); font: 12px Arial, sans-serif; }
input.field { width: 190px; }
.field:hover { border-color: #2B6F7D; }
.group { display: flex; align-items: center; gap: 7px; margin: 12px 0 6px; padding: 0 2px; color: var(--text); font-size: 12px; font-weight: 700; }
.group:first-child { margin-top: 8px; }
.group .gi { display: inline-flex; color: var(--accent); }
.switch { display: inline-flex; align-items: center; height: 28px; padding: 0 2px; border: 0; background: none; cursor: pointer; }
.switch:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; border-radius: 9px; }
.keygrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 6px; }
.keygrid + .row { margin-top: 12px; }
.keyrow { display: grid; grid-template-columns: 28px minmax(0, 1fr) auto auto; align-items: center; gap: 10px; padding: 6px 8px 6px 10px;
  border: 1px solid var(--line); border-radius: 7px; background: var(--raised); }
.keyrow .g, .keyrow .g span { display: inline-flex; color: var(--accent); }
.keyrow .name { color: var(--text); font-size: 12px; }
.keyrow .fixed { display: block; color: var(--muted); font-size: 11px; }
.keycap { min-width: 44px; height: 28px; padding: 0 10px; border: 1px solid #2B6F7D; border-radius: 6px; background: #0A111C; color: var(--accent);
  font: 700 12px var(--mono); cursor: pointer; }
.keycap:hover { border-color: var(--accent); }
.keycap.none { border-style: dashed; border-color: var(--line); color: var(--muted); font: 11px Arial, sans-serif; }
.keycap.listening { border-color: var(--warn); color: var(--warn); font: 11px Arial, sans-serif; }
.keycap:disabled { cursor: default; border-color: var(--line); color: var(--muted); }
.mini { height: 28px; padding: 0 8px; border: 0; border-radius: 6px; background: none; color: var(--muted); font: 11px Arial, sans-serif; cursor: pointer; }
.mini:hover { background: #16243A; color: var(--text); }
.mini[hidden] { display: inline-block; visibility: hidden; }
@media (max-width: 520px) { .row { grid-template-columns: 1fr; } .row .control { grid-column: 1; grid-row: auto; } }
`;

let keyHandler: ((e: KeyboardEvent) => void) | null = null;

export function closeSettings(doc: Document): void {
  doc.getElementById(SETTINGS_ID)?.remove();
  if (keyHandler) doc.removeEventListener('keydown', keyHandler, true);
  keyHandler = null;
}

export function openSettings(o: SettingsOptions): void {
  const { doc, store, t } = o;
  closeSettings(doc);
  const host = doc.createElement('div');
  host.id = SETTINGS_ID;
  const root = host.attachShadow({ mode: 'open' });
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text?: string) => {
    const n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };
  const style = el('style');
  style.textContent = WINDOW_SHEET + CSS;
  const backdrop = el('div', 'backdrop');
  const panel = el('div', 'panel');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', t('toolbar.settings'));
  backdrop.append(panel);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeSettings(doc);
  });
  root.append(style, backdrop);
  doc.body.append(host);

  let section = o.section ?? store.get<Section>(TAB_KEY, 'menu');
  if (!SECTIONS.includes(section)) section = 'menu';
  let menu = { ...o.menu.settings };
  let status = '';

  /** A choice of two or more: one segmented control, the current value pressed. */
  const choice = <V>(options: [V, string][], current: V, onPick: (v: V) => void, disabled = false) => {
    const box = el('span', 'control');
    box.setAttribute('role', 'group');
    for (const [v, label] of options) {
      const b = el('button', 'seg', label);
      b.type = 'button';
      b.disabled = disabled;
      b.setAttribute('aria-pressed', String(v === current));
      b.addEventListener('click', () => {
        if (v === current) return;
        onPick(v);
        draw();
      });
      box.append(b);
    }
    return box;
  };
  const row = (name: string, desc: string, control: HTMLElement) => {
    const r = el('div', 'row');
    r.append(el('span', 'name', name), el('span', 'desc', desc), control);
    // A switch has no text of its own: the row's name is its label.
    control.querySelector('.switch')?.setAttribute('aria-label', name);
    return r;
  };
  /** On or off: one switch. */
  const yesNo = (v: boolean, onPick: (v: boolean) => void) => {
    const box = el('span', 'control');
    const b = el('button', 'switch');
    b.type = 'button';
    b.setAttribute('role', 'switch');
    b.setAttribute('aria-checked', String(v));
    b.title = t(v ? 'settings.on' : 'settings.off');
    b.append(el('i', 'sw-track'));
    b.addEventListener('click', () => {
      onPick(!v);
      draw();
    });
    box.append(b);
    return box;
  };
  /** Heading of a group of rows, with the icon the fleet bar uses for the same thing. */
  const group = (label: string, glyph: Element) => {
    const g = el('div', 'group');
    const gi = el('span', 'gi');
    gi.append(glyph);
    g.append(gi, doc.createTextNode(label));
    return g;
  };
  const fleetGlyph = (name: FleetIcon) => {
    const span = el('span');
    span.style.display = 'inline-flex';
    span.innerHTML = iconSvg(name, 16);
    return span;
  };

  /** A drop-down list; the change applies at once. */
  const select = (options: [string, string][], current: string, onPick: (v: string) => void) => {
    const box = el('span', 'control');
    const sel = el('select', 'field');
    for (const [v, label] of options) {
      const opt = el('option', '', label);
      opt.value = v;
      opt.selected = v === current;
      sel.append(opt);
    }
    sel.addEventListener('change', () => onPick(sel.value));
    box.append(sel);
    return box;
  };

  /* Fleet: the general settings of the fleet bar (this body's rules stay on the fleet page). */
  const fleetRows = (): HTMLElement[] => {
    const f = settingsFrom(store.get<Partial<FleetSettings>>(FLEET_SETTINGS_KEY, {}));
    const set = (next: Partial<FleetSettings>) => {
      store.set(FLEET_SETTINGS_KEY, { ...settingsFrom(store.get<Partial<FleetSettings>>(FLEET_SETTINGS_KEY, {})), ...next });
      o.onFleetChange?.();
    };
    const ships = store.get<ShipsInfo>(SHIPS_INFO_KEY, {});
    const shipName = (id: number) => ships[String(id)]?.name || (t(`ship.${id}`) !== `ship.${id}` ? t(`ship.${id}`) : `#${id}`);
    const cargo = CARGO_SHIPS.map((id) => [String(id), shipName(id)] as [string, string]);
    const speeds = Array.from({ length: 10 }, (_, i) => [String((i + 1) * 10), `${(i + 1) * 10}%`] as [string, string]);
    const dest: [string, string][] = [['0', t('fleet.none')], ...(o.bodies ?? []).map((b) => [String(b.id), b.label] as [string, string])];
    const value = el('span', 'control');
    const input = el('input', 'field');
    input.type = 'text';
    input.value = f.expeditionValue;
    input.placeholder = t('fleet.auto');
    input.setAttribute('aria-label', t('fleet.expeditionValue'));
    input.addEventListener('change', () => set({ expeditionValue: input.value.trim() }));
    value.append(input);
    return [
      group(t('fleet.transportTitle'), fleetGlyph('transport')),
      row(t('fleet.mainShip'), t('settings.mainShipHint'), select(cargo, String(f.mainShip), (v) => set({ mainShip: Number(v) }))),
      row(t('fleet.secondShip'), t('settings.secondShipHint'), select([['0', t('fleet.none')], ...cargo], String(f.secondShip), (v) => set({ secondShip: Number(v) }))),
      row(t('fleet.speed'), t('settings.speedHint'), select(speeds, String(f.transportSpeed), (v) => set({ transportSpeed: Number(v) }))),
      group(t('fleet.favTitle'), icon(doc, 'star', 16)),
      row(t('fleet.favTransport'), t('settings.favHint'), select(dest, String(f.favTransport ?? 0), (v) => set({ favTransport: Number(v) || null }))),
      row(t('fleet.favDeploy'), t('settings.favHint'), select(dest, String(f.favDeploy ?? 0), (v) => set({ favDeploy: Number(v) || null }))),
      group(t('fleet.expeditionTitle'), fleetGlyph('expedition')),
      row(t('fleet.expeditionShip'), t('settings.expShipHint'), select([['0', t('fleet.bestShip')], ...[219, 203, 202].map((id) => [String(id), shipName(id)] as [string, string])], String(f.expeditionShip), (v) => set({ expeditionShip: Number(v) }))),
      row(t('fleet.expeditionValue'), t('settings.expValueHint'), value),
      row(t('fleet.expeditionExtras'), t('settings.extrasHint'), yesNo(f.expeditionExtras, (v) => set({ expeditionExtras: v }))),
      group(t('fleet.repeatTitle'), fleetGlyph('repeat')),
      row(t('fleet.repeat'), t('fleet.repeatHint'), yesNo(f.repeat, (v) => set({ repeat: v }))),
    ];
  };

  /* Keys: one row per action, the key changes on a click; the touch bar's mode. */
  let listening: string | null = null;
  const keyRows = (): HTMLElement[] => {
    const map = keymap(store);
    const out: HTMLElement[] = [
      row(t('settings.touch'), t('settings.touchHint'), choice<TouchMode>([['auto', t('settings.touchAuto')], ['on', t('settings.touchOn')], ['off', t('settings.touchOff')]], store.get<TouchMode>(TOUCH_KEY, 'auto'), (v) => {
        store.set(TOUCH_KEY, v);
        o.onFleetChange?.();
      })),
    ];
    let section = '';
    let grid = el('div', 'keygrid');
    for (const a of ACTIONS) {
      if (a.group !== section) {
        section = a.group;
        grid = el('div', 'keygrid');
        out.push(el('div', 'group', t(`settings.keys.${section}`)), grid);
      }
      const r = el('div', 'keyrow');
      const g = el('span', 'g');
      g.append(glyph(doc, a, 16));
      const key = map.get(a.id) ?? null;
      const cap = el('button', `keycap${key ? '' : ' none'}${listening === a.id ? ' listening' : ''}`, listening === a.id ? t('settings.keyPress') : key ? keyLabel(key) : t('settings.keyNone'));
      cap.type = 'button';
      cap.dataset.id = a.id;
      cap.setAttribute('aria-label', `${t(a.label)}: ${key ? keyLabel(key) : t('settings.keyNone')}. ${a.fixed ? t('settings.keyFixed') : t('settings.keyChange')}`);
      const reset = el('button', 'mini', t('settings.keyReset'));
      reset.type = 'button';
      if (a.fixed) {
        cap.disabled = true;
        reset.hidden = true;
      } else {
        cap.addEventListener('click', () => {
          listening = listening === a.id ? null : a.id;
          status = listening ? t('settings.keyListen', { name: t(a.label) }) : '';
          draw();
          root.querySelector<HTMLButtonElement>(`.keycap[data-id="${a.id}"]`)?.focus();
        });
        reset.hidden = key === a.key;
        reset.title = t('settings.keyResetHint', { key: keyLabel(a.key) });
        reset.addEventListener('click', () => {
          const taken = assignKey(store, a.id, a.key);
          status = taken ? t('settings.keyTaken', { key: keyLabel(a.key), other: t(ACTIONS.find((x) => x.id === taken)!.label) }) : t('settings.keySaved');
          o.onFleetChange?.();
          draw();
        });
      }
      const name = el('span', 'name', t(a.label));
      if (a.touchOnly) name.append(el('span', 'fixed', t('settings.keyGame')));
      r.append(g, name, reset, cap);
      grid.append(r);
    }
    const all = el('span', 'control');
    const b = el('button', 'seg', t('settings.keysDefault'));
    b.type = 'button';
    b.addEventListener('click', () => {
      resetKeys(store);
      listening = null;
      status = t('settings.keysDefaultDone');
      o.onFleetChange?.();
      draw();
    });
    all.append(b);
    out.push(row(t('settings.keysDefault'), t('settings.keysHint'), all));
    const st = el('div', 'status', status);
    st.setAttribute('role', 'status');
    out.push(st);
    return out;
  };
  // While a key cap listens, the next key press is the new key (Esc cancels, Delete or Backspace clears).
  const capture = (e: KeyboardEvent) => {
    if (!listening) return;
    e.preventDefault();
    e.stopPropagation();
    const id = listening;
    const def = ACTIONS.find((a) => a.id === id)!;
    if (e.key === 'Escape') {
      listening = null;
      status = '';
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      assignKey(store, id, null);
      listening = null;
      status = t('settings.keyCleared', { name: t(def.label) });
      o.onFleetChange?.();
    } else if (!e.ctrlKey && !e.altKey && !e.metaKey && usableKey(e.key)) {
      const taken = assignKey(store, id, e.key);
      listening = null;
      status = taken ? t('settings.keyTaken', { key: keyLabel(e.key), other: t(ACTIONS.find((x) => x.id === taken)!.label) }) : t('settings.keySaved');
      o.onFleetChange?.();
    } else {
      status = t('settings.keyBad');
    }
    draw();
    root.querySelector<HTMLButtonElement>(`.keycap[data-id="${id}"]`)?.focus();
  };

  const draw = () => {
    const head = el('div', 'head');
    const titles = el('div', 'titles');
    titles.append(el('h2', '', t('toolbar.settings')), el('span', 'sub', t('settings.sub')));
    const close = el('button', 'close');
    close.type = 'button';
    close.title = t('fleet.close');
    close.setAttribute('aria-label', t('fleet.close'));
    close.append(icon(doc, 'close', 16));
    close.addEventListener('click', () => closeSettings(doc));
    head.append(titles, close);

    const tabs = el('div', 'tabs');
    tabs.setAttribute('role', 'tablist');
    for (const s of SECTIONS) {
      const b = el('button', 'tab', t(`settings.section.${s}`));
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(s === section));
      b.setAttribute('aria-pressed', String(s === section));
      b.addEventListener('click', () => {
        section = s;
        status = '';
        listening = null;
        store.set(TAB_KEY, s);
        draw();
      });
      tabs.append(b);
    }

    const body = el('div', 'body');
    body.setAttribute('role', 'tabpanel');
    if (section === 'menu') {
      const setMenu = (next: Partial<MenuSettings>) => {
        menu = { ...menu, ...next };
        o.menu.onChange(menu);
      };
      body.append(
        row(t('settings.view'), t(o.menu.canSide ? 'settings.viewHint' : 'settings.viewNarrow'), choice([['side', t('planetMenu.side')], ['compact', t('planetMenu.compact')]], o.menu.canSide ? menu.mode : 'compact', (v) => setMenu({ mode: v as MenuSettings['mode'] }), !o.menu.canSide)),
        row(t('settings.totals'), t('settings.totalsHint'), yesNo(menu.showTotals, (v) => setMenu({ showTotals: v }))),
        row(t('settings.totalView'), t('settings.totalViewHint'), choice([['msu', 'MSU 3:2:1'], ['sum', '1:1:1']], menu.totalView ?? 'msu', (v) => setMenu({ totalView: v as MenuSettings['totalView'] }), !menu.showTotals)),
        row(t('settings.fleetPill'), t('settings.fleetPillHint'), yesNo(menu.showFleet === true, (v) => setMenu({ showFleet: v }))),
      );
    } else if (section === 'mail') {
      const set = (key: string, v: unknown) => {
        store.set(key, v);
        o.onMailChange?.();
      };
      const tools = Object.entries(SIM_TOOLS).map(([k, v]) => [k as SimTool, v.name] as [SimTool, string]);
      body.append(
        row(t('settings.sim'), t('settings.simHint'), choice(tools, simTool(store.get<string>(SIM_KEY, 'osims')), (v) => set(SIM_KEY, v))),
        row(t('settings.shared'), t('settings.sharedHint'), yesNo(store.get<boolean>(SPY_SHARED_KEY, true), (v) => set(SPY_SHARED_KEY, v))),
        row(t('settings.fold'), t('settings.foldHint'), yesNo(store.get<boolean>(FOLD_KEY, true), (v) => set(FOLD_KEY, v))),
      );
    } else if (section === 'galaxy') {
      // Debris from this size up is lit in the galaxy and in the targets bar: "1M", "500k", "2,5G".
      const current = store.get<number>(BIG_DEBRIS_KEY, BIG_DEBRIS);
      const box = el('span', 'control');
      const input = el('input', 'field');
      input.type = 'text';
      input.value = formatUnits(current, doc.documentElement.lang || 'it');
      input.setAttribute('aria-label', t('settings.bigDebris'));
      input.addEventListener('keydown', (e) => e.stopPropagation());
      input.addEventListener('change', () => {
        const n = parseAmount(input.value);
        if (n > 0) store.set(BIG_DEBRIS_KEY, n);
        status = n > 0 ? t('settings.bigDebrisSaved', { n: n.toLocaleString(doc.documentElement.lang || 'it') }) : t('settings.bigDebrisBad');
        draw();
      });
      box.append(input);
      const st = el('div', 'status', status);
      st.setAttribute('role', 'status');
      body.append(row(t('settings.bigDebris'), t('settings.bigDebrisHint'), box), st);
    } else if (section === 'fleet') {
      body.append(...fleetRows());
    } else if (section === 'keys') {
      body.append(...keyRows());
    } else {
      if (o.backup) {
        const { onExport, onImport } = o.backup;
        const picker = el('input');
        picker.type = 'file';
        picker.hidden = true;
        // OGLight's export has no extension: any file is accepted, the content decides.
        picker.title = t('settings.backupImportHint');
        picker.addEventListener('change', () => {
          const file = picker.files?.[0];
          picker.value = '';
          if (!file) return;
          file.text().then((text) => {
            const done = onImport(text);
            status = typeof done === 'string' ? done : t('settings.backupRestored', { n: done });
          }).catch(() => { status = t('settings.backupBad'); }).finally(draw);
        });
        const action = (label: string, onClick: () => void) => {
          const box = el('span', 'control');
          const b = el('button', 'seg', label);
          b.type = 'button';
          b.addEventListener('click', onClick);
          box.append(b);
          return box;
        };
        const two = el('span', 'control');
        for (const [label, fn] of [[t('settings.backupExport'), () => { status = t('settings.backupSaved', { n: onExport() }); draw(); }], [t('settings.backupImport'), () => picker.click()]] as const) {
          const b = el('button', 'seg', label);
          b.type = 'button';
          b.addEventListener('click', fn);
          two.append(b);
        }
        body.append(
          row(t('settings.backup'), t('settings.backupHint'), two),
          row(t('settings.oglight'), t('settings.backupImportHint'), action(t('settings.oglightImport'), () => picker.click())),
          picker,
        );
        const s = el('div', 'status', status);
        s.setAttribute('role', 'status');
        body.append(s);
      }
      if (o.notes?.length) body.append(el('div', 'notes', o.notes.join(' · ')));
    }
    panel.replaceChildren(head, tabs, body);
  };
  draw();

  keyHandler = (e: KeyboardEvent) => {
    if (listening) return capture(e);
    if (e.key === 'Escape') closeSettings(doc);
  };
  doc.addEventListener('keydown', keyHandler, true);
}
