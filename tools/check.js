#!/usr/bin/env node
/*
 * iCryptos Dashboards - repository consistency checks
 *
 * Plain Node, no dependencies. Run with:
 *   npm run lint
 *
 * Checks
 *   1. links      every relative href/src resolves to a file on disk
 *   2. legacy     no live page points at newshub/ or a retired theme
 *   3. tokens     no --cp-* token is declared in more than one file
 *   4. schema     every JSON-LD block parses
 *   5. meta       live pages carry the Lapse theme-color
 *   6. sitemap    every sitemap.xml URL exists on disk
 *   7. copy       no em dash or en dash in visible copy
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SITE_ROOT = '/dashboards/';
const THEME_COLOR = '#101010';
const LEGACY_DIR = 'old';
const RETIRED_THEMES = ['blue.html', 'gray.html', 'green.html', 'old.html', 'pill.html', 'purple.html'];
const LONG_DASH = /[\u2012\u2013\u2014\u2015\u2212]/;

const errors = [];
const warnings = [];

function fail(file, rule, message) {
  errors.push(`${rule.padEnd(8)} ${path.relative(ROOT, file) || '.'} :: ${message}`);
}

function warn(file, rule, message) {
  warnings.push(`${rule.padEnd(8)} ${path.relative(ROOT, file) || '.'} :: ${message}`);
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const allFiles = walk(ROOT);
const htmlFiles = allFiles.filter((f) => f.toLowerCase().endsWith('.html'));

function isArchived(file) {
  return path.relative(ROOT, file).split(path.sep)[0] === LEGACY_DIR;
}

/* Resolve a document reference to a path inside the repo, or null when the
   reference points outside the repo (external URL, anchor, mailto, ...). */
function resolveRef(file, ref) {
  if (!ref) return null;
  const clean = ref.trim().split('#')[0].split('?')[0];
  if (!clean) return null;
  // Template placeholders such as ${item.url} are resolved at runtime.
  if (/[{}]/.test(clean)) return null;
  if (/^(https?:)?\/\//i.test(clean)) return null;
  if (/^(mailto:|tel:|data:|javascript:)/i.test(clean)) return null;
  if (clean.startsWith('/')) {
    if (clean.startsWith(SITE_ROOT)) return path.join(ROOT, clean.slice(SITE_ROOT.length));
    return null;
  }
  return path.resolve(path.dirname(file), clean);
}

function refsIn(html) {
  const refs = [];
  const re = /(?:href|src)\s*=\s*("([^"]*)"|'([^']*)')/gi;
  let m;
  while ((m = re.exec(html))) {
    refs.push({ raw: m[0], value: m[2] !== undefined ? m[2] : m[3] });
  }
  return refs;
}

/* ---- 1 + 2: links and legacy references ---- */
for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf8');

  for (const ref of refsIn(html)) {
    const target = resolveRef(file, ref.value);
    if (!target) continue;

    if (!fs.existsSync(target)) {
      fail(file, 'links', `broken reference "${ref.value}"`);
      continue;
    }
    if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
      const indexFile = path.join(target, 'index.html');
      if (!fs.existsSync(indexFile)) {
        fail(file, 'links', `directory reference "${ref.value}" has no index.html`);
      }
    }
  }

  if (isArchived(file)) continue;

  if (/newshub/i.test(html)) {
    fail(file, 'legacy', 'references the retired newshub/ area');
  }
  for (const theme of RETIRED_THEMES) {
    // Matches live paths such as themes/green.html or ../themes/green.html,
    // but not the archived copy under old/themes/.
    const re = new RegExp(`href="(?:\\.\\./)?themes/${theme.replace('.', '\\.')}"`);
    if (re.test(html)) {
      fail(file, 'legacy', `links to the retired theme ${theme}`);
    }
  }
}

/* ---- 3: token declarations ---- */
const TOKEN_DECL = /(--cp-[a-z0-9-]+)\s*:/g;
const tokenOwners = new Map();
for (const file of allFiles) {
  if (!/\.(css|html)$/i.test(file)) continue;
  if (isArchived(file)) continue;
  const text = fs.readFileSync(file, 'utf8');
  let m;
  TOKEN_DECL.lastIndex = 0;
  while ((m = TOKEN_DECL.exec(text))) {
    const name = m[1];
    if (!tokenOwners.has(name)) tokenOwners.set(name, new Set());
    tokenOwners.get(name).add(path.relative(ROOT, file));
  }
}
for (const [name, owners] of tokenOwners) {
  if (owners.size > 1) {
    const list = [...owners].join(', ');
    fail(path.join(ROOT, 'assets/ColourPalette.css'), 'tokens',
      `${name} is declared in more than one file: ${list}`);
  }
}

/* ---- 4: JSON-LD ---- */
for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf8');
  const re = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  let n = 0;
  while ((m = re.exec(html))) {
    n += 1;
    try {
      JSON.parse(m[1]);
    } catch (err) {
      fail(file, 'schema', `JSON-LD block ${n} does not parse: ${err.message}`);
    }
  }
}

/* ---- 5: theme-color ---- */
for (const file of htmlFiles) {
  if (isArchived(file)) continue;
  const html = fs.readFileSync(file, 'utf8');
  const m = html.match(/<meta\s+name="theme-color"\s+content="([^"]+)"/i);
  if (!m) {
    warn(file, 'meta', 'no theme-color meta tag');
  } else if (m[1].toLowerCase() !== THEME_COLOR) {
    fail(file, 'meta', `theme-color is ${m[1]}, expected ${THEME_COLOR}`);
  }
}

/* ---- 6: sitemap ---- */
const sitemapPath = path.join(ROOT, 'sitemap.xml');
if (fs.existsSync(sitemapPath)) {
  const xml = fs.readFileSync(sitemapPath, 'utf8');
  const re = /<loc>([^<]+)<\/loc>/g;
  let m;
  while ((m = re.exec(xml))) {
    const loc = m[1];
    if (!loc.startsWith('https://ttearncrypto.f9xr.org' + SITE_ROOT)) {
      warn(sitemapPath, 'sitemap', `unexpected host in ${loc}`);
      continue;
    }
    const rel = loc.slice(('https://ttearncrypto.f9xr.org' + SITE_ROOT).length);
    const target = path.join(ROOT, rel);
    if (!fs.existsSync(target)) {
      fail(sitemapPath, 'sitemap', `listed URL does not exist: ${rel}`);
    }
  }
}

/* ---- 7: long dashes in visible copy ---- */
for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf8');
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  const text = stripped.replace(/<[^>]+>/g, ' ');
  const m = text.match(LONG_DASH);
  if (m) {
    const idx = text.indexOf(m[0]);
    const snippet = text.slice(Math.max(0, idx - 40), idx + 40).replace(/\s+/g, ' ').trim();
    fail(file, 'copy', `long dash ${JSON.stringify(m[0])} in copy: "...${snippet}..."`);
  }
}

/* ---- report ---- */
const C = process.stdout.isTTY
  ? { red: '\x1b[31m', yellow: '\x1b[33m', green: '\x1b[32m', dim: '\x1b[2m', reset: '\x1b[0m' }
  : { red: '', yellow: '', green: '', dim: '', reset: '' };

if (warnings.length) {
  console.log(`${C.yellow}${warnings.length} warning(s)${C.reset}`);
  for (const w of warnings) console.log(`  ${C.dim}${w}${C.reset}`);
}
if (errors.length) {
  console.log(`${C.red}${errors.length} error(s)${C.reset}`);
  for (const e of errors) console.log(`  ${e}`);
  process.exit(1);
}
console.log(`${C.green}all checks passed${C.reset} (${htmlFiles.length} html files)`);
