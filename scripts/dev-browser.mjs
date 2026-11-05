#!/usr/bin/env node
// DEV-ONLY test harness for Future: a dedicated Chrome that runs dist/future.user.js fresh from disk,
// without Tampermonkey, and that a developer or a coding agent can drive from the command line.
// Ported from PrOGect's dev-browser.mjs.
//
// ┌───────────────────────────────────────────────────────────────────────────────────────────┐
// │ DEV ONLY. Nothing here ships: the published tool is dist/future.user.js installed the      │
// │ normal way. This file talks to a local Chrome over the DevTools protocol (CDP).            │
// │ COMPLIANCE (AGENTS.md): the harness itself sends nothing to the game server, never reloads │
// │ the game page on its own (no auto-refresh on file save, no timers), and the login always   │
// │ goes through the lobby by hand. Every game page load comes from an explicit person/agent   │
// │ action (a click, or `npm run dev:reload`). The only outbound request it makes is a         │
// │ GM_xmlhttpRequest the script itself issues, exactly as Tampermonkey would.                 │
// └───────────────────────────────────────────────────────────────────────────────────────────┘
//
// Usage (the npm scripts in package.json wrap these)
//   node scripts/dev-browser.mjs [start]   launch (or attach to) the dev Chrome and keep injecting;
//                                          log in through the lobby in that window once.
//   node scripts/dev-browser.mjs tabs      list the open tabs (game tabs are marked with *)
//   node scripts/dev-browser.mjs eval <js> evaluate <js> in the game tab's page world, print the JSON
//                                          result (promises are awaited). Future exposes no global:
//                                          its GM storage is in localStorage under '__futdev_gm:' keys.
//   node scripts/dev-browser.mjs reload    reload the game tab once and wait for it to load
//   node scripts/dev-browser.mjs goto <url> navigate the game tab to <url> (relative to the game origin ok)
//   node scripts/dev-browser.mjs shot [file] PNG screenshot of the game tab (default /tmp/future-shot.png)
//   Options: --tab <substring> picks the tab by URL instead of the first game tab.
//   Env: FUTDEV_CDP_PORT (9223), FUTDEV_PROFILE (~/.cache/future-dev-chrome), FUTDEV_CHROME (binary),
//        FUTDEV_SCRIPT (another userscript to run instead of dist/future.user.js).
//   Port and profile differ from PrOGect's harness (9222), so both dev browsers can run side by side.
//
// How the script runs (differences from Tampermonkey are deliberate and listed here)
//   - Two scripts are registered with Page.addScriptToEvaluateOnNewDocument on every tab: a GM_* shim
//     and the userscript wrapped in a function whose parameters are exactly the @grant-ed APIs, so an
//     API used without its @grant throws just like it would under Tampermonkey. Both run at
//     document-start, before any page script, only on URLs matching the script's @match lines.
//   - The code runs in the page's main world (unsafeWindow === window).
//   - GM_getValue/GM_setValue persist in the game origin's localStorage under '__futdev_gm:' keys: they
//     must be synchronous and survive the beforeunload save, and an async bridge to this process would
//     race with the next page load. Consequence: values are per universe origin, not global, and
//     separate from Tampermonkey's.
//   - GM_getTab/GM_saveTab use sessionStorage (per tab, survives navigation in that tab).
//   - GM_xmlhttpRequest is proxied through this process (no CORS), with the browser's cookies for the
//     target URL unless `anonymous` is set.
//   - A rebuild of dist/future.user.js (`npm run dev:build` watches src/) re-registers the code for the
//     NEXT page load; the open page is not touched.
//   - Syntax errors are caught here before injection: the tab then logs the error instead of running.
//   - console.* from the script, all errors/exceptions, and devDump(label, value) go to devlog.jsonl
//     (repo root, git-ignored: it holds live session data) and to this process's stdout.

import { spawn } from 'node:child_process';
import { appendFile, readFile, stat, writeFile, mkdir } from 'node:fs/promises';
import { existsSync, watch } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT_PATH = process.env.FUTDEV_SCRIPT ? resolve(process.env.FUTDEV_SCRIPT) : join(ROOT, 'dist', 'future.user.js');
const SCRIPT_NAME = basename(SCRIPT_PATH);
const LOG_PATH = join(ROOT, 'devlog.jsonl');
const LOG_MAX = 512 * 1024;
const CDP_PORT = Number(process.env.FUTDEV_CDP_PORT) || 9223;
const CDP_HTTP = `http://127.0.0.1:${CDP_PORT}`;
const PROFILE = process.env.FUTDEV_PROFILE || join(process.env.XDG_CACHE_HOME || join(homedir(), '.cache'), 'future-dev-chrome');
const START_URL = process.env.FUTDEV_START_URL || 'https://lobby-pioneers.ogame.gameforge.com/en_GB/hub'; // Pioneers = test servers
const CHROME_CANDIDATES = ['/usr/bin/google-chrome-stable', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];

// Names shared by the shim and the wrapped script; the random suffix keeps them per harness run.
const RUN_ID = Math.random().toString(36).slice(2, 10);
const BINDING = `__futdevBind_${RUN_ID}`;
const API_KEY = `__futdevApi_${RUN_ID}`;
const RESOLVE_KEY = `__futdevResolve_${RUN_ID}`;

// ─── userscript metadata ─────────────────────────────────────────────────────────────────────────

function parseMeta(source) {
  const block = source.match(/^\/\/ ==UserScript==([\s\S]*?)^\/\/ ==\/UserScript==/m);
  if (!block) throw new Error(`${SCRIPT_NAME}: no ==UserScript== header`);
  const meta = {};
  for (const line of block[1].split('\n')) {
    const m = line.match(/^\/\/ @(\S+)\s+(.*?)\s*$/);
    if (m) (meta[m[1]] ||= []).push(m[2]);
  }
  return meta;
}

// Tampermonkey @match glob -> regex source ('*.' in the host also matches the bare domain).
function matchToRegex(pattern) {
  const m = pattern.match(/^(\*|https?):\/\/([^/]*)(\/.*)$/);
  if (!m) throw new Error(`unsupported @match: ${pattern}`);
  const esc = (s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  const scheme = m[1] === '*' ? 'https?' : m[1];
  const host = m[2] === '*' ? '[^/]+' : m[2].startsWith('*.') ? `([^/]+\\.)?${esc(m[2].slice(2))}` : esc(m[2]);
  const path = m[3].split('*').map(esc).join('.*');
  return `^${scheme}://${host}${path}$`;
}

// ─── page-side shim (serialized with toString, runs in the page at document-start) ───────────────

function pageShim(cfg) {
  if (!cfg.matches.some((src) => new RegExp(src).test(location.href))) return;
  const bind = window[cfg.binding];
  try { delete window[cfg.binding]; } catch (_) { /* keep going */ }
  if (typeof bind !== 'function') { console.error('[futdev] CDP binding missing, script not started'); return; }

  const send = (msg) => { try { bind(JSON.stringify(msg)); } catch (_) { /* never break the page */ } };
  const safe = (v) => { if (typeof v === 'string') return v; try { return JSON.stringify(v); } catch (_) { return String(v); } };
  const rethrow = (err) => setTimeout(() => { throw err; }); // surfaces as a normal uncaught exception
  const local = window.localStorage;
  const session = window.sessionStorage;
  const PFX = '__futdev_gm:';
  const TAB_KEY = '__futdev_tab';

  const appendWhenReady = (el) => {
    const parent = document.head || document.documentElement;
    if (parent) { parent.appendChild(el); return; }
    new MutationObserver((_, obs) => {
      const p = document.head || document.documentElement;
      if (p) { obs.disconnect(); p.appendChild(el); }
    }).observe(document, { childList: true, subtree: true });
  };

  const pending = new Map();
  let seq = 0;
  Object.defineProperty(window, cfg.resolveKey, {
    configurable: false, enumerable: false,
    value(id, res) {
      const d = pending.get(id);
      if (!d) return;
      pending.delete(id);
      const call = (name, arg) => { if (typeof d[name] === 'function') { try { d[name](arg); } catch (err) { rethrow(err); } } };
      if (res.error) {
        const r = { readyState: 4, status: 0, statusText: '', responseText: '', responseHeaders: '', finalUrl: d.url, error: res.error };
        call(res.timeout ? 'ontimeout' : 'onerror', r);
        call('onloadend', r);
        return;
      }
      let response = res.responseText;
      if (d.responseType === 'json') { try { response = JSON.parse(res.responseText); } catch (_) { response = null; } }
      else if (d.responseType === 'document') response = new DOMParser().parseFromString(res.responseText, 'text/html');
      const r = { readyState: 4, status: res.status, statusText: res.statusText, responseHeaders: res.responseHeaders, responseText: res.responseText, response, finalUrl: res.finalUrl, context: d.context };
      call('onreadystatechange', r);
      call('onload', r);
      call('onloadend', r);
    },
  });

  const api = {
    unsafeWindow: window,
    GM_info: cfg.info,
    GM_addStyle(css) {
      const el = document.createElement('style');
      el.textContent = String(css);
      appendWhenReady(el);
      return el;
    },
    GM_getValue(key, def) {
      const raw = local.getItem(PFX + key);
      if (raw === null) return def;
      try { return JSON.parse(raw); } catch (_) { return def; }
    },
    GM_setValue(key, value) {
      try { local.setItem(PFX + key, JSON.stringify(value)); }
      catch (err) { console.error(`[futdev] GM_setValue('${key}') failed (${(JSON.stringify(value) || '').length} chars): ${err.message}`); }
    },
    GM_deleteValue(key) { local.removeItem(PFX + key); },
    GM_listValues() {
      const keys = [];
      for (let i = 0; i < local.length; i++) { const k = local.key(i); if (k.startsWith(PFX)) keys.push(k.slice(PFX.length)); }
      return keys;
    },
    GM_getTab(cb) {
      let tab = {};
      try { tab = JSON.parse(session.getItem(TAB_KEY) || '{}'); } catch (_) { /* fresh tab object */ }
      setTimeout(() => cb(tab)); // Tampermonkey answers asynchronously too
    },
    GM_saveTab(tab) {
      try { session.setItem(TAB_KEY, JSON.stringify(tab || {})); }
      catch (err) { console.error('[futdev] GM_saveTab failed: ' + err.message); }
    },
    GM_notification(details, ondone) {
      const d = typeof details === 'string' ? { text: details, title: ondone } : (details || {});
      console.info('[futdev] GM_notification', d.title || '', d.text || '');
      send({ op: 'log', kind: 'notification', label: String(d.title || ''), data: String(d.text || '') });
    },
    GM_xmlhttpRequest(d) {
      const id = ++seq;
      pending.set(id, d);
      const data = d.data == null ? null : typeof d.data === 'string' ? d.data : safe(d.data);
      send({ op: 'xhr', id, req: { method: d.method || 'GET', url: new URL(d.url, location.href).href, headers: d.headers || {}, data, timeout: d.timeout || 0, anonymous: !!d.anonymous } });
      return { abort() { if (pending.delete(id) && typeof d.onabort === 'function') d.onabort(); } };
    },
  };

  window.devDump = (label, val) => { send({ op: 'log', kind: 'dump', label: String(label), data: safe(val) }); return '[sent to dev log]'; };

  const values = cfg.names.map((name) => api[name] || (() => { throw new Error(`[futdev] ${name} is granted but not shimmed by dev-browser.mjs`); }));
  Object.defineProperty(window, cfg.apiKey, { configurable: true, enumerable: false, value: values });
  send({ op: 'log', kind: 'boot', label: 'run', data: location.pathname + location.search });
}

// ─── bundle ──────────────────────────────────────────────────────────────────────────────────────

let current = null; // { ver, shim, main, error }

async function buildScripts() {
  const source = await readFile(SCRIPT_PATH, 'utf8');
  const { mtimeMs } = await stat(SCRIPT_PATH);
  const meta = parseMeta(source);
  const ver = `${(meta.version || ['?'])[0]}+${mtimeMs.toFixed(0)}`;
  const grants = (meta.grant || []).filter((g) => g !== 'none');
  // parameter list of the wrapper = what Tampermonkey puts in scope for these grants
  const names = [...new Set(['unsafeWindow', 'GM_info', ...grants])];
  const cfg = {
    matches: (meta.match || []).map(matchToRegex),
    binding: BINDING, apiKey: API_KEY, resolveKey: RESOLVE_KEY, names,
    info: {
      scriptHandler: 'Future dev-browser', version: 'dev',
      script: { name: meta.name?.[0], namespace: meta.namespace?.[0], version: meta.version?.[0], description: meta.description?.[0], grant: grants, matches: meta.match || [] },
    },
  };
  const shim = `(${pageShim.toString()})(${JSON.stringify(cfg)});\n//# sourceURL=futdev-shim.js`;
  // The prologue sits on line 1 with the script's first line, so line numbers in stack traces are
  // the real line numbers of the built userscript.
  const main = `(function(){var __pg=globalThis[${JSON.stringify(API_KEY)}];if(!__pg)return;delete globalThis[${JSON.stringify(API_KEY)}];(function(${names.join(',')}){`
    + source + `\n}).apply(window,__pg);})();\n//# sourceURL=${SCRIPT_NAME}`;
  try {
    new vm.Script(main, { filename: SCRIPT_NAME });
    return { ver, shim, main, error: null };
  } catch (err) {
    const where = err.stack?.split('\n')[1] || '';
    const msg = `${SCRIPT_NAME} has a syntax error, not injected: ${err.message} ${where}`.trim();
    return { ver, shim, main: `console.error(${JSON.stringify('[futdev] ' + msg)});`, error: msg };
  }
}

// ─── CDP client (Node's built-in WebSocket, no dependencies) ────────────────────────────────────

class CDP {
  static async connect(wsUrl) {
    const ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', () => reject(new Error(`cannot open CDP websocket ${wsUrl}`)), { once: true });
    });
    return new CDP(ws);
  }

  constructor(ws) {
    this.ws = ws;
    this.seq = 0;
    this.pending = new Map();
    this.listeners = new Set();
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id !== undefined) {
        const p = this.pending.get(msg.id);
        if (!p) return;
        this.pending.delete(msg.id);
        if (msg.error) p.reject(new Error(`${p.method}: ${msg.error.message}`));
        else p.resolve(msg.result);
        return;
      }
      for (const fn of this.listeners) fn(msg);
    });
    ws.addEventListener('close', () => {
      for (const p of this.pending.values()) p.reject(new Error('CDP connection closed'));
      this.pending.clear();
      this.onclose?.();
    });
  }

  send(method, params = {}, sessionId) {
    const id = ++this.seq;
    this.ws.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject, method }));
  }

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  waitFor(predicate, timeoutMs) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { off(); reject(new Error(`timed out after ${timeoutMs} ms`)); }, timeoutMs);
      const off = this.on((msg) => { if (predicate(msg)) { clearTimeout(timer); off(); resolve(msg); } });
    });
  }

  close() { this.ws.close(); }
}

async function browserWsUrl() {
  const res = await fetch(`${CDP_HTTP}/json/version`, { signal: AbortSignal.timeout(1500) });
  return (await res.json()).webSocketDebuggerUrl;
}

async function ensureChrome() {
  try { return await browserWsUrl(); } catch { /* not running yet */ }
  const chrome = process.env.FUTDEV_CHROME || CHROME_CANDIDATES.find((p) => existsSync(p));
  if (!chrome) throw new Error('no Chrome/Chromium found, set FUTDEV_CHROME');
  await mkdir(PROFILE, { recursive: true });
  // Detached: the dev Chrome (and the logged-in game session) outlives restarts of this harness.
  spawn(chrome, [
    `--user-data-dir=${PROFILE}`,
    `--remote-debugging-port=${CDP_PORT}`,
    '--no-first-run', '--no-default-browser-check',
    START_URL,
  ], { detached: true, stdio: 'ignore' }).unref();
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 250));
    try { return await browserWsUrl(); } catch { /* still starting */ }
  }
  throw new Error(`Chrome did not open the DevTools port ${CDP_PORT}`);
}

// ─── dev log ─────────────────────────────────────────────────────────────────────────────────────

async function devlog(kind, label, data, extra = {}) {
  const line = JSON.stringify({ t: Date.now(), ver: current?.ver, kind, label, data, ...extra });
  let size = 0;
  try { size = (await stat(LOG_PATH)).size; } catch { /* no file yet */ }
  if (size > LOG_MAX) await writeFile(LOG_PATH, '');
  await appendFile(LOG_PATH, line.replace(/\r?\n/g, ' ') + '\n');
}

function shortUrl(url) {
  try { const u = new URL(url); return u.host.split('.')[0] + u.pathname.replace('/game/index.php', '') + (u.searchParams.get('component') ? `#${u.searchParams.get('component')}` : ''); }
  catch { return url; }
}

function fmtArg(a) {
  if ('value' in a) return typeof a.value === 'string' ? a.value : JSON.stringify(a.value);
  if (a.unserializableValue) return a.unserializableValue;
  if (a.preview?.properties && a.subtype !== 'error') {
    const inner = a.preview.properties.map((p) => `${p.name}: ${p.value}`).join(', ') + (a.preview.overflow ? ', …' : '');
    return a.subtype === 'array' ? `[${inner}]` : `${a.className || ''} {${inner}}`;
  }
  return a.description ?? a.type;
}

const fromScript = (stackTrace, url) => url === SCRIPT_NAME || !!stackTrace?.callFrames?.some((f) => f.url === SCRIPT_NAME);

// ─── start: inject into every tab ────────────────────────────────────────────────────────────────

async function start() {
  if (!existsSync(SCRIPT_PATH)) throw new Error(`${SCRIPT_PATH} not found: run npm run build first`);
  const wsUrl = await ensureChrome();
  const cdp = await CDP.connect(wsUrl);
  const { userAgent } = await cdp.send('Browser.getVersion');
  current = await buildScripts();
  if (current.error) console.error(`[src] ${current.error}`);

  const sessions = new Map(); // sessionId -> { targetId, url, ids: [] }
  const attachedTargets = new Set();
  const registered = new Map(); // targetId -> promise settled once that tab's scripts are registered

  const register = async (sid, sess) => {
    for (const identifier of sess.ids) await cdp.send('Page.removeScriptToEvaluateOnNewDocument', { identifier }, sid).catch(() => {});
    sess.ids = [];
    for (const source of [current.shim, current.main]) {
      const { identifier } = await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source }, sid);
      sess.ids.push(identifier);
    }
  };

  const onAttached = async ({ sessionId: sid, targetInfo, waitingForDebugger }) => {
    if (targetInfo.type !== 'page' || attachedTargets.has(targetInfo.targetId)) {
      if (waitingForDebugger) await cdp.send('Runtime.runIfWaitingForDebugger', {}, sid).catch(() => {});
      if (targetInfo.type !== 'page') await cdp.send('Target.detachFromTarget', { sessionId: sid }).catch(() => {});
      return;
    }
    attachedTargets.add(targetInfo.targetId);
    const sess = { targetId: targetInfo.targetId, url: targetInfo.url, ids: [] };
    sessions.set(sid, sess);
    let done;
    registered.set(targetInfo.targetId, new Promise((r) => { done = r; }));
    try {
      await cdp.send('Page.enable', {}, sid);
      await cdp.send('Runtime.addBinding', { name: BINDING }, sid);
      await cdp.send('Runtime.enable', {}, sid);
      await register(sid, sess);
    } catch (err) {
      console.error(`[tab] setup failed for ${targetInfo.url}: ${err.message}`);
    }
    done();
    if (waitingForDebugger) await cdp.send('Runtime.runIfWaitingForDebugger', {}, sid).catch(() => {});
    const already = current.shim && /\/game\//.test(targetInfo.url) && !waitingForDebugger;
    console.log(`[tab] attached ${shortUrl(targetInfo.url) || '(blank)'}${already ? '  (already open: reload it once to run the script)' : ''}`);
  };

  // A tab opened straight onto a game URL starts loading before its attach/registration finishes
  // (the waitForDebuggerOnStart pause does not hold the navigation). Holding the matching document
  // request at the browser level until that tab is registered makes even its first load document-start.
  // Pattern = the script's own @match lines, so no other site is touched.
  const onRequestPaused = async ({ requestId, frameId }) => {
    await registered.get(frameId);
    await cdp.send('Fetch.continueRequest', { requestId }).catch(() => {});
  };

  const onXhr = async (sid, contextId, id, req) => {
    let res;
    try {
      const headers = { ...req.headers };
      const has = (h) => Object.keys(headers).some((k) => k.toLowerCase() === h);
      if (!has('user-agent')) headers['User-Agent'] = userAgent;
      if (!req.anonymous && !has('cookie')) {
        const { cookies } = await cdp.send('Network.getCookies', { urls: [req.url] }, sid);
        if (cookies.length) headers.Cookie = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
      }
      const method = req.method.toUpperCase();
      const r = await fetch(req.url, {
        method, headers, redirect: 'follow',
        body: method === 'GET' || method === 'HEAD' ? undefined : req.data ?? undefined,
        signal: AbortSignal.timeout(req.timeout || 60000),
      });
      res = { status: r.status, statusText: r.statusText, responseText: await r.text(), finalUrl: r.url, responseHeaders: [...r.headers].map(([k, v]) => `${k}: ${v}`).join('\r\n') };
      console.log(`[xhr] ${method} ${req.url} -> ${r.status}`);
    } catch (err) {
      res = { error: String(err?.message || err), timeout: err?.name === 'TimeoutError' };
      console.error(`[xhr] ${req.method} ${req.url} failed: ${res.error}`);
    }
    await cdp.send('Runtime.evaluate', { expression: `globalThis[${JSON.stringify(RESOLVE_KEY)}](${id}, ${JSON.stringify(res)})`, contextId }, sid).catch(() => {});
  };

  const onSessionEvent = (sid, sess, { method, params }) => {
    const url = shortUrl(sess.url);
    if (method === 'Page.frameNavigated' && !params.frame.parentId) sess.url = params.frame.url;
    else if (method === 'Runtime.bindingCalled' && params.name === BINDING) {
      let msg;
      try { msg = JSON.parse(params.payload); } catch { return; }
      if (msg.op === 'xhr') onXhr(sid, params.executionContextId, msg.id, msg.req);
      else if (msg.op === 'log') {
        devlog(msg.kind, msg.label, msg.data, { url });
        if (msg.kind === 'boot') console.log(`[run] ${current.ver} on ${url}`);
        else console.log(`[${msg.kind}] ${msg.label} ${String(msg.data).slice(0, 300)}`);
      }
    } else if (method === 'Runtime.consoleAPICalled') {
      const script = fromScript(params.stackTrace);
      const isError = params.type === 'error' || params.type === 'assert';
      if (!script && !isError) return; // the game's own chatter stays out of the log
      const text = params.args.map(fmtArg).join(' ');
      const frame = params.stackTrace?.callFrames?.[0];
      const at = frame ? `${frame.url}:${frame.lineNumber + 1}` : '';
      devlog(`console.${params.type}`, at, text, { src: script ? 'script' : 'page', url });
      if (script || isError) console.log(`[console.${params.type}] ${script ? '' : '(page) '}${text.slice(0, 300)} ${at}`);
    } else if (method === 'Runtime.exceptionThrown') {
      const d = params.exceptionDetails;
      const script = fromScript(d.stackTrace, d.url);
      const text = d.exception?.description || d.text;
      const at = `${d.url || d.stackTrace?.callFrames?.[0]?.url || '?'}:${(d.lineNumber ?? 0) + 1}`;
      devlog('error', at, text, { src: script ? 'script' : 'page', url });
      console.error(`[exception] ${script ? '' : '(page) '}${text.split('\n').slice(0, 4).join(' | ')} @${at}`);
    }
  };

  cdp.on((msg) => {
    if (msg.method === 'Target.attachedToTarget') onAttached(msg.params);
    else if (msg.method === 'Fetch.requestPaused' && !msg.sessionId) onRequestPaused(msg.params);
    else if (msg.method === 'Target.detachedFromTarget') {
      const sess = sessions.get(msg.params.sessionId);
      if (sess) { attachedTargets.delete(sess.targetId); registered.delete(sess.targetId); sessions.delete(msg.params.sessionId); }
    } else if (msg.sessionId && sessions.has(msg.sessionId)) onSessionEvent(msg.sessionId, sessions.get(msg.sessionId), msg);
  });
  cdp.onclose = () => { console.log('Chrome closed the DevTools connection, exiting.'); process.exit(0); };

  await cdp.send('Target.setDiscoverTargets', { discover: true });
  const matches = parseMeta(await readFile(SCRIPT_PATH, 'utf8')).match || [];
  await cdp.send('Fetch.enable', { patterns: matches.map((urlPattern) => ({ urlPattern, resourceType: 'Document', requestStage: 'Request' })) });
  await cdp.send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true });
  // tabs that were already open before this harness started
  const { targetInfos } = await cdp.send('Target.getTargets');
  for (const t of targetInfos) {
    if (t.type === 'page' && !attachedTargets.has(t.targetId)) await cdp.send('Target.attachToTarget', { targetId: t.targetId, flatten: true }).catch(() => {});
  }

  let debounce = null;
  watch(dirname(SCRIPT_PATH), (_, file) => {
    if (file !== SCRIPT_NAME) return;
    clearTimeout(debounce);
    debounce = setTimeout(async () => {
      try {
        const next = await buildScripts();
        if (next.ver === current?.ver) return;
        current = next;
        for (const [sid, sess] of sessions) await register(sid, sess).catch(() => {});
        if (current.error) console.error(`[src] ${current.error}`);
        else console.log(`[src] ${current.ver} registered, it runs on the next game page load`);
        devlog('boot', 'source', current.error || 'registered');
      } catch (err) {
        console.error(`[src] reload failed: ${err.message}`);
      }
    }, 200);
  });

  console.log(`Future dev browser: CDP ${CDP_HTTP}, profile ${PROFILE}`);
  console.log(`Script ${current.ver}; log ${LOG_PATH}`);
  console.log('Log in through the lobby in the dev Chrome window; game tabs get the script on every load.');
  process.on('SIGINT', () => { console.log('harness stopped; the dev Chrome stays open'); process.exit(0); });
}

// ─── client commands (one-shot, used by a developer or an agent) ────────────────────────────────

async function withGameTab(tabFilter, fn) {
  let wsUrl;
  try { wsUrl = await browserWsUrl(); } catch { throw new Error(`dev Chrome not running on ${CDP_HTTP}; start it with: npm run dev`); }
  const meta = parseMeta(await readFile(SCRIPT_PATH, 'utf8'));
  const res = (meta.match || []).map((p) => new RegExp(matchToRegex(p)));
  const cdp = await CDP.connect(wsUrl);
  try {
    const { targetInfos } = await cdp.send('Target.getTargets');
    const pages = targetInfos.filter((t) => t.type === 'page');
    const target = tabFilter ? pages.find((t) => t.url.includes(tabFilter)) : pages.find((t) => res.some((re) => re.test(t.url)));
    if (!target) throw new Error(tabFilter ? `no tab with URL containing "${tabFilter}"` : 'no game tab open (log in through the lobby first)');
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
    return await fn(cdp, sessionId, target);
  } finally {
    cdp.close();
  }
}

async function waitForLoad(cdp, sid, trigger) {
  await cdp.send('Page.enable', {}, sid);
  const loaded = cdp.waitFor((m) => m.sessionId === sid && m.method === 'Page.loadEventFired', 45000);
  await trigger();
  await loaded;
  const { result } = await cdp.send('Runtime.evaluate', { expression: 'location.href', returnByValue: true }, sid);
  return result.value;
}

async function client(cmd, args, tabFilter) {
  if (cmd === 'tabs') {
    const wsUrl = await browserWsUrl().catch(() => { throw new Error(`dev Chrome not running on ${CDP_HTTP}`); });
    const cdp = await CDP.connect(wsUrl);
    const meta = parseMeta(await readFile(SCRIPT_PATH, 'utf8'));
    const res = (meta.match || []).map((p) => new RegExp(matchToRegex(p)));
    const { targetInfos } = await cdp.send('Target.getTargets');
    for (const t of targetInfos.filter((t) => t.type === 'page')) console.log(`${res.some((re) => re.test(t.url)) ? '*' : ' '} ${t.url}`);
    cdp.close();
    return;
  }
  await withGameTab(tabFilter, async (cdp, sid, target) => {
    if (cmd === 'eval') {
      const expression = args.join(' ');
      if (!expression) throw new Error('usage: node scripts/dev-browser.mjs eval <js>');
      const { result, exceptionDetails } = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sid);
      if (exceptionDetails) { console.error(exceptionDetails.exception?.description || exceptionDetails.text); process.exitCode = 1; return; }
      console.log(result.type === 'undefined' ? 'undefined' : JSON.stringify(result.value ?? result.description ?? null, null, 2));
    } else if (cmd === 'reload') {
      console.log(await waitForLoad(cdp, sid, () => cdp.send('Page.reload', {}, sid)));
    } else if (cmd === 'goto') {
      if (!args[0]) throw new Error('usage: node scripts/dev-browser.mjs goto <url>');
      const url = new URL(args[0], target.url).href;
      console.log(await waitForLoad(cdp, sid, () => cdp.send('Page.navigate', { url }, sid)));
    } else if (cmd === 'shot') {
      const out = args[0] || '/tmp/future-shot.png';
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' }, sid);
      await writeFile(out, Buffer.from(data, 'base64'));
      console.log(out);
    } else {
      throw new Error(`unknown command "${cmd}" (start | tabs | eval | reload | goto | shot)`);
    }
  });
}

// ─── main ────────────────────────────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
let tabFilter = null;
const tabIdx = argv.indexOf('--tab');
if (tabIdx >= 0) { tabFilter = argv[tabIdx + 1]; argv.splice(tabIdx, 2); }
const [cmd = 'start', ...rest] = argv;

try {
  if (cmd === 'start') await start();
  else await client(cmd, rest, tabFilter);
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
