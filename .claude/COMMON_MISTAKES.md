# Common Mistakes

**⚠️ CRITICAL - Read at session start.** The full rules are in `AGENTS.md` (OGame Origin team):
read it before every feature. This page lists the ones easiest to break.

---

## Top 5 Critical Mistakes

### 1. A network call outside the guard
**Symptom**: `fetch(` or `XMLHttpRequest` anywhere but `src/core/guard.ts`.
**Check**: `grep -rn "fetch(" src | grep -v core/guard.ts`
**Fix**: call `guard.request(path, reason)`; background calls only at page load (once per session) or from the Sync click.

### 2. `cp=` in a background call, or a timer/loop that calls the server
**Symptom**: changes the player's active planet, or makes activity on a timer.
**Fix**: cross-planet data comes from the stored accountInfo snapshot. Links with `cp=` are fine only as normal user clicks.

### 3. Sending a fleet (or any game action) without the player's click
**Fix**: Future prepares the form; the player always presses Send. One click = one action.

### 4. Probing outside inbox/galaxy, notifications for game events, data leaving the browser
**Fix**: all forbidden (AGENTS.md §1.5.1, §1.4, §1.9). Exception rule from Nicola: what OGLight already does is allowed.

### 5. Breaking the repo's style or build
**Symptom**: Prettier double quotes, minified output, push without checks.
**Fix**: single quotes, long lines; `scripts/build.mjs` never minifies; run `npm run check` before every push. Keep "© 2019 Oz" (OGLight, MIT).

---

**Last Updated**: 2026-11-05
