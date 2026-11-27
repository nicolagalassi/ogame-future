// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { MemoryStore, Store } from '../src/core/storage';
import { translator } from '../src/core/i18n';
import { closeSettings, openSettings, SETTINGS_ID } from '../src/modules/settings';
import { SIM_KEY } from '../src/engines/sim-links';
import { SPY_SHARED_KEY } from '../src/modules/messages/spy-table';

const t = translator('it');
const open = (store: Store, over: Partial<Parameters<typeof openSettings>[0]> = {}) => {
  const onChange = vi.fn();
  const onMailChange = vi.fn();
  openSettings({ doc: document, store, t, menu: { settings: { showTotals: true }, onChange }, onMailChange, notes: ['15/15 pianeti'], ...over });
  const root = document.getElementById(SETTINGS_ID)!.shadowRoot!;
  const tab = (name: string) => Array.from(root.querySelectorAll<HTMLButtonElement>('.tab')).find((b) => b.textContent === name)!;
  const seg = (label: string, row: string) => {
    const r = Array.from(root.querySelectorAll('.row')).find((x) => x.querySelector('.name')!.textContent === row)!;
    return Array.from(r.querySelectorAll<HTMLButtonElement>('.seg')).find((b) => b.textContent === label)!;
  };
  return { root, tab, seg, onChange, onMailChange };
};

describe('settings window', () => {
  it('changes the planet menu through the callback', () => {
    const w = open(new Store(new MemoryStore(), 'x'));
    w.seg('1:1:1', 'Totale nel riepilogo').click();
    expect(w.onChange).toHaveBeenCalledWith({ showTotals: true, totalView: 'sum' });
    // The window redraws with the new choice pressed.
    expect(w.seg('1:1:1', 'Totale nel riepilogo').getAttribute('aria-pressed')).toBe('true');
    closeSettings(document);
    expect(document.getElementById(SETTINGS_ID)).toBeNull();
  });

  it('saves the simulator and the shared reports choice, then redraws the inbox', () => {
    const store = new Store(new MemoryStore(), 'x');
    const w = open(store);
    w.tab('Posta e spiate').click();
    expect(w.seg('Osims', 'Simulatore').getAttribute('aria-pressed')).toBe('true');
    w.seg('OGame Simulator', 'Simulatore').click();
    expect(store.get(SIM_KEY, '')).toBe('ogametools');
    w.root.querySelector<HTMLButtonElement>('.switch[aria-label="Spiate condivise dall’alleanza"]')!.click();
    expect(store.get(SPY_SHARED_KEY, true)).toBe(false);
    expect(w.onMailChange).toHaveBeenCalledTimes(2);
    // The section is remembered for next time.
    closeSettings(document);
    const again = open(store);
    expect(again.root.querySelector('.tab[aria-selected="true"]')?.textContent).toBe('Posta e spiate');
    closeSettings(document);
  });

  it('closes with Escape, with no menu view choice left', () => {
    const w = open(new Store(new MemoryStore(), 'x'));
    const names = Array.from(w.root.querySelectorAll('.row .name')).map((n) => n.textContent);
    expect(names).not.toContain('Vista del menu');
    // The rest of the menu section is still there.
    expect(names).toContain('Totali risorse');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.getElementById(SETTINGS_ID)).toBeNull();
  });
});

describe('fleet and keys sections', () => {
  it('saves a fleet choice and changes a key by pressing it', () => {
    const store = new Store(new MemoryStore(), 'fk');
    const onFleetChange = vi.fn();
    const w = open(store, { onFleetChange, bodies: [{ id: 5, name: 'Casa', coords: '1:2:3', moon: false }, { id: 6, name: 'Casa', coords: '1:2:3', moon: true }], section: 'fleet' });
    // The destination is the planet / moon list used everywhere in Future: planet left, its moon beside it.
    const fav = Array.from(w.root.querySelectorAll('.row')).find((r) => r.querySelector('.name')!.textContent === '1 · Trasporto verso')!;
    fav.querySelector<HTMLButtonElement>('.bpick-btn')!.click();
    fav.querySelector<HTMLButtonElement>('.bmenu button.moon')!.click();
    expect(store.get<{ favTransport: number }>('fleet.settings', { favTransport: 0 }).favTransport).toBe(6);
    expect(fav.querySelector('.bpick-btn')!.getAttribute('aria-label')).toContain('Casa');
    expect(onFleetChange).toHaveBeenCalled();
    w.tab('Tasti').click();
    const cap = () => w.root.querySelector<HTMLButtonElement>('.keycap[data-id="fleet.transport"]')!;
    expect(cap().textContent).toBe('T');
    cap().click();
    expect(cap().textContent).toBe('Premi un tasto…');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'x' }));
    // X belonged to Expedition: it moves to Transport and Expedition is left without a key.
    expect(cap().textContent).toBe('X');
    expect(w.root.querySelector('.keycap[data-id="fleet.expedition"]')!.textContent).toBe('nessuno');
    expect(w.root.querySelector('.status')!.textContent).toContain('Spedizione');
    // Galaxy arrows belong to the game.
    expect(w.root.querySelector<HTMLButtonElement>('.keycap[data-id="galaxy.up"]')!.disabled).toBe(true);
    closeSettings(document);
  });
});

describe('expedition share calculator', () => {
  it('one line per cargo ship under the row, not in the switch column', () => {
    const store = new Store(new MemoryStore(), 'split');
    store.set('fleet.expeditionMax', { max: 1, at: 0, cargo: { 202: 4643, 203: 4445, 219: 0 }, free: 6 });
    const w = open(store, { section: 'fleet' });
    const row = [...w.root.querySelectorAll<HTMLElement>('.row')].find((r) => r.querySelector('.name')?.textContent === 'Dividi i cargo tra gli slot')!;
    const lines = [...row.querySelectorAll(':scope > .calc.wide > div')].map((d) => d.textContent);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('4643 ÷ 6 slot = 773');
    expect(row.querySelector('.control .calc')).toBeNull();
  });

  it('brings another universe over: where from, then which one, then a message', () => {
    const src = { ns: 'future:s150-it.ogame.gameforge.com:100200', universe: 's150-it', player: '100200', journal: 412, days: 30 };
    const list = vi.fn((text?: string) => (text === undefined ? [src] : null));
    const apply = vi.fn(() => 'Portati');
    const w = open(new Store(new MemoryStore(), 'x'), { backup: { onExport: () => 0, onImport: () => 0 }, carry: { list, apply } });
    w.tab('Dati').click();
    w.seg('Da questo browser', 'Da un altro universo').click();
    const row = Array.from(w.root.querySelectorAll('.row')).find((r) => r.querySelector('.name')!.textContent === 's150-it · giocatore 100200')!;
    expect(row.querySelector('.desc')!.textContent).toMatch(/^412 spedizioni e raid, 30 giorni di storico/);
    w.seg('Porta qui', 's150-it · giocatore 100200').click();
    expect(apply).toHaveBeenCalledWith(src.ns);
    expect(w.root.querySelector('.status')!.textContent).toBe('Portati');
    expect(w.root.textContent).not.toContain('s150-it · giocatore');
  });

  it('PTRE: the key is checked, kept masked, removed on request', () => {
    const store = new Store(new MemoryStore(), 'x');
    const w = open(store);
    w.tab('PTRE').click();
    const input = () => w.root.querySelector<HTMLInputElement>('input[type="password"]')!;
    input().value = 'not a key';
    w.seg('Salva', 'Team key').click();
    expect(w.root.querySelector('.status')!.textContent).toMatch(/^Non è una team key/);
    expect(store.get('ptre.teamKey', null)).toBeNull();
    input().value = 'tm-aaaa-bbbb-cccc-dddd';
    w.seg('Salva', 'Team key').click();
    expect(store.get('ptre.teamKey', null)).toBe('TM-AAAA-BBBB-CCCC-DDDD');
    // Only the last group is shown, never the whole key.
    expect(w.root.querySelector('.fut-ptre-key')!.textContent).toBe('TM-••••-••••-••••-DDDD');
    expect(w.root.textContent).not.toContain('AAAA');
    w.seg('Rimuovi', 'Team key').click();
    expect(store.get('ptre.teamKey', null)).toBeNull();
  });

  it('resets only on the second press, and «Annulla» leaves everything as it was', () => {
    const reset = vi.fn((kind: string) => `fatto ${kind}`);
    const w = open(new Store(new MemoryStore(), 'x'), { backup: { onExport: () => 0, onImport: () => 0 }, reset });
    w.tab('Dati').click();
    w.seg('Azzera', 'Azzera le impostazioni').click();
    expect(reset).not.toHaveBeenCalled();
    w.seg('Annulla', 'Azzera le impostazioni').click();
    w.seg('Azzera', 'Azzera le statistiche').click();
    w.seg('Sì, azzera', 'Azzera le statistiche').click();
    expect(reset).toHaveBeenCalledTimes(1);
    expect(reset).toHaveBeenCalledWith('stats');
    expect(w.root.querySelector('.status')!.textContent).toBe('fatto stats');
  });
});

