#!/usr/bin/env node
// Unit tests for the logic blocks inside korean/index.html.
//
//   node korean/tools/test_logic.mjs              all suites
//   node korean/tools/test_logic.mjs num merge    only these
//   node korean/tools/test_logic.mjs --from draft.js num    take blocks from draft.js too (it wins)
//
// The page has no build step, so its testable logic sits between marker comments:
//
//   /* ==== PURE:num ==== */  const NUM = (() => { … })();  /* ==== END:num ==== */
//
// A block uses no DOM and no page state, and defines one const named after it in
// capitals (num → NUM). This script cuts the blocks out of the page, runs them in an
// empty context in page order, and hands them to logic_tests/<name>.mjs, which
// exports `default async function (pure, t)`.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(HERE);
const args = process.argv.slice(2);
const sources = [path.join(ROOT, 'index.html')];
const only = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--from') sources.push(path.resolve(args[++i]));
  else only.push(args[i]);
}

const blocks = new Map();
for (const file of sources) {
  const text = fs.readFileSync(file, 'utf8');
  for (const m of text.matchAll(/\/\* ==== PURE:(\w+) ==== \*\/([\s\S]*?)\/\* ==== END:\1 ==== \*\//g)) {
    blocks.delete(m[1]);          // a later file replaces the block and moves it to the end
    blocks.set(m[1], m[2]);
  }
}

const ctx = vm.createContext({ console, structuredClone, TextEncoder, TextDecoder });
const pure = {};
for (const [name, code] of blocks) {
  try {
    vm.runInContext(code, ctx, { filename: 'PURE:' + name });
    pure[name.toUpperCase()] = vm.runInContext(name.toUpperCase(), ctx);
  } catch (e) {
    console.log(`FAIL PURE:${name} does not load: ${e.message}`);
    process.exit(1);
  }
}

// Small seeded generator so "random" tests repeat exactly
function rng(seed = 1) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let x = s; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
}

const dir = path.join(HERE, 'logic_tests');
const suites = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.mjs')).map(f => f.slice(0, -4)).sort() : [];
let failed = 0, passed = 0;
for (const name of suites) {
  if (only.length && !only.includes(name)) continue;
  if (!blocks.has(name) && !only.includes(name)) { console.log(`skip ${name}: no PURE:${name} block yet`); continue; }
  let fails = 0, count = 0;
  const show = v => { try { return JSON.stringify(v); } catch (e) { return String(v); } };
  const t = {
    ok(cond, label, extra) { count++; if (!cond) { fails++; if (fails <= 25) console.log(`  FAIL ${name}: ${label}${extra !== undefined ? ' → ' + show(extra) : ''}`); } },
    eq(got, want, label) { t.ok(show(got) === show(want), label, { got, want }); },
    rng,
    deck: () => JSON.parse(fs.readFileSync(path.join(ROOT, 'deck.json'), 'utf8')),
  };
  try {
    const mod = await import(pathToFileURL(path.join(dir, name + '.mjs')).href);
    await mod.default(pure, t);
  } catch (e) {
    fails++; console.log(`  FAIL ${name}: threw ${e.stack || e}`);
  }
  failed += fails; passed += count - fails;
  console.log(`${fails ? 'FAIL' : 'ok  '} ${name}: ${count - fails}/${count} checks` + (fails > 25 ? ` (${fails - 25} more failures not shown)` : ''));
}
console.log(failed ? `FAILED: ${failed} checks` : `Logic: all ${passed} checks pass.`);
process.exit(failed ? 1 : 0);
