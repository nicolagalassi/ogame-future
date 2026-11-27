/**
 * Future's guides, one per surface. The first time a surface shows, a small invite offers its guide; the
 * guide (core/tour) starts only from the player's click. «?» in each window head and fleet zone; the
 * settings' Guide tab lists every guide and the first steps.
 *
 * COMPLIANCE (AGENTS.md §1.1, §1.5, §1.7, §4): see core/tour. The invite dims and blocks nothing; it waits in
 * a corner until the player answers. Guides only explain: no game action, no network call. The watcher
 * below reads the page (a guide's surface drawn later, as the galaxy's) and never calls the server.
 */
import type { Store } from '../../core/storage';
import type { T } from '../../core/i18n';
import { icon, type IconName } from '../../core/icons';
import { followViewport, ZOOMED_OUT } from '../../core/viewport';
import { CARD_CSS, liveSteps, startTour, tourOpen, type TourLabels, type TourStep } from '../../core/tour';

export type GuideId = 'board' | 'fleet' | 'settings' | 'dashboard' | 'planner' | 'journal' | 'galaxy' | 'messages' | 'tech';
export const GUIDES: GuideId[] = ['board', 'fleet', 'settings', 'dashboard', 'planner', 'journal', 'galaxy', 'messages', 'tech'];
/** Guides seen (finished, closed or declined), in a store shared by every universe of this browser. */
export const SEEN_KEY = 'tour.seen';
/** Invites on a first visit: on unless the player turns them off (settings, Guide). */
export const OFFER_KEY = 'tour.offer';
/** Page a guide was asked for from elsewhere (the settings' Guide tab): it starts on that page's load. */
export const GUIDE_PARAM = 'futguide';
export const INVITE_ID = 'fut-tour-invite';

type Find = (doc: Document) => Element | null | undefined;
const q = (sel: string): Find => (doc) => doc.querySelector(sel);
const nth = (sel: string, n: number): Find => (doc) => doc.querySelectorAll(sel)[n];
/** Inside a window's shadow root. */
const win = (host: string, sel: string, n = 0): Find => (doc) => doc.getElementById(host)?.shadowRoot?.querySelectorAll(sel)[n];
const S = 'fut-settings-window';
const D = 'fut-dashboard';
const P = 'fut-planner';
const J = 'fut-journal';

/** Where each step points, in the order of its texts (tour.<id>.<n> = "Title|Text"); null = a card in the middle. */
const POINTS: Record<GuideId, (Find | null)[]> = {
  board: [
    null,
    nth('.fut-toolbar > button.fut-cell', 0),
    nth('.fut-toolbar > button.fut-cell', 1),
    (doc) => doc.querySelector('#planetList .fut-current') ?? doc.querySelector('#planetList .smallplanet'),
    q('.fut-tool-sync'),
    q('.fut-tool-settings'),
    nth('#fut-dock section.card', 0),
    nth('#fut-dock section.card', 1),
    q('#fut-touchbar'),
    null,
  ],
  fleet: [
    null,
    q('.fut-fedit .fut-ftool'),
    q('.fut-frules-open'),
    (doc) => doc.querySelector('.fut-mainship.on') ?? doc.querySelector('.fut-mainship'),
    nth('.fut-freserves .fut-fgroup', 0),
    nth('.fut-freserves .fut-fgroup', 1),
    q('.fut-facts > .fut-fzonebox:not(.fut-fsecond)'),
    q('.fut-facts > .fut-fzonebox.fut-fsecond'),
    q('.fut-fbar .fut-fread'),
    q('#fut-touchbar .send'),
    null,
  ],
  settings: [
    win(S, '.tabs'),
    win(S, '.body .row'),
    win(S, '.tab[data-section="bodies"]'),
    win(S, '.tab[data-section="keys"]'),
    win(S, '.tab[data-section="data"]'),
    win(S, '.tab[data-section="guide"]'),
  ],
  dashboard: [win(D, '.tabs'), win(D, '[data-tab="investments"]'), win(D, '[data-tab="history"]'), win(D, '[data-tab="mines"]')],
  planner: [win(P, '.kpis'), win(P, '.seg'), win(P, '.bring-all'), win(P, '.empty')],
  journal: [win(J, '.tabs'), win(J, '.tabs', 1), win(J, '.card.hero'), win(J, '.card-head')],
  galaxy: [
    q('#fut-galaxy-bar'),
    // The flag shows on the row under the pointer: a set one, else the name cell where it appears.
    (doc) => doc.querySelector('.fut-mk-flag.on') ?? doc.querySelector('.fut-mk-flag')?.closest('.cellPlayerName'),
    q('.fut-g-name'), q('.fut-g-rank'), q('.fut-g-dval')],
  messages: [q('.fut-msg'), q('#fut-spypanel')],
  tech: [q('.fut-tp-plan'), q('.fut-tp-stepper'), q('.fut-tp')],
};

/** The surface a guide speaks of: on the page (or its window open) = the guide can run. */
const ROOTS: Record<GuideId, string> = {
  board: '.fut-toolbar',
  fleet: '.fut-facts',
  settings: `#${S}`,
  dashboard: `#${D}`,
  planner: `#${P}`,
  journal: `#${J}`,
  galaxy: '#fut-galaxy-bar',
  messages: '.fut-msg',
  tech: '.fut-tp-plan',
};

/** The fleet bar's zones and the step that speaks of each (their «?»). */
export const FLEET_ZONES = { mission: 6, dest: 7, reserves: 4, round: 5 } as const;
export type FleetZone = keyof typeof FLEET_ZONES;

export function guideSteps(id: GuideId, t: T): TourStep[] {
  return POINTS[id].map((at, n) => {
    const [title = '', text = ''] = t(`tour.${id}.${n}`).split('|');
    return at ? { at, title, text } : { title, text };
  });
}

export const guideHere = (doc: Document, id: GuideId): boolean => !!doc.querySelector(ROOTS[id]);

export interface GuideDeps {
  doc: Document;
  /** Shared by every universe: a guide seen once is seen. */
  store: Store;
  t: T;
}

const labels = (t: T): TourLabels => ({
  next: t('tour.next'),
  back: t('tour.back'),
  done: t('tour.done'),
  close: t('tour.close'),
  count: (n, total) => t('tour.count', { n, total }),
});

const seen = (d: GuideDeps) => d.store.get<Partial<Record<GuideId, number>>>(SEEN_KEY, {});
const markSeen = (d: GuideDeps, id: GuideId) => d.store.set(SEEN_KEY, { ...seen(d), [id]: Date.now() });

/** Guides this page still has to offer, in order. */
const pending = new WeakMap<Document, GuideId[]>();
/** «Più tardi»: not again on this page. */
const later = new WeakMap<Document, Set<GuideId>>();

/** Runs guide `id` now (the player asked for it); `only` = just these steps (a zone's «?»). */
export function startGuide(d: GuideDeps, id: GuideId, only?: number[]): void {
  closeInvite(d.doc);
  const all = guideSteps(id, d.t);
  const steps = only ? only.flatMap((n) => (all[n] ? [all[n]] : [])) : all;
  startTour(d.doc, steps, labels(d.t), () => {
    if (only) return;
    markSeen(d, id);
    // The next guide waiting on this page, if any (the planet menu's, then the fleet page's).
    offerGuides(d, pending.get(d.doc) ?? []);
  });
}

export function closeInvite(doc: Document): void {
  doc.getElementById(INVITE_ID)?.remove();
}

const INVITE_CSS = `${CARD_CSS}
.card { right: 16px; bottom: 16px; z-index: 1000003; width: 320px; }
.card.docked { right: auto; bottom: auto; padding-bottom: calc(12px + env(safe-area-inset-bottom)); }
.top { display: flex; align-items: center; gap: 8px; color: var(--label); }
`;

/** Offers the first unseen guide of `ids` whose surface is on the page: a corner card, nothing dimmed or
 *  blocked. Surfaces drawn later (galaxy, inbox) are offered when they show. */
export function offerGuides(d: GuideDeps, ids: GuideId[]): void {
  const { doc, t } = d;
  pending.set(doc, ids);
  if (!d.store.get<boolean>(OFFER_KEY, true)) return;
  if (doc.getElementById(INVITE_ID) || tourOpen(doc)) return;
  const done = seen(d);
  const skip = later.get(doc) ?? new Set<GuideId>();
  const waiting = ids.filter((id) => !done[id] && !skip.has(id));
  const id = waiting.find((g) => guideHere(doc, g) && liveSteps(doc, guideSteps(g, t)).length > 1);
  if (!id) {
    if (waiting.length) watchFor(d);
    return;
  }
  const host = doc.createElement('div');
  host.id = INVITE_ID;
  const root = host.attachShadow({ mode: 'open' });
  const style = doc.createElement('style');
  style.textContent = INVITE_CSS;
  const card = doc.createElement('div');
  card.className = 'card';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-labelledby', 'fut-invite-title');
  const top = doc.createElement('div');
  top.className = 'top';
  const h = doc.createElement('h3');
  h.id = 'fut-invite-title';
  h.textContent = t('tour.inviteTitle');
  top.append(icon(doc, 'help', 18), h);
  const p = doc.createElement('p');
  p.textContent = t('tour.inviteText', { name: t(`tour.name.${id}`) });
  const acts = doc.createElement('div');
  acts.className = 'acts';
  const btn = (cls: string, text: string, onClick: () => void) => {
    const b = doc.createElement('button');
    b.type = 'button';
    b.className = cls;
    b.textContent = text;
    b.addEventListener('click', onClick);
    acts.append(b);
    return b;
  };
  btn('b quiet', t('tour.no'), () => {
    markSeen(d, id);
    closeInvite(doc);
    offerGuides(d, ids);
  });
  btn('b ghost', t('tour.later'), () => {
    later.set(doc, skip.add(id));
    closeInvite(doc);
    offerGuides(d, ids);
  });
  btn('b primary', t('tour.show'), () => startGuide(d, id));
  card.append(top, p, acts);
  root.append(style, card);
  doc.body.append(host);
  // Phone, page zoomed out: along the bottom of the screen at the phone's size, over Future's own touch bar;
  // the top holds the game's officers and resources, which it must not cover (AGENTS.md §1.7).
  const vv = doc.defaultView?.visualViewport;
  if (vv && vv.scale < ZOOMED_OUT) {
    card.classList.add('docked');
    followViewport(doc, card, 'bottom');
  }
}

/** Surfaces drawn after the page loaded (galaxy system, inbox reports): offered when they show up. */
const watching = new WeakSet<Document>();
function watchFor(d: GuideDeps): void {
  const { doc } = d;
  if (watching.has(doc) || !doc.body) return;
  watching.add(doc);
  let queued = false;
  const observer = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    // Reads the page only, a moment after it settles (no call to the server).
    setTimeout(() => {
      queued = false;
      const left = (pending.get(doc) ?? []).filter((id) => !seen(d)[id] && !later.get(doc)?.has(id));
      if (!left.length) {
        observer.disconnect();
        watching.delete(doc);
        return;
      }
      if (left.some((id) => guideHere(doc, id))) offerGuides(d, pending.get(doc) ?? []);
    }, 400);
  });
  observer.observe(doc.body, { childList: true, subtree: true });
}

/** A guide asked for on another page («Mostrami»): starts when its surface is here. Reads the page only. */
export function startWhenReady(d: GuideDeps, id: GuideId): void {
  if (guideHere(d.doc, id)) return startGuide(d, id);
  const observer = new MutationObserver(() => {
    if (!guideHere(d.doc, id)) return;
    observer.disconnect();
    startGuide(d, id);
  });
  observer.observe(d.doc.body, { childList: true, subtree: true });
}

/** Guide asked for from another page (?futguide=…): started on this load, it was the player's click. */
export function guideFromUrl(href: string): GuideId | null {
  const id = new URL(href).searchParams.get(GUIDE_PARAM);
  return GUIDES.includes(id as GuideId) ? (id as GuideId) : null;
}

/** Game page where a page guide runs (for the settings' Guide tab, from elsewhere). */
const GUIDE_PAGES: Partial<Record<GuideId, string>> = { fleet: 'fleetdispatch', galaxy: 'galaxy', messages: 'messages', tech: 'supplies' };
export function guideUrl(href: string, id: GuideId): string | null {
  const component = GUIDE_PAGES[id];
  if (!component) return null;
  const u = new URL(href);
  u.search = '';
  u.searchParams.set('page', 'ingame');
  u.searchParams.set('component', component);
  u.searchParams.set(GUIDE_PARAM, id);
  return u.toString();
}

/** One of the first steps to set Future up, done or still to do. */
export interface FirstStep {
  key: 'sync' | 'fleetsave' | 'mainShip' | 'plan' | 'journal';
  done: boolean;
  /** What «Mostrami» does: a guide (or one of its steps), or another settings tab. */
  show: () => void;
}

export interface GuidePanelOptions {
  doc: Document;
  t: T;
  store: Store;
  steps: FirstStep[];
  /** Starts a guide (closing the settings first, opening a window or another page if needed). */
  onStart: (id: GuideId) => void;
  /** Redraws the settings tab after a choice. */
  redraw: () => void;
}

/** The settings' Guide tab: first steps, every guide, the invites switch (the settings' own classes). */
export function guidePanel(o: GuidePanelOptions): HTMLElement[] {
  const { doc, t } = o;
  const el = (tag: string, cls = '', text = '') => {
    const n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  };
  const row = (name: string, desc: string, control: HTMLElement) => {
    const r = el('div', 'row');
    r.append(el('span', 'name', name), el('span', 'desc', desc), control);
    return r;
  };
  const action = (label: string, onClick: () => void) => {
    const box = el('span', 'control');
    const b = el('button', 'seg', label) as HTMLButtonElement;
    b.type = 'button';
    b.addEventListener('click', onClick);
    box.append(b);
    return box;
  };
  const group = (label: string, glyph: IconName) => {
    const g = el('div', 'group');
    const gi = el('span', 'gi');
    gi.append(icon(doc, glyph, 16));
    g.append(gi, doc.createTextNode(label));
    return g;
  };
  const out: HTMLElement[] = [group(t('tour.firstSteps'), 'flag')];
  o.steps.forEach((s, n) => {
    let control: HTMLElement;
    if (s.done) {
      control = el('span', 'control fut-done');
      control.append(icon(doc, 'check', 16), el('span', '', t('tour.stepDone')));
    } else control = action(t('tour.show'), s.show);
    const r = row(`${n + 1} · ${t(`tour.step.${s.key}`)}`, t(`tour.step.${s.key}Hint`), control);
    if (s.done) r.classList.add('fut-step-done');
    out.push(r);
  });
  out.push(group(t('tour.all'), 'help'));
  for (const id of GUIDES) out.push(row(t(`tour.name.${id}`), t(`tour.where.${id}`), action(t('tour.start'), () => o.onStart(id))));
  const on = o.store.get<boolean>(OFFER_KEY, true);
  const sw = el('span', 'control');
  const b = el('button', 'switch') as HTMLButtonElement;
  b.type = 'button';
  b.setAttribute('role', 'switch');
  b.setAttribute('aria-checked', String(on));
  b.setAttribute('aria-label', t('tour.offer'));
  b.append(el('i', 'sw-track'));
  b.addEventListener('click', () => {
    o.store.set(OFFER_KEY, !on);
    o.redraw();
  });
  sw.append(b);
  out.push(
    group(t('tour.invites'), 'bell'),
    row(t('tour.offer'), t('tour.offerHint'), sw),
    row(
      t('tour.reset'),
      t('tour.resetHint'),
      action(t('tour.resetDo'), () => {
        o.store.set(SEEN_KEY, {});
        o.redraw();
      }),
    ),
  );
  return out;
}
