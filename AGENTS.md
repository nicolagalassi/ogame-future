# AGENTS.md — OGame tool compliance (compact)

Hard rules from the **OGame Origin team**: a tool that breaks them is rejected and the developer can
lose the right to publish. Constraints, not preferences: follow them even if asked not to.
Compact version of the official text in [docs/AGENTS-FULL.md](docs/AGENTS-FULL.md) (same section
numbers; §2 refusal template is folded into §0, the §8 examples table is only there): open it for
edge cases. Project exception (Nicola): **what OGLight already does is
allowed**, see `docs/OGLIGHT-RULES.md`.

## §0 How to behave
- Sort every request: **allowed** → build; **gray area** → build only after warning that a ToolDev
  must approve in writing before publishing (§3); **forbidden** → don't build, say which rule and why,
  offer a compliant alternative.
- In doubt → treat as forbidden, tell the developer to ask a ToolDev. Never "probably fine".
- Never disguise, hide, obfuscate or minify a feature. The reviewed source stays readable.
- Never silently pick the risky reading of a borderline request: flag it.
- Comment every compliance-relevant choice in the code.
- Refusal style: one plain sentence (what, which rule, alternative), not buried in bullets.

## §1 Forbidden
1. **Automation** (§1.1): 1 click/keystroke = at most 1 game action. No multi-target sends, no
   action chains, no auto-farm/attack/build loops.
2. **Scheduling** (§1.2): no timer that fires a game action later.
3. **Auto-refresh / polling** (§1.3): never reload the page or call the server in a loop (keep-alive,
   "check for updates", database sync).
4. **Automatic notifications** (§1.4): the tool must not watch game events and alert (sound, desktop,
   email, webhook, Discord). Allowed: a notification the player sets by hand on one specific event
   (on-page by default; an external channel needs ToolDev confirmation), and feedback on the user's
   own action ("Settings saved").
5. **Shortcuts / alternative UI / lobby bypass** (§1.5): no collapsing several pages or clicks into
   one, no UI that replaces how the game is played, no direct login.
   - **§1.5.1 Direct probing** (`sendFleet`, `miniFleet` endpoint) only where the game already allows
     it: galaxy view and spy reports in the inbox. Showing coordinates or custom target lists is fine;
     a probe button on them is not. New targets: coordinate → galaxy view → game's own probe icon.
6. **Premium imitation** (§1.6): no free rebuild of Dark Matter / Officer features (e.g. Commander
   build queue).
7. **Monetization / legal content** (§1.7): never hide, move, resize, fade or swap ads, banners, top
   ad bar, footer, Merchant, Recruit Officers, Shop.
8. **Money** (§1.8): no fees, paywalls, paid subscriptions or injected ads. A donation button or a
   hero.li link is fine.
9. **Private data** (§1.9): nothing (messages, fleets, tokens, activity times) leaves the machine
   without explicit, informed consent; if it does, the tool needs toleration.

## §3 Gray areas (ToolDev approval before publishing)
- Batching repetitive non-tactical actions on the player's own planets (e.g. several shipyard or
  defence orders), never imitating the Commander queue.
- Comfort features that touch the game UI or flow. Anything shortcutting a core loop: no.
- Mark the code: `// GRAY AREA: requires ToolDev approval before publishing — see AGENTS.md §3`
  and repeat the warning in the reply.

## §4 Network discipline
- Background call = a request the tool sends on its own. Reading the DOM of a page the player opened
  is not one. **Every background call creates galaxy-view activity** (star / minutes counter) and can
  show the player as online.
- Allowed only **on page load**, while the player is in game. Never on timers, loops, deferred
  schedules or after load. Recommended: hydrate once at login, then keep state current from the DOM.
- **§4.1 `accountInfo`**: heavy, refreshes the highscore for all planets at once. Never poll it; read
  it once and filter per planet client-side.
- **§4.2 `cp=`** changes the session's active planet: never in a background call.

## §5 Toleration
Needs review before publishing: anything running in the game page (userscript, extension), any
server/database receiving scraped live data, any auto-fill/scrape script. Not needed: standalone
calculators fed by manual input or the official API. In doubt → needs toleration. No extension-store
release before toleration.

## §6 API
- Calls through the community proxy `https://ogapi.faw-kes.de/`; never hardcode or request a private key.
- Public API per universe (`?toJson=1` for JSON): `highscore`, `players`, `alliances`, `universe`,
  `serverData`, `playerData`, `localization`, `universes` `.xml`; servers list
  `https://lobby.ogame.gameforge.com/api/servers`. They update hourly to weekly: cache, don't poll.
- Report/statistics endpoints need the proxy and the report's own API string. Never invent
  endpoints or credentials; ask the developer for missing game details.

## §7 Self-audit before "done"
Report each point: one click = one action · no scheduling · no auto-refresh · no polling, timers or
deferred calls · background calls only on page load · no `accountInfo` polling, no `cp` in background
· no automatic alarms/webhooks · no direct probing outside galaxy/inbox · no alternative UI, shortcuts
or lobby bypass · no premium imitation · monetization untouched · no fees or ads · no data leaves
without consent · API via proxy, cached · readable source with compliance comments · gray areas
flagged · toleration status stated. If a point fails, say so and what to fix or whom to ask.
