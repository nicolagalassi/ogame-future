// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { dueReminders, markFired, nextReminder, REMIND_DESKTOP_KEY, REMINDERS_KEY, toggleReminder, type Reminder } from '../src/engines/reminders';
import { clockOffset, decorateEventList, startReminders } from '../src/modules/reminders';
import { MemoryStore, Store } from '../src/core/storage';
import { translator } from '../src/core/i18n';

const t = translator('it');
const r = (id: string, at: number): Reminder => ({ id, label: id, at });

afterEach(() => { vi.useRealTimers(); document.body.innerHTML = ''; document.head.innerHTML = ''; });

describe('reminders', () => {
  it('toggles, finds due and next, forgets shown ones after a day', () => {
    let list = toggleReminder([], r('b', 200));
    list = toggleReminder(list, r('a', 100));
    expect(list.map((x) => x.id)).toEqual(['a', 'b']);
    expect(toggleReminder(list, r('a', 100)).map((x) => x.id)).toEqual(['b']);
    expect(dueReminders(list, 150).map((x) => x.id)).toEqual(['a']);
    expect(nextReminder(list, 150)?.id).toBe('b');
    const fired = markFired(list, ['a'], 150);
    expect(dueReminders(fired, 150)).toEqual([]);
    expect(markFired(fired, [], 100 + 25 * 3_600_000).map((x) => x.id)).toEqual(['b']);
  });

  it('also sends the browser notification only when the player turned it on and the browser allows it', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    const shown: { title: string; body?: string }[] = [];
    class FakeNotification {
      static permission = 'granted';
      onclick: (() => void) | null = null;
      constructor(title: string, opts?: { body?: string }) {
        shown.push({ title, body: opts?.body });
      }
      close() {}
    }
    vi.stubGlobal('Notification', FakeNotification);
    const store = new Store(new MemoryStore(), 'n');
    store.set(REMINDERS_KEY, [r('Cantiere Ashyn', 990_000)]);
    startReminders({ doc: document, store, t, locale: 'it', offset: 0 });
    expect(shown).toHaveLength(0); // off by default: only the page message
    store.set(REMIND_DESKTOP_KEY, true);
    store.set(REMINDERS_KEY, [r('Flotta Roshar', 995_000)]);
    startReminders({ doc: document, store, t, locale: 'it', offset: 0 });
    expect(shown.map((n) => n.title)).toEqual(['Flotta Roshar']);
    FakeNotification.permission = 'denied';
    store.set(REMINDERS_KEY, [r('Altro', 996_000)]);
    startReminders({ doc: document, store, t, locale: 'it', offset: 0 });
    expect(shown).toHaveLength(1);
    vi.unstubAllGlobals();
  });

  it('reads the server clock offset from the page', () => {
    document.head.innerHTML = '<meta name="ogame-timestamp" content="1000">';
    expect(clockOffset(document, 990_000)).toBe(10_000);
  });

  it('shows a due reminder on the page and the next one when its time comes, without any network', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const store = new Store(new MemoryStore(), 't');
    store.set(REMINDERS_KEY, [r('old', 900_000), r('soon', 1_060_000)]);
    startReminders({ doc: document, store, t, locale: 'it', offset: 0 });
    const toasts = () => document.getElementById('fut-reminders')!.shadowRoot!.querySelectorAll('.toast');
    expect(toasts()).toHaveLength(1);
    vi.advanceTimersByTime(61_000);
    expect(toasts()).toHaveLength(2);
    expect(store.get<Reminder[]>(REMINDERS_KEY, []).every((x) => x.fired)).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('puts a bell on each fleet of the event list', () => {
    document.body.innerHTML = `<table id="eventContent"><tbody>
      <tr class="eventFleet" id="eventRow-77" data-arrival-time="2000" data-return-flight="true">
        <td class="arrivalTime">12:00:00</td><td class="missionFleet"><img title="Flotte proprie | Trasporto"></td><td class="destCoords"><a>[1:2:3]</a></td></tr>
    </tbody></table>`;
    const store = new Store(new MemoryStore(), 't');
    decorateEventList({ doc: document, store, t, locale: 'it', offset: 0 });
    const bell = document.querySelector<HTMLButtonElement>('.fut-bell')!;
    bell.click();
    expect(store.get<Reminder[]>(REMINDERS_KEY, [])).toEqual([{ id: 'f:eventRow-77', label: 'Trasporto (ritorno) [1:2:3]', at: 2_000_000 }]);
    expect(bell.getAttribute('aria-pressed')).toBe('true');
  });
});
