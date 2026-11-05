# Future — istruzioni per gli agenti

- Leggi [AGENTS.md](AGENTS.md) prima di ogni feature: sono vincoli, non preferenze.
- Regole extra ricavate da OGLight: [docs/OGLIGHT-RULES.md](docs/OGLIGHT-RULES.md). API: [docs/API-NOTES.md](docs/API-NOTES.md).
- Ogni chiamata di rete passa da `src/core/guard.ts`. Mai `fetch` diretto altrove.
- Il codice pubblicato non si minifica (`scripts/build.mjs`).
- Prima di ogni push: `npm run check` (typecheck, test, build).

---

## Session Start Protocol ⚡

**MANDATORY** at start of each session:

```bash
# Load essential docs (~800 tokens - 2 min read)
✓ .claude/COMMON_MISTAKES.md      # ⚠️ CRITICAL - Read FIRST
✓ .claude/QUICK_START.md          # Essential commands
✓ .claude/ARCHITECTURE_MAP.md     # File locations
```

**At task completion:**
- Create completion doc in `.claude/completions/YYYY-MM-DD-task-name.md`
- Move session file to `.claude/sessions/archive/` (if created)

**⚠️ NEVER auto-load:**
- Files in `.claude/completions/` (0 token cost)
- Files in `.claude/sessions/` (0 token cost)
- Files in `docs/archive/` (0 token cost)

---

**Last Updated**: 2026-11-05
**Optimized with**: [Claude Token Optimizer](https://github.com/nadimtuhin/claude-token-optimizer)
