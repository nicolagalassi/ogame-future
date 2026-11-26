import { WINDOW_TOKENS } from '../../core/sheet';
/**
 * Manual reminders on the page.
 *
 * COMPLIANCE (AGENTS.md §1.4, §1.2): the player sets each reminder by hand on one specific event
 * (a bell on a queue item or on a fleet of the game's event list). When it is due, Future shows a
 * message on the page; only if the player turned it on in the settings (off by default, Nicola's
 * choice pending a ToolDev confirmation of the "external channel"), the same message also goes to the
 * browser's own notification on the computer. No sound, no e-mail or webhook, no game action, no
 * network call. The one timer below only waits to draw that message; it never talks to the server.
 */
import { icon } from '../../core/icons';
import type { Store } from '../../core/storage';
import { dueReminders, hasReminder, markFired, nextReminder, REMIND_DESKTOP_KEY, REMINDERS_KEY, toggleReminder, type Reminder } from '../../engines/reminders';

type T = (key: string, vars?: Record<string, string | number>) => string;

export interface RemindersOptions {
  doc: Document;
  store: Store;
  t: T;
  locale: string;
  /** Server clock minus local clock, in ms (from the page's ogame-timestamp). */
  offset: number;
}

const HOST_ID = 'fut-reminders';
let timer: ReturnType<typeof setTimeout> | null = null;
let current: RemindersOptions | null = null;

/** Server time minus local time, from the timestamp the game writes into every page. */
export function clockOffset(doc: Document, localNow: number): number {
  const ts = Number(doc.querySelector('meta[name="ogame-timestamp"]')?.getAttribute('content'));
  return ts ? ts * 1000 - localNow : 0;
}

const serverNow = (o: RemindersOptions) => Date.now() + o.offset;

function toastHost(doc: Document): ShadowRoot {
  const existing = doc.getElementById(HOST_ID)?.shadowRoot;
  if (existing) return existing;
  const host = doc.createElement('div');
  host.id = HOST_ID;
  const root = host.attachShadow({ mode: 'open' });
  const style = doc.createElement('style');
  style.textContent = `
.stack { position: fixed; right: 16px; bottom: 16px; z-index: 1000002; display: flex; flex-direction: column; gap: 8px; max-width: 340px; }
.toast { display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; border-radius: 10px; background: #111B2A; border: 1px solid #4FD1E8;
  color: #E6EDF5; font: 13px Arial, sans-serif; box-shadow: 0 8px 24px rgba(0,0,0,0.5); }
.toast svg { flex-shrink: 0; margin-top: 1px; color: #4FD1E8; }
.toast b { display: block; margin-bottom: 2px; }
.toast span { color: #8A9BB0; font-size: 12px; }
.toast button { margin-left: auto; height: 24px; padding: 0 10px; border-radius: 6px; border: 1px solid #1F2C40; background: #0A111C; color: #E6EDF5; cursor: pointer; font: 12px Arial, sans-serif; }
.toast button:hover, .toast button:focus-visible { border-color: #4FD1E8; }`;
  const stack = doc.createElement('div');
  stack.className = 'stack';
  root.append(style, stack);
  doc.body.append(host);
  return root;
}

function show(o: RemindersOptions, r: Reminder, late: boolean): void {
  const { doc, t, locale } = o;
  const stack = toastHost(doc).querySelector('.stack')!;
  const box = doc.createElement('div');
  box.className = 'toast';
  box.setAttribute('role', 'alert');
  const text = doc.createElement('div');
  const title = doc.createElement('b');
  title.textContent = r.label;
  const when = doc.createElement('span');
  const time = new Date(r.at - o.offset).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  when.textContent = t(late ? 'remind.late' : 'remind.now', { time });
  text.append(title, when);
  const ok = doc.createElement('button');
  ok.type = 'button';
  ok.textContent = t('remind.ok');
  ok.addEventListener('click', () => box.remove());
  box.append(icon(doc, 'bell', 16), text, ok);
  stack.append(box);
  desktop(o, r.label, when.textContent ?? '', r.id);
}

/** The same message as a browser notification, when the player turned it on and the browser allows it. */
function desktop(o: RemindersOptions, title: string, body: string, tag: string): void {
  const view = o.doc.defaultView as (Window & { Notification?: typeof Notification }) | null;
  const N = view?.Notification;
  if (!N || N.permission !== 'granted' || !o.store.get<boolean>(REMIND_DESKTOP_KEY, false)) return;
  try {
    const n = new N(title, { body, tag });
    n.onclick = () => {
      view.focus();
      n.close();
    };
  } catch {
    // Some browsers only allow notifications from a service worker: the page message is still there.
  }
}

/** Shows what is due, then waits for the next one. Call again after the list changes. */
export function startReminders(o: RemindersOptions, late = true): void {
  current = o;
  if (timer) clearTimeout(timer);
  timer = null;
  const list = o.store.get<Reminder[]>(REMINDERS_KEY, []);
  const now = serverNow(o);
  const due = dueReminders(list, now);
  for (const r of due) show(o, r, late && now - r.at > 60_000);
  if (due.length) o.store.set(REMINDERS_KEY, markFired(list, due.map((r) => r.id), now));
  const next = nextReminder(o.store.get<Reminder[]>(REMINDERS_KEY, []), now);
  // Display-only timer (see the header). Capped so a far reminder is re-checked, never polled.
  if (next) timer = setTimeout(() => startReminders(o, false), Math.min(next.at - now + 500, 2 ** 31 - 1));
}

/** Toggles a reminder from a user click and re-arms the page timer. */
export function toggleFromClick(store: Store, r: Reminder): boolean {
  const list = toggleReminder(store.get<Reminder[]>(REMINDERS_KEY, []), r);
  store.set(REMINDERS_KEY, list);
  if (current) startReminders(current, false);
  return hasReminder(list, r.id);
}

/** A bell button bound to one event. */
export function bellButton(doc: Document, store: Store, t: T, r: Reminder, cls = 'fut-bell'): HTMLButtonElement {
  const b = doc.createElement('button');
  b.type = 'button';
  b.className = cls;
  b.append(icon(doc, 'bell', 12));
  const paint = (on: boolean) => {
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
    b.title = t(on ? 'remind.remove' : 'remind.add');
    b.setAttribute('aria-label', `${b.title}: ${r.label}`);
  };
  paint(hasReminder(store.get<Reminder[]>(REMINDERS_KEY, []), r.id));
  b.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    paint(toggleFromClick(store, r));
  });
  return b;
}

/**
 * Bells on the fleets of the game's event list (#eventContent, loaded by the game on demand).
 * Reads the row attributes the game writes (data-arrival-time in seconds, server clock).
 */
export function decorateEventList(o: RemindersOptions): void {
  const { doc, store, t } = o;
  for (const row of doc.querySelectorAll<HTMLElement>('#eventContent tr.eventFleet, #eventContent tr.allianceAttack')) {
    if (row.querySelector('.fut-bell')) continue;
    const arrival = Number(row.dataset.arrivalTime);
    const cell = row.querySelector('td.arrivalTime');
    if (!arrival || !cell) continue;
    const mission = row.querySelector<HTMLElement>('td.missionFleet img')?.getAttribute('title')?.replace(/^.*\|/, '').trim() || '';
    const dest = row.querySelector('td.destCoords')?.textContent?.trim() || '';
    const back = row.dataset.returnFlight === 'true' ? ` ${t('remind.return')}` : '';
    cell.append(bellButton(doc, store, t, { id: `f:${row.id || `${arrival}:${dest}`}`, label: `${mission}${back} ${dest}`.trim(), at: arrival * 1000 }));
  }
}

const EVENT_CSS = `
/* Window tokens (core/sheet.ts) on the bells only, never on the game's event list itself: the game's own
   (mobile) styles may use variables of the same names, and turned red (Nicola, 2026-11-26). */
#eventContent .fut-bell { ${WINDOW_TOKENS} }
#eventContent .fut-bell { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; margin-left: 4px; padding: 0;
  border: 1px solid var(--line); border-radius: 4px; background: var(--bg); color: var(--muted); cursor: pointer; vertical-align: middle; }
#eventContent .fut-bell:hover, #eventContent .fut-bell:focus-visible { border-color: var(--accent); color: var(--text); }
#eventContent .fut-bell.on { border-color: var(--accent); background: var(--accent-soft); color: var(--accent); }`;

export function watchEventList(o: RemindersOptions): void {
  if (!o.doc.getElementById('fut-bell-style')) {
    const style = o.doc.createElement('style');
    style.id = 'fut-bell-style';
    style.textContent = EVENT_CSS;
    o.doc.head.append(style);
  }
  decorateEventList(o);
  let queued = false;
  // The game loads and refreshes the event list without a page change.
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    setTimeout(() => {
      queued = false;
      decorateEventList(o);
    }, 50);
  }).observe(o.doc.body, { childList: true, subtree: true });
}
