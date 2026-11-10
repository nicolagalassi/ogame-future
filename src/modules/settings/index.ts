/**
 * Settings window: every Future preference in one place, in sections (planet menu, inbox and
 * spy table, data). The gear in the toolbar opens it. Each choice applies at once and is saved
 * locally; nothing here reaches the server.
 */
import { icon } from '../../core/icons';
import type { Store } from '../../core/storage';
import { WINDOW_SHEET } from '../../core/sheet';
import { SIM_KEY, SIM_TOOLS, simTool, type SimTool } from '../../engines/sim-links';
import { FOLD_KEY } from '../messages';
import { SPY_SHARED_KEY } from '../messages/spy-table';
import type { MenuSettings } from '../planet-menu';

export const SETTINGS_ID = 'fut-settings-window';
const TAB_KEY = 'settings.tab';
type Section = 'menu' | 'mail' | 'data';
const SECTIONS: Section[] = ['menu', 'mail', 'data'];

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
}

const CSS = `
:host { --panel-w: 620px; }
.body { display: flex; flex-direction: column; gap: 6px; }
.row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 4px 16px; padding: 10px 12px;
  border: 1px solid var(--line); border-radius: 7px; background: var(--raised); }
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

  let section = store.get<Section>(TAB_KEY, 'menu');
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
    return r;
  };
  const yesNo = (v: boolean, onPick: (v: boolean) => void) => choice([[true, t('settings.on')], [false, t('settings.off')]], v, onPick);

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
        row(t('settings.markIdle'), t('settings.markIdleHint'), yesNo(menu.markIdle, (v) => setMenu({ markIdle: v }))),
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
    if (e.key === 'Escape') closeSettings(doc);
  };
  doc.addEventListener('keydown', keyHandler, true);
}
