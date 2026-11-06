// Builds dist/future.user.js: one readable (NOT minified) userscript.
// COMPLIANCE: AGENTS.md §0 — the reviewed source must stay human-readable.
// Version: bump package.json "version" on every push to main, or Tampermonkey will not update.
// --watch rebuilds on every change in src/ (used by `npm run dev`; the dev browser picks it up on the next page load).
import { context } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';

// Read on every build: the watcher must not write an older version over a newer one.
const readPkg = () => JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const headerFor = (pkg) => `// ==UserScript==
// @name         Future
// @namespace    https://github.com/nicolagalassi/ogame-future
// @version      ${pkg.version}
// @description  ${pkg.description}
// @author       Nicola Galassi
// @license      MIT
// @homepageURL  https://github.com/nicolagalassi/ogame-future
// @updateURL    https://raw.githubusercontent.com/nicolagalassi/ogame-future/main/dist/future.user.js
// @downloadURL  https://raw.githubusercontent.com/nicolagalassi/ogame-future/main/dist/future.user.js
// @match        https://*.ogame.gameforge.com/game/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_listValues
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
  outfile: 'dist/future.user.js',
  write: false,
  logLevel: 'info',
  plugins: [{
    name: 'userscript-header',
    setup(build) {
      build.onEnd((result) => {
        for (const file of result.outputFiles ?? []) writeFileSync(file.path, headerFor(readPkg()) + '\n' + file.text);
      });
    },
  }],
});

if (process.argv.includes('--watch')) {
  await ctx.watch();
} else {
  await ctx.rebuild();
  await ctx.dispose();
}
