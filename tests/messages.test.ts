// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { readMessage } from '../src/data/messages';
import { byDay, entriesIn, JOURNAL_KEY, periodRange, periodStats, record, recordCombat, trim, type Journal } from '../src/engines/expeditions';
import { processMessages } from '../src/modules/messages';
import { openJournal, closeJournal } from '../src/modules/messages/journal-view';
import { MemoryStore, Store } from '../src/core/storage';
import { translator } from '../src/core/i18n';

const t = translator('it');
const OWN = 100262;

/** A message as the game renders it (attributes copied from real inbox pages). */
function msg(id: string, attrs: Record<string, string>, content = ''): HTMLElement {
  const el = document.createElement('div');
  el.className = 'msg';
  el.setAttribute('data-msg-id', id);
  const raw = document.createElement('div');
  raw.className = 'rawMessageData';
  for (const [k, v] of Object.entries(attrs)) raw.setAttribute(`data-raw-${k}`, v);
  const body = document.createElement('div');
  body.className = 'msgContent';
  body.textContent = content;
  const foot = document.createElement('message-footer');
  foot.className = 'msg_actions';
  el.append(raw, body, foot);
  return el;
}

const shipwrecks = {
  messagetype: '41',
  timestamp: '1793891482',
  coords: '6:109:16',
  depletion: '1',
  size: '2',
  expeditionresult: 'shipwrecks',
  technologiesgained: JSON.stringify({ 205: { name: 'Caccia Pesante', amount: 2720 }, 210: { name: 'Sonda spia', amount: 11 } }),
};
const deut = { messagetype: '41', timestamp: '1793891471', coords: '4:264:16', depletion: '1', size: '2', expeditionresult: 'ressources', resourcesgained: '{"deuterium":12832808}' };
const dm = { messagetype: '41', timestamp: '1793891479', coords: '5:185:16', size: '0', expeditionresult: 'darkmatter', resourcesgained: '{"darkMatter":310}' };
const nothing = { messagetype: '41', timestamp: '1793891479', coords: '5:356:16', size: '0', expeditionresult: 'nothing' };

describe('inbox reports', () => {
  it('reads expeditions', () => {
    const a = readMessage(msg('1', shipwrecks), OWN);
    expect(a).toMatchObject({ kind: 'expedition', result: 'ship', size: 2, depletion: 1, ships: { 205: 2720, 210: 11 }, coords: '6:109:16', at: 1793891482000 });
    expect(readMessage(msg('2', deut), OWN)).toMatchObject({ result: 'resource', res: { deuterium: 12832808, metal: 0 } });
    expect(readMessage(msg('3', dm), OWN)).toMatchObject({ result: 'darkmatter', size: 0, res: { darkMatter: 310 } });
    // No size for "nothing".
    expect(readMessage(msg('4', nothing), OWN)).toMatchObject({ result: 'nothing', size: -1 });
    expect(readMessage(msg('5', { messagetype: '41', expeditionresult: 'navigation', navigation: '{"returnTimeAbsoluteIncreaseHours":0,"returnTimeMultiplier":0.5}' }), OWN)).toMatchObject({ result: 'early' });
  });

  it('reads transports, fleet returns and recycling', () => {
    const transport = readMessage(
      msg('10', {
        messagetype: '33',
        sourceplanetcoordinates: '6:109:7',
        sourceplanettype: '3',
        sourceplanetname: 'BEL BUG',
        targetplanetcoordinates: '5:185:2',
        targetplanettype: '1',
        targetplanetname: 'Yolen',
        cargo: '{"metal":282132759,"crystal":83448857,"deuterium":29906023,"food":0}',
      }),
      OWN,
    );
    expect(transport).toMatchObject({ kind: 'transport', res: { metal: 282132759, crystal: 83448857, deuterium: 29906023 }, from: { name: 'BEL BUG', moon: true }, to: { name: 'Yolen', coords: '5:185:2', moon: false } });
    const back = readMessage(
      msg('11', { messagetype: '34', targetplanetcoordinates: '4:264:8', targetplanettype: '3', targetplanetname: 'G4 264', cargo: '{"metal":0,"crystal":0,"deuterium":12832808}' }, 'La tua flotta è ritornata dal pianeta [4:264:16] al pianeta G4 264 [4:264:8].'),
      OWN,
    );
    expect(back).toMatchObject({ kind: 'return', from: { coords: '4:264:16' }, res: { deuterium: 12832808 } });
    const deploy = readMessage(msg('12', { messagetype: '34', sourceplanetcoordinates: '3:235:8', targetplanetcoordinates: '6:109:7' }), OWN);
    expect(deploy?.kind).toBe('deploy');
    const rec = readMessage(msg('13', { messagetype: '32', coords: '6:109:7', debrisresources: '{"metal":0,"crystal":12000,"deuterium":0}', recycledresources: '{"metal":0,"crystal":3000,"deuterium":0}' }), OWN);
    expect(rec).toMatchObject({ kind: 'recycle', res: { crystal: 3000 }, left: { crystal: 9000 } });
  });

  it('reads spy reports and counter-espionage', () => {
    const spy = readMessage(
      msg('20', { coordinates: '1:2:3', playername: 'Bob', targetplayerid: '5', resources: '3000000', loot: '50', metal: '1000000', crystal: '1000000', deuterium: '1000000', fleetvalue: '0', defensevalue: '200000', active: '1', activity: '30' }),
      OWN,
    );
    expect(spy).toMatchObject({ kind: 'spy', counter: false, loot: 0.5, fleetValue: 0, defValue: 200000, activity: 30 });
    const counter = readMessage(msg('21', { coordinates: '6:109:7', targetplayerid: String(OWN), resources: '-', loot: '-', sourceplayername: 'BOZZY', sourceplanetcoordinates: '6:109:8' }), OWN);
    expect(counter).toMatchObject({ kind: 'spy', counter: true, sourceName: 'BOZZY' });
    // Deep space (position 16): nothing to show.
    expect(readMessage(msg('22', { coordinates: '5:185:16', targetplayerid: '99999', resources: '0', loot: '75' }), OWN)).toBeNull();
  });

  it('reads combats', () => {
    const fleets = [{ side: 'attacker', fleetId: 7, player: { id: OWN } }];
    const rounds = [{ fleets: [{ fleetId: 7, technologies: [{ technologyId: 204, destroyedTotal: 10 }] }] }];
    const result = { winner: 'attacker', loot: { resources: [{ resource: 'metal', amount: 500 }] }, debris: { resources: [{ resource: 'crystal', total: 12000, remaining: 9000 }] } };
    const c = readMessage(msg('30', { messagetype: '25', coords: '2:418:16', fleets: JSON.stringify(fleets), combatrounds: JSON.stringify(rounds), result: JSON.stringify(result), defenderspaceobject: '{}' }), OWN);
    expect(c).toMatchObject({ kind: 'combat', winner: 'won', attacker: true, loot: { metal: 500 }, lost: { 204: 10 }, debris: { crystal: 9000 } });
    const shot = readMessage(msg('31', { messagetype: '48', coords: '2:284:8', shipslost: '{"210":30}' }), OWN);
    expect(shot).toMatchObject({ kind: 'combat', winner: 'lost', lost: { 210: 30 } });
  });
});

describe('expedition journal', () => {
  const day = (d: number, h = 12) => new Date(2026, 10, d, h).getTime();
  const entry = (id: string, at: number, extra: Record<string, unknown> = {}) => ({
    kind: 'expedition' as const,
    id,
    at,
    result: 'resource' as const,
    size: 2,
    depletion: 0,
    res: { metal: 1000, crystal: 0, deuterium: 0, darkMatter: 0, food: 0 },
    ships: {},
    lost: {},
    item: null,
    lfXp: 0,
    lifeform: 0,
    artefacts: 0,
    coords: '1:1:16',
    ...extra,
  });

  it('counts each report once and sums a period', () => {
    let j: Journal = {};
    j = record(j, [entry('a', day(5)), entry('b', day(5), { result: 'ship', res: { metal: 0, crystal: 0, deuterium: 0, darkMatter: 0, food: 0 }, ships: { 202: 10 } })]).journal;
    const again = record(j, [entry('a', day(5))]);
    expect(again.added).toBe(0);
    j = recordCombat(j, 'c', day(5), { 204: 4 }, '1:1:16').journal;
    const s = periodStats(Object.values(j));
    expect(s.count).toBe(2);
    expect(s.outcomes).toEqual({ resource: 1, ship: 1 });
    expect(s.shipsValue.metal).toBe(20000);
    expect(s.lostValue.metal).toBe(12000);
    // 1000 + ships (20000 + 1.5·20000) − lost (12000 + 1.5·4000)
    expect(s.netMsu).toBe(1000 + 50000 - 18000);
  });

  it('picks periods and days', () => {
    const now = day(10, 18);
    let j: Journal = {};
    j = record(j, [entry('a', day(10, 9)), entry('b', day(9)), entry('c', day(2))]).journal;
    expect(entriesIn(j, periodRange('today', now)).length).toBe(1);
    expect(entriesIn(j, periodRange('yesterday', now)).length).toBe(1);
    expect(entriesIn(j, periodRange('week', now)).length).toBe(2);
    expect(entriesIn(j, periodRange('all', now)).length).toBe(3);
    expect(byDay(entriesIn(j, periodRange('all', now))).map((d) => d.stats.count)).toEqual([1, 1, 1]);
    expect(Object.keys(trim(j, day(2) + 600 * 86_400_000))).toEqual([]);
  });
});

describe('inbox page, list view', () => {
  it('puts the summary under the header row and opens the report like the row does', () => {
    // OGame 13 list view: header row always shown, body (.messageContentWrapper) hidden until opened.
    const el = msg('30', { coordinates: '1:476:7', playername: 'el_loco', targetplayerid: '5', resources: '211740737', loot: '75', metal: '122942381', crystal: '25224981', deuterium: '63573375', fleetvalue: '0', defensevalue: '329025000', activity: '-1' });
    el.querySelector('.msgContent')!.remove();
    el.querySelector('message-footer')!.remove();
    el.insertAdjacentHTML('beforeend', '<div class="msgFilteredHeaderRow"><div class="msgFilteredHeaderCell">el_loco</div></div><div class="messageContentWrapper"><message-footer class="msg_actions"></message-footer></div>');
    let opened = 0;
    el.querySelector<HTMLElement>('.msgFilteredHeaderCell')!.addEventListener('click', () => opened++);
    document.body.innerHTML = '';
    document.body.append(el);
    const store = new Store(new MemoryStore(), 'test');
    processMessages({ doc: document, store, playerId: OWN, locale: 'it', t });
    expect(Object.keys(store.get('spy.board', {}))).toEqual(['1:476:7']);
    // The spy table above the list says it all: no summary on the spy report itself.
    expect(el.querySelector('.fut-msg')).toBeNull();
    // Another report in the list view: the summary goes under the header row and opens it.
    const exp = msg('31', deut);
    exp.querySelector('.msgContent')!.remove();
    exp.insertAdjacentHTML('beforeend', '<div class="msgFilteredHeaderRow"><div class="msgFilteredHeaderCell">exp</div></div><div class="messageContentWrapper"></div>');
    exp.querySelector<HTMLElement>('.msgFilteredHeaderCell')!.addEventListener('click', () => opened++);
    document.body.append(exp);
    processMessages({ doc: document, store, playerId: OWN, locale: 'it', t });
    const box = exp.querySelector<HTMLElement>('.fut-msg')!;
    expect(box.previousElementSibling?.className).toBe('msgFilteredHeaderRow');
    box.click();
    expect(opened).toBe(1);
  });
});

describe('inbox page', () => {
  it('adds summaries, folds the text and fills the journal', () => {
    document.body.innerHTML = '';
    document.body.append(msg('1', shipwrecks, 'Ci siamo imbattuti nei resti...'), msg('2', deut));
    const store = new Store(new MemoryStore(), 'test');
    let added = 0;
    processMessages({ doc: document, store, playerId: OWN, locale: 'it', t, onJournal: (n) => (added = n) });
    expect(added).toBe(2);
    const first = document.querySelector('.msg[data-msg-id="1"]')!;
    expect(first.querySelector('.fut-msg')?.textContent).toMatch(/\+2\.?720/);
    expect(first.querySelector<HTMLImageElement>('.fut-msg img.fut-msg-icon')?.alt).toBe('Caccia Pesante');
    expect(first.classList.contains('fut-msg-folded')).toBe(true);
    // Clicking the summary shows the game's text again.
    (first.querySelector('.fut-msg') as HTMLElement).click();
    expect(first.classList.contains('fut-msg-folded')).toBe(false);
    // The keyboard does the same: Tab reaches the summary, Enter folds and unfolds, the state is announced.
    const line = first.querySelector<HTMLElement>('.fut-msg')!;
    expect(line.tabIndex).toBe(0);
    expect(line.getAttribute('role')).toBe('button');
    expect(line.getAttribute('aria-expanded')).toBe('true');
    line.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(first.classList.contains('fut-msg-folded')).toBe(true);
    expect(line.getAttribute('aria-expanded')).toBe('false');
    line.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(first.classList.contains('fut-msg-folded')).toBe(false);
    // Each resource carries its symbol (the shared one), not only the colour.
    expect(document.querySelectorAll('.fut-r svg.fut-res-ico').length).toBe(document.querySelectorAll('.fut-r').length);
    // Processing again does nothing new.
    expect(processMessages({ doc: document, store, playerId: OWN, locale: 'it', t })).toBe(0);
    expect(Object.keys(store.get(JOURNAL_KEY, {}))).toEqual(['1', '2']);

    openJournal({ doc: document, store, now: 1793891482000 + 3600_000, locale: 'it', t });
    const root = document.getElementById('fut-journal')!.shadowRoot!;
    (root.querySelectorAll('.tab')[4] as HTMLElement).click();
    expect(root.textContent).toContain('Diario spedizioni');
    expect(root.textContent).toContain('Navi trovate');
    closeJournal(document);
    expect(document.getElementById('fut-journal')).toBeNull();
  });
});

describe("today's recap on the Expeditions tab", () => {
  it('follows the reports as they are read, and only on that tab', () => {
    const now = () => 1793891482000 + 3600_000;
    document.body.innerHTML = '<div data-subtab-id="22" class="active"></div><div id="messages"><div class="messagesHolder"></div></div>';
    const holder = document.querySelector('.messagesHolder')!;
    holder.append(msg('1', shipwrecks));
    const store = new Store(new MemoryStore(), 'test');
    let opened = 0;
    const o = { doc: document, store, playerId: OWN, locale: 'it', t, now, onOpenJournal: () => opened++ };
    processMessages(o);
    const first = document.getElementById('fut-exprecap')!;
    // Recap, then the "just read" panel of these reports, then the reports.
    expect(first.nextElementSibling?.id).toBe('fut-expfresh');
    expect(first.nextElementSibling?.nextElementSibling).toBe(holder);
    expect(first.textContent).toContain('1 spedizioni');
    // A report read later changes the recap at once.
    holder.append(msg('2', deut));
    processMessages(o);
    const second = document.getElementById('fut-exprecap')!;
    expect(second.textContent).toContain('2 spedizioni');
    expect(second.textContent).not.toBe(first.textContent);
    second.click();
    expect(opened).toBe(1);
    // Another tab: no recap.
    document.querySelector('[data-subtab-id="22"]')!.classList.remove('active');
    processMessages(o);
    expect(document.getElementById('fut-exprecap')).toBeNull();
  });
});

describe('"just read" panel under the recap', () => {
  it('shows what the reports just read brought, adds a later batch, and goes away at the end of the countdown', () => {
    const now = () => 1793891482000 + 3600_000;
    document.body.innerHTML = '<div data-subtab-id="22" class="active"></div><div id="messages"><div class="messagesHolder"></div></div>';
    const holder = document.querySelector('.messagesHolder')!;
    const store = new Store(new MemoryStore(), 'test');
    const o = { doc: document, store, playerId: OWN, locale: 'it', t, now };
    holder.append(msg('1', shipwrecks));
    processMessages(o);
    const recap = document.getElementById('fut-exprecap')!;
    const panel = document.getElementById('fut-expfresh')!;
    expect(recap.nextElementSibling).toBe(panel);
    expect(panel.textContent).toContain('1 spedizioni');
    expect(panel.querySelectorAll('.fut-fresh-tile')).toHaveLength(4);
    // Nothing new: the panel stays as it is.
    processMessages(o);
    expect(document.getElementById('fut-expfresh')).toBe(panel);
    // A second report read meanwhile adds up, and the recap stays above the panel.
    holder.append(msg('2', deut));
    processMessages(o);
    const merged = document.getElementById('fut-expfresh')!;
    expect(merged.textContent).toContain('2 spedizioni');
    expect(document.getElementById('fut-exprecap')!.nextElementSibling).toBe(merged);
    merged.querySelector('.fut-fresh-timer i')!.dispatchEvent(new Event('animationend'));
    expect(document.getElementById('fut-expfresh')).toBeNull();
  });
});

describe('reports shared by the alliance', () => {
  it('are marked when read from Communication › shared espionage reports', async () => {
    const { SPY_BOARD_KEY } = await import('../src/engines/raids');
    const spyAttrs = { coordinates: '1:476:7', playername: 'el_loco', targetplayerid: '5', resources: '211740737', loot: '75', metal: '122942381', crystal: '25224981', deuterium: '63573375', fleetvalue: '0', defensevalue: '329025000', activity: '-1' };
    const store = new Store(new MemoryStore(), 'test');
    document.body.innerHTML = '<div data-subtab-id="11" class="active"></div>';
    document.body.append(msg('40', spyAttrs));
    processMessages({ doc: document, store, playerId: OWN, locale: 'it', t });
    expect(store.get<Record<string, { shared?: boolean }>>(SPY_BOARD_KEY, {})['1:476:7']?.shared).toBe(true);
    // A report already on the board (read before as your own) gets the mark when met in the shared tab.
    const board = store.get<Record<string, { shared?: boolean }>>(SPY_BOARD_KEY, {});
    delete board['1:476:7']!.shared;
    store.set(SPY_BOARD_KEY, board);
    document.querySelector('.msg')!.removeAttribute('data-fut-done');
    processMessages({ doc: document, store, playerId: OWN, locale: 'it', t });
    expect(store.get<Record<string, { shared?: boolean }>>(SPY_BOARD_KEY, {})['1:476:7']?.shared).toBe(true);
  });
});

describe('expedition rarity', () => {
  it('tints the whole message for big and huge finds, not for normal ones', () => {
    document.body.innerHTML = '';
    const normal = msg('41', { ...deut, size: '2' });
    const big = msg('42', { ...deut, size: '1', timestamp: '1793891472' });
    const huge = msg('43', { ...deut, size: '0', timestamp: '1793891473' });
    document.body.append(normal, big, huge);
    processMessages({ doc: document, store: new Store(new MemoryStore(), 'rar'), playerId: OWN, locale: 'it', t });
    expect(normal.classList.contains('fut-msgrar')).toBe(false);
    expect(big.classList.contains('fut-msgrar-1')).toBe(true);
    expect(huge.classList.contains('fut-msgrar-0')).toBe(true);
  });
});

describe('card view', () => {
  it('moves the pill into the footer and the value beside the title', () => {
    document.body.innerHTML = '';
    const el = msg('51', deut);
    el.querySelector('.msgContent')!.insertAdjacentHTML('beforebegin', '<div class="msgHead">Risultato della Spedizione</div>');
    document.body.append(el);
    processMessages({ doc: document, store: new Store(new MemoryStore(), 'card'), playerId: OWN, locale: 'it', t });
    expect(el.querySelector('message-footer .fut-msg-foot .fut-pill')).not.toBeNull();
    expect(el.querySelector('.msgHead .fut-msg-top')?.textContent).toContain('MSU');
    const line = el.querySelector('.fut-msg')!;
    expect(line.classList.contains('fut-msg-spread')).toBe(true);
    expect(line.querySelector('.fut-pill, .fut-msg-val')).toBeNull();
    expect(line.querySelector('.fut-r')).not.toBeNull();
  });
});
