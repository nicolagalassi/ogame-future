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
  openSettings({ doc: document, store, t, menu: { settings: { mode: 'side', showTotals: true }, canSide: true, onChange }, onMailChange, notes: ['15/15 pianeti'], ...over });
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
    w.seg('Compatto', 'Vista del menu').click();
    expect(w.onChange).toHaveBeenCalledWith({ mode: 'compact', showTotals: true });
    // The window redraws with the new choice pressed.
    expect(w.seg('Compatto', 'Vista del menu').getAttribute('aria-pressed')).toBe('true');
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

  it('closes with Escape and cannot switch to side by side on a narrow screen', () => {
    const w = open(new Store(new MemoryStore(), 'x'), { menu: { settings: { mode: 'side', showTotals: true }, canSide: false, onChange: vi.fn() } });
    expect(w.seg('Affiancato', 'Vista del menu').disabled).toBe(true);
    expect(w.seg('Compatto', 'Vista del menu').getAttribute('aria-pressed')).toBe('true');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.getElementById(SETTINGS_ID)).toBeNull();
  });
});

describe('fleet and keys sections', () => {
  it('saves a fleet choice and changes a key by pressing it', () => {
    const store = new Store(new MemoryStore(), 'fk');
    const onFleetChange = vi.fn();
    const w = open(store, { onFleetChange, bodies: [{ id: 5, label: 'Casa [1:2:3]' }], section: 'fleet' });
    const fav = Array.from(w.root.querySelectorAll('.row')).find((r) => r.querySelector('.name')!.textContent === '1 · Trasporto verso')!.querySelector('select')!;
    fav.value = '5';
    fav.dispatchEvent(new Event('change'));
    expect(store.get<{ favTransport: number }>('fleet.settings', { favTransport: 0 }).favTransport).toBe(5);
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
