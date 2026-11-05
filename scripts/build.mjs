// Builds dist/future.user.js: one readable (NOT minified) userscript.
// COMPLIANCE: AGENTS.md §0 — the reviewed source must stay human-readable.
// --watch rebuilds on every change in src/ (used by `npm run dev`; the dev browser picks it up on the next page load).
import { context } from 'esbuild';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

const header = `// ==UserScript==
// @name         Future
// @namespace    https://github.com/nicolagalassi/ogame-future
// @version      ${pkg.version}
// @description  ${pkg.description}
// @author       Nicola Galassi
// @license      MIT
// @match        https://*.ogame.gameforge.com/game/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        unsafeWindow
// @run-at       document-start
// ==/UserScript==
// Portions derived from OGLight, Copyright (c) 2019 Oz, MIT License.
`;

const ctx = await context({
  entryPoints: ['src/main.ts'],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  minify: false,
  legalComments: 'inline',
  banner: { js: header },
  outfile: 'dist/future.user.js',
  logLevel: 'info',
});

if (process.argv.includes('--watch')) {
  await ctx.watch();
} else {
  await ctx.rebuild();
  await ctx.dispose();
}
