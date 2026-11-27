// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryStore, Store } from '../src/core/storage';
import { translator, type Locale } from '../src/core/i18n';
import { endTour, startTour, TOUR_ID, tourOpen, type TourLabels } from '../src/core/tour';
import { FLEET_ZONES, GUIDES, LATER_KEY, guideFromUrl, guidePanel, guideSteps, guideUrl, INVITE_ID, OFFER_KEY, offerGuides, SEEN_KEY, startGuide, type GuideDeps } from '../src/modules/guide';
import { mountTouchBar, registerActions, resetShortcuts } from '../src/modules/shortcuts';

const t = translator('it');
const labels: TourLabels = { next: 'Avanti', back: 'Indietro', done: 'Fine', close: 'Chiudi', count: (n, total) => `${n} di ${total}` };
const card = () => document.getElementById(TOUR_ID)!.shadowRoot!.querySelector('.card')!;
const press = (text: string) =>
  Array.from(card().querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent === text)!.click();
const key = (k: string) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
const deps = (): GuideDeps => ({ doc: document, store: new Store(new MemoryStore(), 'future'), t });
const TOOLBAR = '<div class="fut-toolbar"><button class="fut-cell">P</button><button class="fut-cell">Piano</button></div>';
const inviteButton = (doc: Document, text: string) =>
  Array.from(doc.getElementById(INVITE_ID)!.shadowRoot!.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent === text)!;

afterEach(() => {
  endTour();
  document.getElementById(INVITE_ID)?.remove();
  document.body.innerHTML = '';
  resetShortcuts();
});

describe('guided tour', () => {
  it('walks the steps in order, skips a control not on the page, and says when it was finished', () => {
    document.body.innerHTML = '<button id="a">A</button><button id="c">C</button>';
    const onEnd = vi.fn();
    startTour(
      document,
      [
        { title: 'Benvenuto', text: 'Uno\nDue' },
        { at: (d) => d.getElementById('a'), title: 'A', text: 'a' },
        { at: (d) => d.getElementById('b'), title: 'B', text: 'b' },
        { at: (d) => d.getElementById('c'), title: 'C', text: 'c' },
      ],
      labels,
      onEnd,
    );
    expect(card().querySelector('h3')!.textContent).toBe('Benvenuto');
    // Paragraphs on "\n"; the count speaks of the steps that can show (B is not on the page).
    expect(card().querySelectorAll('p')).toHaveLength(2);
    expect(card().querySelector('.count')!.textContent).toBe('1 di 3');
    press('Avanti');
    expect(card().querySelector('h3')!.textContent).toBe('A');
    press('Avanti');
    expect(card().querySelector('h3')!.textContent).toBe('C');
    press('Indietro');
    expect(card().querySelector('h3')!.textContent).toBe('A');
    key('ArrowRight');
    press('Fine');
    expect(tourOpen(document)).toBe(false);
    expect(onEnd).toHaveBeenCalledWith(true);
  });

  it('never presses the lit control: a shield covers it', () => {
    const click = vi.fn();
    document.body.innerHTML = '<button id="a">A</button>';
    document.getElementById('a')!.addEventListener('click', click);
    startTour(document, [{ at: (d) => d.getElementById('a'), title: 'A', text: 'a' }], labels);
    expect(document.getElementById(TOUR_ID)!.shadowRoot!.querySelector('.shield')).not.toBeNull();
    press('Fine');
    expect(click).not.toHaveBeenCalled();
  });

  it('Esc leaves early, before a window below hears it', () => {
    const windowEsc = vi.fn();
    document.addEventListener('keydown', windowEsc, true);
    const onEnd = vi.fn();
    startTour(document, [{ title: 'A', text: 'a' }, { title: 'B', text: 'b' }], labels, onEnd);
    key('Escape');
    document.removeEventListener('keydown', windowEsc, true);
    expect(onEnd).toHaveBeenCalledWith(false);
    expect(windowEsc).not.toHaveBeenCalled();
  });

  it("keeps Future's shortcut keys quiet while it is open", () => {
    const run = vi.fn();
    registerActions(document, new Store(new MemoryStore(), 'x'), t, { 'fleet.expedition': run });
    startTour(document, [{ title: 'A', text: 'a' }], labels);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', bubbles: true }));
    expect(run).not.toHaveBeenCalled();
    endTour();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', bubbles: true }));
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('with nothing to show, does not open', () => {
    const onEnd = vi.fn();
    startTour(document, [{ at: () => null, title: 'A', text: 'a' }], labels, onEnd);
    expect(tourOpen(document)).toBe(false);
    expect(onEnd).toHaveBeenCalledWith(false);
  });
});

describe('guides', () => {
  it('every step has a title and a text in every language', () => {
    for (const locale of ['it', 'en', 'de', 'fr'] as Locale[]) {
      const tr = translator(locale);
      for (const id of GUIDES)
        for (const s of guideSteps(id, tr)) {
          expect(s.title, `${locale} ${id}`).not.toMatch(/^tour\./);
          expect(s.text.length, `${locale} ${id} ${s.title}`).toBeGreaterThan(10);
        }
    }
  });

  it('offers a guide once, in a corner card that dims nothing; the guide starts only from «Mostrami»', () => {
    document.body.innerHTML = TOOLBAR;
    const d = deps();
    offerGuides(d, ['board']);
    expect(document.getElementById(INVITE_ID)).not.toBeNull();
    expect(tourOpen(document)).toBe(false);
    inviteButton(document, 'Mostrami').click();
    expect(document.getElementById(INVITE_ID)).toBeNull();
    expect(tourOpen(document)).toBe(true);
    key('Escape');
    // Closed, even early: seen, not offered again.
    expect(d.store.get<Record<string, number>>(SEEN_KEY, {}).board).toBeGreaterThan(0);
    offerGuides(d, ['board']);
    expect(document.getElementById(INVITE_ID)).toBeNull();
  });

  it('«No, grazie» marks it seen; «Più tardi» only for this page; invites can be turned off', () => {
    document.body.innerHTML = TOOLBAR;
    const d = deps();
    offerGuides(d, ['board']);
    inviteButton(document, 'Più tardi').click();
    offerGuides(d, ['board']);
    expect(document.getElementById(INVITE_ID)).toBeNull();
    expect(d.store.get(SEEN_KEY, {})).toEqual({});

    const other = { ...deps(), doc: document.implementation.createHTMLDocument('') };
    other.doc.body.innerHTML = TOOLBAR;
    offerGuides(other, ['board']);
    inviteButton(other.doc, 'No, grazie').click();
    expect(other.store.get<Record<string, number>>(SEEN_KEY, {}).board).toBeGreaterThan(0);

    const off = { ...deps(), doc: document.implementation.createHTMLDocument('') };
    off.store.set(OFFER_KEY, false);
    off.doc.body.innerHTML = TOOLBAR;
    offerGuides(off, ['board']);
    expect(off.doc.getElementById(INVITE_ID)).toBeNull();
  });

  it('«Più tardi» holds for some hours, on every page; with a touch bar the invite rides above its keys', () => {
    document.body.innerHTML = TOOLBAR;
    const d = deps();
    offerGuides(d, ['board']);
    inviteButton(document, 'Più tardi').click();
    expect(d.store.get<Record<string, number>>(LATER_KEY, {}).board).toBeGreaterThan(0);
    const next = { ...d, doc: document.implementation.createHTMLDocument('') };
    next.doc.body.innerHTML = TOOLBAR;
    offerGuides(next, ['board']);
    expect(next.doc.getElementById(INVITE_ID)).toBeNull();

    const store = new Store(new MemoryStore(), 'x');
    store.set('keys.touch', 'on');
    registerActions(document, store, t, { 'fleet.expedition': () => {} });
    mountTouchBar(document, store, t);
    offerGuides(deps(), ['board']);
    const invite = document.getElementById(INVITE_ID)!;
    expect(invite.parentElement?.id).toBe('fut-touchbar');
    inviteButton(document, 'Mostrami').click();
    // Gone from the bar for good: a redraw of the bar does not bring it back.
    mountTouchBar(document, store, t);
    expect(document.getElementById(INVITE_ID)).toBeNull();
  });

    it("a fleet zone's «?» shows that zone's step alone", () => {
    document.body.innerHTML = '<div class="fut-fbar fut-freserves"><span class="fut-fgroup">R</span><span class="fut-fgroup">G</span></div>';
    startGuide(deps(), 'fleet', [FLEET_ZONES.round]);
    expect(card().querySelector('h3')!.textContent).toBe('5 · Giro');
    expect(card().querySelector('.count')).toBeNull();
  });

  it('a guide asked for on another page goes there and starts on its load', () => {
    const url = guideUrl('https://s1-it.ogame.gameforge.com/game/index.php?page=ingame&component=overview&cp=3', 'fleet')!;
    expect(url).toContain('component=fleetdispatch');
    expect(guideFromUrl(url)).toBe('fleet');
    expect(guideFromUrl('https://s1-it.ogame.gameforge.com/game/index.php?futguide=evil')).toBeNull();
    // Windows open where the player is: no page of their own.
    expect(guideUrl(url, 'dashboard')).toBeNull();
  });

  it('the Guide tab lists the first steps (done, or «Mostrami») and every guide', () => {
    const show = vi.fn();
    const onStart = vi.fn();
    const box = document.createElement('div');
    box.append(
      ...guidePanel({
        doc: document,
        t,
        store: deps().store,
        steps: [
          { key: 'sync', done: true, show },
          { key: 'fleetsave', done: false, show },
        ],
        onStart,
        redraw: () => {},
      }),
    );
    const named = (name: string) => Array.from(box.querySelectorAll('.row')).find((r) => r.querySelector('.name')!.textContent === name)!;
    expect(named('1 · Sincronizza i dati').querySelector('.fut-done')).not.toBeNull();
    named('2 · Bersaglio del fleetsave').querySelector<HTMLButtonElement>('button')!.click();
    expect(show).toHaveBeenCalled();
    named('Pagina Flotta').querySelector<HTMLButtonElement>('button')!.click();
    expect(onStart).toHaveBeenCalledWith('fleet');
  });
});
