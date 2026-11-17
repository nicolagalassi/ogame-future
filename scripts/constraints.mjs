#!/usr/bin/env node
// Checks for CONSTRAINTS.md. Usage: node scripts/constraints.mjs <src|dist|coverage|audit|install-hook>...
// Exit 0 clean (or warnings only), 1 a blocking finding, 2 the check could not run (never read as clean).
// Compliance rules (AGENTS.md) always block; the numbered dimensions only warn until `warnUntil`.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, chmodSync } from 'node:fs';
import { join } from 'node:path';

const top = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
process.chdir(top);
const cfg = JSON.parse(readFileSync('scripts/constraints.json', 'utf8'));
const today = new Date().toISOString().slice(0, 10);
const numericBlocks = today >= cfg.warnUntil;

let blocking = 0;
let warnings = 0;
let broken = false;
const fail = (rule, where, msg) => { blocking++; console.error(`  ✗ [${rule}] ${where}: ${msg}`); };
const warn = (rule, where, msg) => { warnings++; console.error(`  ! [${rule}] ${where}: ${msg}`); };
/** A numbered dimension: a warning until `warnUntil`, then blocking. */
const numeric = (rule, where, msg) => (numericBlocks ? fail : warn)(rule, where, `${msg}${numericBlocks ? '' : ` (avviso fino al ${cfg.warnUntil})`}`);
const cannot = (what) => { broken = true; console.error(`  ? ${what}`); };

const git = (args) => {
  try { return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); } catch { return null; }
};
const mergeBase = () => git(['merge-base', 'origin/main', 'HEAD'])?.trim() || null;

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.ts$/.test(name)) out.push(p);
  }
  return out;
}

/** Lines changed since the merge base with origin/main, by file: new line numbers (untracked files count whole). */
function changedLines() {
  const base = mergeBase();
  if (!base) return null;
  const diff = git(['diff', '--unified=0', base, '--']);
  if (diff === null) return null;
  const map = new Map();
  let file = null;
  for (const line of diff.split('\n')) {
    if (line.startsWith('+++ ')) file = line === '+++ /dev/null' ? null : line.slice(6);
    const m = line.match(/^@@ -\S+ \+(\d+)(?:,(\d+))? @@/);
    if (m && file) {
      const start = Number(m[1]);
      const count = m[2] === undefined ? 1 : Number(m[2]);
      const set = map.get(file) ?? new Set();
      for (let i = 0; i < count; i++) set.add(start + i);
      map.set(file, set);
    }
  }
  for (const f of (git(['ls-files', '--others', '--exclude-standard']) ?? '').split('\n').filter(Boolean)) {
    if (!f.endsWith('.ts')) continue;
    const n = readFileSync(f, 'utf8').split('\n').length;
    map.set(f, new Set(Array.from({ length: n }, (_, i) => i + 1)));
  }
  return map;
}

// --- src: the compliance rules of AGENTS.md that can be read in the source ---
function checkSrc() {
  console.log('constraints src: rete, cp=, notifiche, timer, build');
  const NET = /\bfetch\s*\(|XMLHttpRequest|GM_xmlhttpRequest|GM\.xmlHttpRequest|sendBeacon|new\s+WebSocket|new\s+EventSource|\$\.(ajax|get|post|getJSON)\s*\(/;
  for (const file of walk('src')) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((text, i) => {
      const where = `${file}:${i + 1}`;
      const code = text.replace(/\/\/.*$/, '').replace(/^\s*\*.*$/, '').replace(/\/\*.*?\*\//g, '');
      // Every call to a server goes through the guard; main.ts hands it the browser's fetch, once.
      if (NET.test(code) && file !== 'src/core/guard.ts' && !(file === 'src/main.ts' && /new NetworkGuard\(/.test(code))) {
        fail('rete-fuori-dal-guard', where, 'chiamata di rete fuori da src/core/guard.ts');
      }
      if (/\.request\s*\(/.test(code) && /guard/.test(code) && !file.startsWith(cfg.networkLayer) && file !== 'src/core/guard.ts') {
        fail('rete-fuori-da-data', where, `guard.request solo in ${cfg.networkLayer} (un modulo chiede i dati al livello data)`);
      }
      if (/\.request\s*\(/.test(code) && /cp=/.test(code)) fail('cp-in-background', where, 'cp= in una chiamata di rete cambia il pianeta attivo (AGENTS.md §4.2)');
      if (/\bNotification\b/.test(code) && !cfg.notificationFiles.includes(file)) {
        fail('notifiche', where, 'notifiche solo per i promemoria manuali (AGENTS.md §1.4); un file nuovo va discusso in CONSTRAINTS.md');
      }
      if (/\bsetInterval\s*\(/.test(code) && !cfg.intervalFiles.includes(file)) {
        fail('timer', where, 'setInterval nuovo: nessun timer deve chiamare il server; se serve solo alla pagina, aggiungerlo all\'elenco in CONSTRAINTS.md');
      }
    });
  }
  const build = readFileSync('scripts/build.mjs', 'utf8');
  if (!/minify:\s*false/.test(build) || /minify\w*:\s*true/.test(build)) fail('minificazione', 'scripts/build.mjs', 'la build non deve minificare (AGENTS.md)');
}

// --- dist: what is published ---
function checkDist() {
  console.log('constraints dist: leggibile, credito, versione, dimensione');
  const d = cfg.dist;
  if (!existsSync(d.path)) return cannot(`${d.path} manca: lanciare npm run build`);
  const text = readFileSync(d.path, 'utf8');
  const lines = text.split('\n');
  const longest = Math.max(...lines.map((l) => l.length));
  const avg = text.length / lines.length;
  if (longest > d.maxLineLength || avg > d.maxAvgLineLength) fail('minificazione', d.path, `righe troppo lunghe (max ${longest}, media ${avg.toFixed(0)}): sembra minificato`);
  if (!text.includes(d.credit)) fail('credito-oglight', d.path, `manca il credito "${d.credit}" (licenza MIT di OGLight)`);
  const pkg = JSON.parse(readFileSync('package.json', 'utf8')).version;
  const header = text.match(/@version\s+(\S+)/)?.[1];
  if (header !== pkg) fail('versione', d.path, `@version ${header} diverso da package.json ${pkg}: rilanciare npm run build`);
  const base = mergeBase();
  if (!base) cannot('nessuna base con origin/main per il controllo della versione');
  else {
    const touched = (git(['diff', '--name-only', base, '--', 'src', 'dist']) ?? '').trim();
    const before = git(['show', `${base}:package.json`]);
    if (touched && before) {
      const cmp = (a, b) => { const x = a.split('.').map(Number); const y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; };
      const was = JSON.parse(before).version;
      if (cmp(pkg, was) <= 0) fail('versione', 'package.json', `codice cambiato ma versione ${pkg} non sale da ${was} (Tampermonkey non aggiornerebbe)`);
    }
  }
  const size = Buffer.byteLength(text);
  if (size > d.maxBytes) numeric('dimensione', d.path, `${size} byte oltre il tetto di ${d.maxBytes}`);
  else console.log(`  dimensione ${size} / ${d.maxBytes} byte`);
}

// --- coverage: the changed lines of the engines, from the lcov the test run wrote ---
function checkCoverage() {
  console.log('constraints coverage: righe cambiate in', cfg.coverage.scope);
  if (!existsSync('coverage/lcov.info')) return cannot('coverage/lcov.info manca: lanciare vitest run --coverage');
  const hits = new Map();
  let file = null;
  let total = 0;
  let hit = 0;
  for (const line of readFileSync('coverage/lcov.info', 'utf8').split('\n')) {
    if (line.startsWith('SF:')) { file = line.slice(3).trim(); hits.set(file, new Map()); }
    else if (line.startsWith('DA:') && file) {
      const [n, c] = line.slice(3).split(',').map(Number);
      hits.get(file).set(n, c);
      if (file.startsWith(cfg.coverage.scope)) { total++; if (c > 0) hit++; }
    }
  }
  const project = total ? (100 * hit) / total : 0;
  const floor = cfg.coverage.projectLinesToday - cfg.coverage.tolerance;
  if (project < floor) warn('copertura-progetto', cfg.coverage.scope, `${project.toFixed(2)}% sotto il ${cfg.coverage.projectLinesToday}% registrato`);
  else console.log(`  progetto ${project.toFixed(2)}% (registrato ${cfg.coverage.projectLinesToday}%)`);
  const changed = changedLines();
  if (!changed) return cannot('nessuna base con origin/main per le righe cambiate');
  let ct = 0;
  let ch = 0;
  const missed = [];
  for (const [f, set] of changed) {
    if (!f.startsWith(cfg.coverage.scope)) continue;
    const da = hits.get(f);
    if (!da) { missed.push(`${f} (nessun test lo carica)`); ct += set.size; continue; }
    for (const n of set) {
      if (!da.has(n)) continue;
      ct++;
      if (da.get(n) > 0) ch++; else missed.push(`${f}:${n}`);
    }
  }
  if (!ct) return console.log('  nessuna riga eseguibile cambiata');
  const pct = (100 * ch) / ct;
  if (pct < cfg.coverage.changedLinesMin) numeric('copertura', cfg.coverage.scope, `righe cambiate coperte ${pct.toFixed(0)}% (minimo ${cfg.coverage.changedLinesMin}%); scoperte: ${missed.slice(0, 8).join(', ')}`);
  else console.log(`  righe cambiate coperte ${pct.toFixed(0)}% (${ch}/${ct})`);
}

// --- audit: the dependencies, judged by the npm advisory database (an outside opinion) ---
function checkAudit() {
  console.log(`constraints audit: dipendenze, niente da ${cfg.audit.level} in su`);
  let out;
  try { out = execFileSync('npm', ['audit', '--json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); }
  catch (e) { out = e.stdout; }
  let vulns;
  try { vulns = JSON.parse(out).vulnerabilities; } catch { return cannot('npm audit non ha risposto (offline?)'); }
  if (!vulns) return cannot('npm audit senza elenco delle vulnerabilità');
  // Exceptions of CONSTRAINTS.md: an advisory, until a date. A package is covered when everything it is
  // vulnerable through leads back to covered advisories only.
  const ignored = new Map((cfg.audit.exceptions ?? []).filter((e) => today <= e.until).map((e) => [e.advisory, e.id]));
  for (const e of cfg.audit.exceptions ?? []) if (today > e.until) warn('eccezione-scaduta', e.id, `${e.advisory} scaduta il ${e.until}: rivedere CONSTRAINTS.md`);
  const memo = new Map();
  const covered = (name, seen = new Set()) => {
    if (memo.has(name)) return memo.get(name);
    if (seen.has(name) || !vulns[name]) return true;
    seen.add(name);
    const ok = vulns[name].via.every((x) => (typeof x === 'string' ? covered(x, seen) : [...ignored.keys()].some((a) => x.url?.endsWith(a))));
    memo.set(name, ok);
    return ok;
  };
  const severe = Object.entries(vulns).filter(([, v]) => v.severity === 'high' || v.severity === 'critical');
  const open = severe.filter(([name]) => !covered(name));
  const excused = severe.length - open.length;
  if (open.length) numeric('dipendenze', 'package-lock.json', `${open.length} pacchetti high o critical: ${open.map(([n, v]) => `${n} (${v.severity})`).join(', ')} (npm audit per i dettagli)`);
  else console.log(`  nessuna vulnerabilità alta o critica${excused ? ` fuori dalle eccezioni (${excused} coperte da ${[...new Set(ignored.values())].join(', ')})` : ''}`);
}

function installHook() {
  const hook = '.git/hooks/pre-push';
  writeFileSync(hook, '#!/bin/sh\n# CONSTRAINTS.md: nothing reaches GitHub without the checks.\nnpm run check:push\n');
  chmodSync(hook, 0o755);
  console.log(`installato ${hook}`);
}

const steps = { src: checkSrc, dist: checkDist, coverage: checkCoverage, audit: checkAudit, 'install-hook': installHook };
const asked = process.argv.slice(2);
if (!asked.length || asked.some((a) => !steps[a])) {
  console.error(`uso: node scripts/constraints.mjs <${Object.keys(steps).join('|')}>...`);
  process.exit(2);
}
for (const a of asked) steps[a]();
if (broken) { console.error('constraints: un controllo non ha potuto girare'); process.exit(2); }
if (blocking) { console.error(`constraints: ${blocking} violazione/i bloccante/i. Correggere il codice, non CONSTRAINTS.md.`); process.exit(1); }
console.log(`constraints: ok${warnings ? ` (${warnings} avviso/i)` : ''}`);
