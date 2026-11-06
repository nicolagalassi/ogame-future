/**
 * Writes pending changes only when the player has been idle for a while,
 * so saving never slows the game down (same behaviour as OGLight).
 * This timer touches local storage only: it never makes a network call.
 */
export class IdleSaver {
  private dirty = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly flush: () => void,
    private readonly idleMs = 10_000,
    target: Pick<EventTarget, 'addEventListener'> = window,
  ) {
    for (const type of ['mousemove', 'keydown', 'click', 'scroll']) {
      target.addEventListener(type, () => this.reschedule(), { passive: true });
    }
  }

  markDirty(): void {
    this.dirty = true;
    this.reschedule();
  }

  /** Saves immediately, e.g. before the page unloads. */
  saveNow(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (!this.dirty) return;
    this.dirty = false;
    this.flush();
  }

  private reschedule(): void {
    if (!this.dirty) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.saveNow(), this.idleMs);
  }
}
