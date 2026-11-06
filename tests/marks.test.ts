// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_MARKS, flagPlayer, loadMarks, MARKS_KEY, migrateOld, planetsInRange, rememberRecent, RECENT_MAX, tagPlanet, type Marks } from '../src/engines/marks';
import { flagButton, tagButton } from '../src/modules/marks/picker';
import { closeSide, isSideOpen, nextInSide, openSide, restoreSide, SIDE_ID, toggleSide } from '../src/modules/marks/side';
import { POSITIONS_KEY } from '../src/engines/positions';
import { parsePlayerData } from '../src/data/player-api';
import { parsePlayersXml, statusNames } from '../src/data/universe-players';
import { MemoryStore, Store } from '../src/core/storage';
import { NetworkGuard } from '../src/core/guard';
import { translator } from '../src/core/i18n';

const t = translator('it');
const info = (player = 'Bob', playerId: number | null = 5, statuses: string[] = []) => ({ planet: 'P', player, playerId, statuses, moon: false });
afterEach(() => { document.body.innerHTML = ''; });

describe('marks', () => {
  it('flags players and colours planets, remembering the last choice', () => {
    let m = flagPlayer(EMPTY_MARKS, 5, 'Bob', 'farm', 1);
    m = tagPlanet(m, '1:2:3', 'green', info(), 1);
    expect(m.players['5']).toEqual({ flag: 'farm', name: 'Bob', at: 1 });
    expect([m.lastFlag, m.lastTag]).toEqual(['farm', 'green']);
    m = flagPlayer(m, 5, 'Bob', null, 2);
    expect(m.players['5']).toBeUndefined();
    expect(m.lastFlag).toBe('farm');
  });

  it('keeps the recent players, newest first and capped', () => {
    let m = EMPTY_MARKS;
    for (let i = 1; i <= RECENT_MAX + 3; i++) m = rememberRecent(m, i, `p${i}`);
    m = rememberRecent(m, 10, 'p10');
    expect(m.recent).toHaveLength(RECENT_MAX);
    expect(m.recent[0]).toEqual({ id: 10, name: 'p10' });
  });

  it('lists coloured planets in a coordinate range with filters', () => {
    let m: Marks = EMPTY_MARKS;
    m = tagPlanet(m, '1:300:4', 'red', info(), 1);
    m = tagPlanet(m, '1:120:8', 'blue', info('V', 6, ['vacation']), 1);
    m = tagPlanet(m, '2:5:1', 'red', info(), 1);
    m = tagPlanet(m, '1:120:2', 'red', info(), 1);
    expect(planetsInRange(m, '1:1', '1:499').map(([c]) => c)).toEqual(['1:120:2', '1:120:8', '1:300:4']);
    expect(planetsInRange(m, '2:10', '1:200', { tags: ['red'] }).map(([c]) => c)).toEqual(['1:300:4', '2:5:1']);
    expect(planetsInRange(m, '1:1', '1:499', { hide: ['vacation'] }).map(([c]) => c)).toEqual(['1:120:2', '1:300:4']);
  });

  it('moves the old galaxy targets and rivals once', () => {
    const moved = migrateOld(EMPTY_MARKS, { targets: [{ coords: '1:2:3', planet: 'A', player: 'Bob', at: 9 }], rivals: [{ id: 7, name: 'Riv', at: 8 }] })!;
    expect(moved.planets['1:2:3']).toMatchObject({ tag: 'red', planet: 'A', player: 'Bob' });
    expect(moved.players['7']).toMatchObject({ flag: 'watch', name: 'Riv' });
    expect(migrateOld(EMPTY_MARKS, { targets: [], rivals: [] })).toBeNull();
  });
});

describe('mark pickers', () => {
  it('opens the choice on click, repeats the last one on shift+click and repaints every copy', () => {
    const store = new Store(new MemoryStore(), 'x');
    const a = flagButton({ doc: document, store, t }, 5, 'Bob');
    const b = flagButton({ doc: document, store, t }, 5, 'Bob');
    document.body.append(a, b);
    a.click();
    const pop = document.getElementById('fut-mk-pop')!;
    expect(pop.querySelectorAll('button')).toHaveLength(7);
    pop.querySelectorAll<HTMLButtonElement>('button')[2]!.click(); // farm
    expect(document.getElementById('fut-mk-pop')).toBeNull();
    expect(loadMarks(store.get(MARKS_KEY, null)).players['5']?.flag).toBe('farm');
    expect(b.classList.contains('on')).toBe(true);
    const c = tagButton({ doc: document, store, t }, '1:2:3', info());
    document.body.append(c);
    c.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }));
    expect(loadMarks(store.get(MARKS_KEY, null)).planets['1:2:3']?.tag).toBe('red');
    c.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }));
    expect(loadMarks(store.get(MARKS_KEY, null)).planets['1:2:3']).toBeUndefined();
  });
});

describe('public API readers', () => {
  it('reads planets and moons from playerData.xml', () => {
    const xml = '<?xml version="1.0"?><playerData id="9" name="Kal" timestamp="1"><positions></positions><planets><planet id="11" name="A" coords="1:52:9"><moon id="12" name="M" size="8831"/></planet><planet id="13" name="B" coords="3:149:10"/></planets></playerData>';
    expect(parsePlayerData(xml, 0)?.planets).toEqual([{ id: 11, name: 'A', coords: '1:52:9', moon: { id: 12, name: 'M', size: 8831 } }, { id: 13, name: 'B', coords: '3:149:10', moon: null }]);
  });

  it('reads names and statuses from players.xml', () => {
    const u = parsePlayersXml('<?xml version="1.0"?><players timestamp="1"><player id="5" name="Bob" status="vI"/><player id="6" name="Al"/></players>', 3)!;
    expect(u.players).toEqual({ 5: ['Bob', 'vI'], 6: ['Al', ''] });
    expect(statusNames('vI')).toEqual(['vacation', 'longinactive']);
  });
});

describe('targets side bar', () => {
  it('lists flagged players and coloured planets, statuses from the public API', async () => {
    const store = new Store(new MemoryStore(), 'x');
    let m = flagPlayer(EMPTY_MARKS, 5, 'Bob', 'watch', 1);
    m = tagPlanet(m, '1:300:4', 'red', info('Bob', 5), 1);
    m = tagPlanet(m, '1:301:4', 'red', info('Al', 6), 1);
    store.set(MARKS_KEY, m);
    const fetchImpl = vi.fn(async (_u: string, _i?: RequestInit) => new Response('<?xml version="1.0"?><players timestamp="1"><player id="5" name="Bob" status=""/><player id="6" name="Al" status="v"/></players>'));
    const guard = new NetworkGuard(fetchImpl, 'http://localhost:3000');
    const o = { doc: document, store, guard, t, locale: 'it'};
    toggleSide(o);
    const root = () => document.getElementById(SIDE_ID)!.shadowRoot!;
    expect(root().querySelector('.row .pname')?.textContent).toBe('Bob');
    root().querySelectorAll<HTMLButtonElement>('.seg button')[1]!.click();
    expect(root().querySelectorAll('.tg .row')).toHaveLength(2);
    // Al is on vacation today: hidden by the default filter once players.xml is read.
    await vi.waitFor(() => expect(root().querySelectorAll('.tg .row')).toHaveLength(1));
    expect(fetchImpl.mock.calls[0]![1]?.credentials).toBe('omit');
    expect(root().querySelector<HTMLElement>('[data-coords]')?.dataset.coords).toBe('1:300:4');
    // Left open: it comes back on the next page; the button closes it.
    document.body.innerHTML = '';
    restoreSide(o);
    expect(isSideOpen(document)).toBe(true);
    toggleSide(o);
    expect(isSideOpen(document)).toBe(false);
    restoreSide(o);
    expect(isSideOpen(document)).toBe(false);
  });

  it('player sheet: API planets plus the ones seen in the galaxy, M walks them', async () => {
    const store = new Store(new MemoryStore(), 'y');
    store.set(POSITIONS_KEY, { '2:10:8': { player: 5, name: 'New', moon: false, debris: 2_000_000, act: ['*', null], at: Date.now() } });
    const xml = '<?xml version="1.0"?><playerData id="5" name="Bob" timestamp="1"><positions><position type="0" score="1000">12</position></positions><planets><planet id="1" name="Home" coords="1:300:4"/></planets></playerData>';
    const guard = new NetworkGuard(vi.fn(async () => new Response(xml)), 'http://localhost:3000');
    // The galaxy page shows 1:300: its row is the current one, M goes to the next.
    document.body.innerHTML = '<input id="galaxy_input" value="1"><input id="system_input" value="300"><div id="galaxyContent"></div>';
    const assign = vi.fn();
    Object.defineProperty(window, 'loadContentNew', { value: assign, configurable: true });
    openSide({ doc: document, store, guard, t, locale: 'it'}, { player: 5 });
    const root = () => document.getElementById(SIDE_ID)!.shadowRoot!;
    await vi.waitFor(() => expect(root().querySelectorAll('.pl .row')).toHaveLength(2));
    const rows = [...root().querySelectorAll('.pl .row')];
    expect(rows[0]!.classList.contains('active')).toBe(true);
    expect(rows[1]!.querySelector('.coords.new')).not.toBeNull();
    expect(rows[1]!.querySelector('.act.on')?.textContent).toBe('*');
    expect(rows[1]!.querySelector<HTMLAnchorElement>('a.act')?.getAttribute('href')).toContain('component=fleetdispatch&galaxy=2&system=10&position=8&type=1');
    expect(nextInSide(document)).toBe(true);
    expect(assign).toHaveBeenCalledWith(2, 10);
    closeSide(document, store);
  });
});
