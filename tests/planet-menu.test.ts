import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readCurrentResources, readPlanetList } from '../src/data/planet-list';
import { dataAge, renderPlanetMenu } from '../src/modules/planet-menu';
import { translator } from '../src/core/i18n';
import { PLANET_LIST_HTML, SNAPSHOT } from './fixtures';
import { DOCK_ID, renderDock } from '../src/modules/dock';
import { loadMarks } from '../src/engines/marks';

const t = translator('it');
const draw = (onOpenSettings = vi.fn(), onSync = vi.fn(async () => true)) =>
  renderPlanetMenu({
    doc: document, entries: readPlanetList(document), snapshot: SNAPSHOT, settings: { showTotals: true },
    now: 0, locale: 'it', t, onOpenSettings, onSync,
  });

beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = PLANET_LIST_HTML;
});

describe('readPlanetList', () => {
  it('reads ids, coords, names and the current body', () => {
    const [a, b] = readPlanetList(document);
    expect(a).toMatchObject({ planetId: 1, moonId: 2, coords: '5:185:2', name: 'Yolen', current: 'planet' });
    expect(b).toMatchObject({ planetId: 3, moonId: null, current: null });
  });

  it('reads the resource bar from data-raw', () => {
    document.body.insertAdjacentHTML('beforeend',
      '<span id="resources_metal" data-raw="12"></span><span id="resources_crystal" data-raw="3"></span><span id="resources_deuterium" data-raw="0"></span>');
    expect(readCurrentResources(document)).toEqual({ metal: 12, crystal: 3, deuterium: 0 });
  });
});

describe('renderPlanetMenu', () => {
  it('the totals count the cargo in flight, with a line that says how much', () => {
    const go = (flying?: { metal: number; crystal: number; deuterium: number }) => {
      document.body.innerHTML = PLANET_LIST_HTML;
      renderPlanetMenu({ doc: document, entries: readPlanetList(document), snapshot: SNAPSHOT, flying, settings: { showTotals: true, totalView: 'sum' }, now: 0, locale: 'it', t, onSync: vi.fn(async () => true) });
      return document.querySelector('.fut-totals')!;
    };
    expect(go().querySelector('.fut-flyrow')).toBeNull();
    const box = go({ metal: 3_000_000_000, crystal: 0, deuterium: 0 });
    expect(box.querySelector('.fut-flyrow')?.textContent).toContain('3,0G');
  });

  it('timers count from the last visit of each body, not from the data read by a sync', async () => {
    const { markVisited } = await import('../src/data/visits');
    let visits = markVisited({}, 1, 60_000);
    expect(markVisited(visits, 1, 30_000)).toBe(visits);
    visits = markVisited(visits, 2, 50 * 60_000);
    // The snapshot's resourcesAt (sync time) is ignored; body 3 was never opened: 60, as stale.
    renderPlanetMenu({ doc: document, entries: readPlanetList(document), snapshot: SNAPSHOT, visits, settings: { showTotals: true }, now: 61 * 60_000, locale: 'it', t, onSync: vi.fn(async () => true) });
    expect([...document.querySelectorAll('.fut-age')].map((b) => b.textContent)).toEqual(['60', '11', '60']);
  });

  it('a redraw (e.g. after adding to the plan) leaves one fleet line per planet, inside the name column', () => {
    const snapshot = { ...SNAPSHOT, bodies: SNAPSHOT.bodies.map((b) => ({ ...b, levels: { 203: 10 } })) };
    const once = () => renderPlanetMenu({ doc: document, entries: readPlanetList(document), snapshot, settings: { showTotals: true, showFleet: true }, now: 0, locale: 'it', t, onSync: vi.fn(async () => true) });
    once();
    once();
    const fleets = document.querySelectorAll('#planet-1 .fut-fleet');
    expect(fleets).toHaveLength(1);
    // In the third line of the name column, which it shares with the fleets in flight.
    expect(fleets[0]!.parentElement!.parentElement!.classList.contains('fut-name')).toBe(true);
    // The moon keeps its own fleet in its tile, shown on hover in place of the figures; one after a redraw too.
    const peeks = document.querySelectorAll('#planet-1 a.moonlink .fut-fleet-peek');
    expect(peeks).toHaveLength(1);
    expect(peeks[0]!.textContent).toMatch(/\d/);
    // The planet's own veil (whole planet, on hover): one after a redraw too.
    expect(document.querySelectorAll('#planet-1 a.planetlink > .fut-fleet-peek.fut-peek-planet')).toHaveLength(1);
    // Totals: each line with its symbol (the resources as the board's pieces), the fleet included.
    expect(document.querySelectorAll('.fut-totals .fut-tico svg').length).toBe(5);
  });

  it('adds planet and moon rows on the game links themselves', () => {
    draw();
    const planetLink = document.querySelector('#planet-1 a.planetlink')!;
    const moonLink = document.querySelector('#planet-1 a.moonlink')!;
    expect(planetLink.querySelector('.fut-name .planet-name')?.textContent).toBe('Yolen');
    expect(planetLink.querySelectorAll('.fut-res .fut-cell')).toHaveLength(3);
    expect(moonLink.querySelectorAll('.fut-res .fut-cell')).toHaveLength(3);
    expect(moonLink.getAttribute('href')).toContain('cp=2');
    expect(document.querySelector('#planet-1 .fut-m')?.textContent).toBe('38,3M');
    expect(document.querySelector('#planet-1 .fut-m')?.classList.contains('fut-full')).toBe(true);
  });

  it('marks bodies missing from the snapshot instead of printing NaN', () => {
    draw();
    const cells = document.querySelectorAll('#planet-3 .fut-res span');
    expect(Array.from(cells).every((c) => c.textContent === '—')).toBe(true);
    expect(document.body.textContent).not.toMatch(/NaN|undefined/);
  });

  it('marks a construction with a dot where the game shows its wrench, nothing on idle planets', () => {
    draw();
    expect(document.querySelector('#planet-1 .fut-queue')).toBeNull();
    // Queues never read: the game's own icon is enough for one plain dot.
    expect(Array.from(document.querySelectorAll('#planet-3 .fut-q')).map((d) => d.className)).toEqual(['fut-q fut-q-unknown']);
  });

  it('shows the plan in a column at the outer end of the rows, coloured by where its resources stand', () => {
    renderPlanetMenu({
      doc: document, entries: readPlanetList(document), snapshot: SNAPSHOT, settings: { showTotals: true }, now: 1_000, locale: 'it', t, onSync: vi.fn(async () => true),
      planMarks: {
        3: { state: 'arriving', items: ['Miniera di metallo liv. 46–48'], lack: null, pending: { metal: 5_000_000, crystal: 0, deuterium: 0, arriveAt: 61_000 } },
        2: { state: 'missing', items: ['Falange liv. 7', 'Portale liv. 2'], lack: { metal: 1, crystal: 0, deuterium: 0 }, pending: { metal: 0, crystal: 0, deuterium: 0, arriveAt: 0 } },
      },
    });
    const col3 = document.querySelector('#planet-3 > .fut-plancol')!;
    expect(col3.previousElementSibling?.classList.contains('fut-nomoon')).toBe(true);
    expect(col3.querySelector('.fut-plan')!.className).toBe('fut-plan fut-plan-arriving fut-plan-p');
    // Hover: a card in the game's style with the body, what is planned and the arrival.
    col3.querySelector('.fut-plan')!.dispatchEvent(new MouseEvent('mouseenter'));
    const tip = document.getElementById('fut-plan-tip')!;
    expect(tip.querySelector('.fut-pt-items li')?.textContent).toBe('Miniera di metallo liv. 46–48');
    expect(tip.querySelector('.fut-pt-sent')).not.toBeNull();
    col3.querySelector('.fut-plan')!.dispatchEvent(new MouseEvent('mouseleave'));
    expect(document.getElementById('fut-plan-tip')).toBeNull();
    const moon = document.querySelector('#planet-1 > .fut-plancol .fut-plan')!;
    expect(moon.className).toBe('fut-plan fut-plan-missing fut-plan-m');
    expect(moon.textContent).toBe('2');
    expect(document.querySelectorAll('#planet-1 .fut-plan')).toHaveLength(1);
    // Nothing planned on the planet: an empty square keeps its place; no moon: no square.
    expect(document.querySelectorAll('#planet-1 > .fut-plancol > .fut-plan-empty')).toHaveLength(1);
    expect(document.querySelectorAll('#planet-3 > .fut-plancol > .fut-plan-empty')).toHaveLength(0);
    // Redrawn with nothing planned: still one column per row, with empty squares only.
    const rows = document.querySelectorAll('#planetList > div').length;
    draw();
    expect(document.querySelectorAll('.fut-plancol')).toHaveLength(rows);
    expect(document.querySelectorAll('.fut-plancol .fut-plan')).toHaveLength(0);
    expect(document.querySelectorAll('.fut-plancol .fut-plan-empty').length).toBeGreaterThan(0);
  });

  it('paints storage fill behind planet numbers only, never on moons', () => {
    draw();
    const cell = document.querySelector<HTMLElement>('#planet-1 a.planetlink .fut-m')!;
    expect(cell.style.getPropertyValue('--fut-fill')).toMatch(/%$/);
    expect(document.querySelectorAll('#planet-1 a.moonlink .fut-has-fill')).toHaveLength(0);
  });

  it('keeps columns aligned on planets without a moon', () => {
    draw();
    expect(document.querySelector('#planet-3 .fut-nomoon')).not.toBeNull();
    expect(document.querySelector('#planet-1 .fut-nomoon')).toBeNull();
  });

  it('falls back to the 1x skin when the image fails, then to a plain sphere', () => {
    draw();
    const img = document.querySelector<HTMLImageElement>('#planet-1 img.planetPic')!;
    img.dataset.defaultSrc = 'fallback.png';
    img.dispatchEvent(new Event('error'));
    expect(img.getAttribute('src')).toBe('fallback.png');
    img.dispatchEvent(new Event('error'));
    expect(img.classList.contains('fut-noskin')).toBe(true);
  });

  it('can be redrawn without duplicating anything', () => {
    draw();
    draw();
    expect(document.querySelectorAll('.fut-toolbar')).toHaveLength(1);
    expect(document.querySelectorAll('.fut-nomoon')).toHaveLength(1);
    expect(document.querySelectorAll('#planet-1 .fut-res')).toHaveLength(2); // planet + moon
    expect(document.querySelectorAll('.fut-name')).toHaveLength(2);
  });

  it('toolbar lines show data and open their window', () => {
    const onOpenPlanner = vi.fn();
    const onOpenDashboard = vi.fn();
    renderPlanetMenu({
      doc: document, entries: readPlanetList(document), snapshot: SNAPSHOT, settings: { showTotals: true },
      now: 0, locale: 'it', t, onSync: vi.fn(async () => true),
      onOpenDashboard, onOpenPlanner, planCount: 50, planGap: 1.2e9,
    });
    const cells = Array.from(document.querySelectorAll<HTMLButtonElement>('.fut-toolbar .fut-cell'));
    expect(cells.map((c) => c.querySelector('.fut-cell-k')!.textContent)).toEqual(['Produzione', 'Piano · 50']);
    expect(cells[0]!.querySelector('.fut-cell-v')!.textContent).toMatch(/^\+.* MSU\/g$/);
    expect(cells[1]!.querySelector('.fut-cell-v')!.textContent).toBe('−1,2G');
    expect(cells[1]!.title).toContain('mancano 1,2G');
    cells[0]!.click();
    cells[1]!.click();
    expect(onOpenDashboard).toHaveBeenCalledTimes(1);
    expect(onOpenPlanner).toHaveBeenCalledTimes(1);
    // Totals: one row per resource plus MSU, no heading row; each figure says what it is.
    expect(document.querySelectorAll('.fut-totals .fut-trow')).toHaveLength(4);
    const first = document.querySelectorAll<HTMLElement>('.fut-totals .fut-trow')[0]!.querySelectorAll<HTMLElement>('.fut-tnum');
    expect([first[0]!.title, first[1]!.title]).toEqual(['In cassa', 'Al giorno']);
  });

  it('the dock under the game menu shows journal and targets and opens them', () => {
    const links = document.createElement('div');
    links.id = 'links';
    document.body.append(links);
    const onOpenJournal = vi.fn();
    const onOpenTargets = vi.fn();
    const marks = loadMarks({
      players: { 1: { flag: 'farm', name: 'A', at: 0 }, 2: { flag: 'farm', name: 'B', at: 0 }, 3: { flag: 'danger', name: 'C', at: 0 } },
    });
    const today = { count: 25, net: 4e7, res: { metal: 2e7, crystal: 8e6, deuterium: 2e6 } };
    const yesterday = { count: 0, net: 0, res: { metal: 0, crystal: 0, deuterium: 0 } };
    const o = { doc: document, t, locale: 'it', journal: { today, yesterday }, marks, onOpenJournal, onOpenTargets };
    renderDock(o);
    renderDock(o);
    expect(document.querySelectorAll(`#${DOCK_ID}`)).toHaveLength(1);
    const dock = links.querySelector(`#${DOCK_ID}`)!;
    // Today's gain with M/C/D under it, yesterday to compare; the counts in the heads.
    expect(dock.querySelector('.jday.today .v')!.textContent).toBe('+40,0M');
    expect([...dock.querySelectorAll('.res span')].map((s) => s.textContent)).toEqual(['M20,0M', 'C8,0M', 'D2,0M']);
    expect(dock.querySelector('.jday.yesterday .v')!.textContent).toBe('—');
    expect([...dock.querySelectorAll('.head .n')].map((n) => n.textContent)).toEqual(['25', '3']);
    expect([...dock.querySelectorAll('.flag')].map((f) => f.getAttribute('aria-label'))).toEqual(['Frigo: 2', 'Pericolo: 1']);
    dock.querySelector<HTMLButtonElement>('.jday')!.click();
    expect(onOpenJournal).toHaveBeenCalledOnce();
    dock.querySelector<HTMLButtonElement>('.flag')!.click();
    expect(onOpenTargets).toHaveBeenLastCalledWith({ flagTab: 'farm' });
    dock.querySelectorAll<HTMLButtonElement>('.head')[1]!.click();
    expect(onOpenTargets).toHaveBeenLastCalledWith();
    links.remove();
  });

  it('sync runs only from the button click', () => {
    const onSync = vi.fn(async () => true);
    draw(vi.fn(), onSync);
    expect(onSync).not.toHaveBeenCalled();
    document.querySelector<HTMLButtonElement>('.fut-toolbar .fut-tool-sync')!.click();
    expect(onSync).toHaveBeenCalledTimes(1);
  });

  it('the gear opens the settings window with the colony count', () => {
    const onOpenSettings = vi.fn();
    draw(onOpenSettings);
    document.querySelector<HTMLButtonElement>('.fut-tool-settings')!.click();
    expect(onOpenSettings).toHaveBeenCalledWith({ colonies: expect.any(String) });
  });
});

describe('width and banner', () => {
  it('widens the column and shifts the banner; without room it leaves the game list as it is', () => {
    document.body.innerHTML = `<div id="planetbarcomponent">${PLANET_LIST_HTML}</div><div id="bannerskyscrapercomponent"></div>`;
    draw();
    expect(document.getElementById('planetbarcomponent')?.classList.contains('fut-wide')).toBe(true);
    expect(document.body.classList.contains('fut-banner-shift')).toBe(true);
    // A banner on screen that the shift would push out of view (AGENTS.md §1.7).
    const banner = document.getElementById('bannerskyscrapercomponent')!;
    banner.getBoundingClientRect = () => ({ left: 1000, right: 1160, width: 160 }) as DOMRect;
    Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, value: 1080 });
    draw();
    expect(document.getElementById('planetbarcomponent')?.classList.contains('fut-wide')).toBe(false);
    expect(document.body.classList.contains('fut-banner-shift')).toBe(false);
    expect(document.getElementById('planetList')?.classList.contains('fut-menu')).toBe(false);
    expect(document.querySelectorAll('.fut-row, .fut-res, .fut-plancol, .fut-nomoon, .fut-fleet-peek')).toHaveLength(0);
    expect(document.querySelectorAll('.fut-toolbar')).toHaveLength(1);
    Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, value: 0 });
  });

  it('widens unless the shift would push an on-screen banner out of view', async () => {
    const { canWiden } = await import('../src/modules/planet-menu');
    document.body.className = '';
    document.body.innerHTML = '<div id="bannerskyscrapercomponent"></div>';
    const banner = document.getElementById('bannerskyscrapercomponent')!;
    const at = (left: number) => (banner.getBoundingClientRect = () => ({ left, right: left + 160, width: 160 }) as DOMRect);
    Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, value: 980 });
    at(600); // fits even after the shift
    expect(canWiden(document)).toBe(true);
    at(750); // on screen now, cut off once shifted
    expect(canWiden(document)).toBe(false);
    at(991); // phone: already past the 980px page edge without Future
    expect(canWiden(document)).toBe(true);
    // A redraw measures where the game put it, not where Future's shift moved it.
    document.body.classList.add('fut-banner-shift');
    at(600 + 118);
    expect(canWiden(document)).toBe(true);
    delete (document.documentElement as { clientWidth?: number }).clientWidth;
    document.body.className = '';
  });
});

describe('data age badge', () => {
  it('counts minutes up to 60, with OGLight colour steps', () => {
    expect(dataAge(0, 5 * 60_000)).toEqual({ text: '5', cls: 'fut-age-fresh' });
    expect(dataAge(0, 20 * 60_000)).toEqual({ text: '20', cls: 'fut-age-warm' });
    expect(dataAge(0, 45 * 60_000)).toEqual({ text: '45', cls: 'fut-age-old' });
    expect(dataAge(0, 3 * 3_600_000)).toEqual({ text: '60', cls: 'fut-age-old' });
    expect(dataAge(0, 2 * 86_400_000)).toEqual({ text: '60', cls: 'fut-age-old' });
  });
});

describe('when the game reloads the planet bar', () => {
  it('draws the menu again, once', async () => {
    const { watchPlanetBar } = await import('../src/modules/planet-menu');
    document.body.innerHTML = `<div id="planetbarcomponent">${PLANET_LIST_HTML}</div>`;
    const redraw = vi.fn(() => draw());
    redraw();
    watchPlanetBar(document, redraw);
    expect(document.querySelector('.fut-toolbar')).not.toBeNull();
    // What reloadComponent('planetbar') does: the bar's content replaced with the game's own.
    document.getElementById('planetbarcomponent')!.innerHTML = PLANET_LIST_HTML;
    await new Promise((r) => setTimeout(r, 10));
    expect(redraw).toHaveBeenCalledTimes(2);
    expect(document.querySelectorAll('.fut-toolbar')).toHaveLength(1);
  });
});

describe('the game card on planets, switched off', () => {
  it('stays off on a fresh page even when the game builds its card only after the menu (first hover)', () => {
    document.body.innerHTML = PLANET_LIST_HTML;
    renderPlanetMenu({ doc: document, entries: readPlanetList(document), snapshot: SNAPSHOT, settings: { showTotals: true, gameTips: false }, now: 0, locale: 'it', t, onSync: vi.fn(async () => true) });
    const link = document.querySelector<HTMLElement>('#planet-1 a.planetlink')!;
    const tip = { enable: vi.fn(), disable: vi.fn(), hide: vi.fn() };
    (link as HTMLElement & { _tippy?: typeof tip })._tippy = tip;
    link.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(tip.disable).toHaveBeenCalled();
    expect(tip.enable).not.toHaveBeenCalled();
  });
});

describe('fleet on hover', () => {
  it('no veil on a planet without ships, even when its moon has some (the moon shows its own)', () => {
    document.body.innerHTML = PLANET_LIST_HTML;
    const snapshot = { ...SNAPSHOT, bodies: SNAPSHOT.bodies.map((b) => ({ ...b, levels: (b.type === 'moon' ? { 202: 100 } : {}) as Record<string, number> })) };
    renderPlanetMenu({ doc: document, entries: readPlanetList(document), snapshot, settings: { showTotals: true, showFleet: true }, now: 0, locale: 'it', t, onSync: vi.fn(async () => true) });
    expect(document.querySelector('#planet-1 a.planetlink .fut-fleet-peek')).toBeNull();
    expect(document.querySelectorAll('#planet-1 a.moonlink .fut-fleet-peek')).toHaveLength(1);
  });
});

describe('the moon fleet, away from the pointer', () => {
  it('lives in the moon tile with the moon mark, drawn over the planet; nothing of the moon inside the planet link', () => {
    document.body.innerHTML = PLANET_LIST_HTML;
    const snapshot = { ...SNAPSHOT, bodies: SNAPSHOT.bodies.map((b) => ({ ...b, levels: (b.type === 'moon' ? { 202: 100 } : { 203: 10 }) as Record<string, number> })) };
    renderPlanetMenu({ doc: document, entries: readPlanetList(document), snapshot, settings: { showTotals: true, showFleet: true }, now: 0, locale: 'it', t, onSync: vi.fn(async () => true) });
    const moon = document.querySelector<HTMLElement>('#planet-1 a.moonlink')!;
    const peek = moon.querySelector<HTMLElement>('.fut-fleet-peek.fut-peek-moon')!;
    expect(peek.querySelector('.fut-peek-moonmark svg')).not.toBeNull();
    expect(document.querySelector('#planet-1 a.planetlink .fut-peek-moon')).toBeNull();
    expect(document.querySelectorAll('#planet-1 a.planetlink > .fut-peek-planet')).toHaveLength(1);
    // Sized to the planet when the moon is hovered or focused.
    Object.defineProperty(document.querySelector('#planet-1 a.planetlink')!, 'offsetWidth', { value: 148 });
    moon.dispatchEvent(new MouseEvent('mouseenter'));
    expect(peek.style.getPropertyValue('--fut-peek-w')).toBe('148px');
  });
});

describe('fleets in flight on the planet menu', () => {
  it('lights up a planet or moon an enemy lands on, and lists own fleets per row with their way and count', () => {
    const entries = readPlanetList(document);
    const e = entries.find((x) => x.moonId)!;
    const events = new Map([
      [`${e.coords}|m`, { attack: 5_000, spy: null, own: [] }],
      [`${e.coords}|p`, { attack: null, spy: 4_000, own: [
        { mission: 15, way: 'out' as const, count: 2, first: 3_000 },
        { mission: 3, way: 'back' as const, count: 1, first: 6_000 },
      ] }],
    ]);
    renderPlanetMenu({ doc: document, entries, snapshot: SNAPSHOT, settings: { showTotals: true }, now: 0, locale: 'it', t, onSync: vi.fn(async () => true), events });
    expect(e.moonLink!.classList.contains('fut-attack')).toBe(true);
    expect(e.planetLink!.classList.contains('fut-spy')).toBe(true);
    expect(e.planetLink!.querySelector('.fut-threat')!.getAttribute('aria-label')).toMatch(/^Spionaggio in arrivo alle /);
    const chips = [...e.element.querySelectorAll('.fut-flights .fut-fl')];
    expect(chips.map((c) => c.textContent)).toEqual(['→2', '←']);
    // Expedition in its colour (blue), the transport in Accentra's green.
    expect((chips[0] as HTMLElement).style.getPropertyValue('--tone').toUpperCase()).toBe('#4AA3FF');
    // A tap on the fleets line shows the details (a tooltip never shows on a touch screen) instead of opening the planet.
    const tap = new MouseEvent('click', { bubbles: true, cancelable: true });
    e.element.querySelector('.fut-flights')!.dispatchEvent(tap);
    expect(tap.defaultPrevented).toBe(true);
    expect([...document.querySelectorAll('#fut-plan-tip li')].length).toBe(2);
    // Gone once nothing is landing: the next drawing clears the red.
    renderPlanetMenu({ doc: document, entries, snapshot: SNAPSHOT, settings: { showTotals: true }, now: 0, locale: 'it', t, onSync: vi.fn(async () => true), events: new Map() });
    expect(e.moonLink!.classList.contains('fut-attack')).toBe(false);
    expect(e.planetLink!.querySelector('.fut-threat')).toBeNull();
    expect(e.element.querySelector('.fut-flights')).toBeNull();
  });
});
