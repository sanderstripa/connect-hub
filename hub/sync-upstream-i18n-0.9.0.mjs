#!/usr/bin/env node
// Merge only translation keys needed by source code or missing from a locale.
// Existing Connect Hub translations are NEVER replaced.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const translationDir = 'internal/web/translation';
const englishPath = path.join(translationDir, 'en-US.json');
const english = JSON.parse(fs.readFileSync(englishPath, 'utf8'));
const branches = [
  'refs/remotes/upstream/main',
  'refs/remotes/upstream/pr7109',
  'refs/remotes/upstream/pr7120',
  'refs/remotes/upstream/pr7134',
  'refs/remotes/upstream/pr7133',
  'refs/remotes/upstream/pr7139',
  'refs/remotes/upstream/pr7136',
  'refs/remotes/upstream/pr7132',
  'refs/remotes/upstream/pr7111',
];
const locales = fs.readdirSync(translationDir).filter((file) => file.endsWith('.json'));
const cache = new Map();

function readUpstream(locale) {
  if (cache.has(locale)) return cache.get(locale);
  const result = [];
  for (const ref of branches) {
    try {
      const file = execFileSync('git', ['show', ref + ':' + translationDir + '/' + locale], {
        encoding: 'utf8',
        maxBuffer: 4 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      result.push({ ref, value: JSON.parse(file) });
    } catch (error) {
      process.stderr.write('Translation reference unavailable: ' + ref + '/' + locale + '\n');
    }
  }
  cache.set(locale, result);
  return result;
}

function leaf(obj, dotted) {
  const keys = dotted.split('.');
  let value = obj;
  for (const k of keys) {
    if (value === null || typeof value !== 'object' || !Object.hasOwn(value, k)) return undefined;
    value = value[k];
  }
  return typeof value === 'string' ? value : undefined;
}

function writeLeaf(obj, dotted, value) {
  const keys = dotted.split('.');
  const finalKey = keys.pop();
  let current = obj;
  for (const k of keys) {
    if (!Object.hasOwn(current, k)) current[k] = {};
    if (!current[k] || typeof current[k] !== 'object' || Array.isArray(current[k])) {
      throw new Error('Cannot install ' + dotted + ' because ' + k + ' is not a group');
    }
    current = current[k];
  }
  if (!Object.hasOwn(current, finalKey)) current[finalKey] = value;
}

function flatten(obj, prefix = '') {
  const out = [];
  for (const [key, value] of Object.entries(obj)) {
    const full = prefix + key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      out.push(...flatten(value, full + '.'));
    } else {
      out.push(full);
    }
  }
  return out;
}
function collectFiles(base, extensions, out) {
  for (const e of fs.readdirSync(base, { withFileTypes: true })) {
    if (['node_modules', 'dist', '.git', 'generated', '.local', 'storybook-static'].includes(e.name)) continue;
    const full = path.join(base, e.name);
    if (e.isDirectory()) collectFiles(full, extensions, out);
    else if (extensions.some((ext) => e.name.endsWith(ext))) out.push(full);
  }
}

const paths = [];
collectFiles('frontend/src', ['.ts', '.tsx'], paths);
collectFiles('internal', ['.go'], paths);
const text = paths.map((p) => fs.readFileSync(p, 'utf8')).join('\n');
// Same literal lookup pattern as i18n-dead-keys.test.ts
const referenced = new Set(Array.from(text.matchAll(/\bt\(\s*(['"])([\w.-]+)\1\s*[,)]/g), (m) => m[2]));
const enSources = readUpstream('en-US.json');
const addedEnglish = [];
const unresolved = [];
for (const key of referenced) {
  if (leaf(english, key) !== undefined) continue;
  const fromUpstream = enSources.map((src) => leaf(src.value, key)).find((value) => value !== undefined);
  const missingLegacyValues = {
    import: 'Import',
    'pages.inbounds.realityWatch.saveFailed': 'Unable to save REALITY monitoring settings',
  };
  const value = fromUpstream ?? missingLegacyValues[key];
  if (value === undefined) unresolved.push(key);
  else {
    writeLeaf(english, key, value);
    addedEnglish.push(key);
  }
}
if (unresolved.length) throw new Error('Cannot find upstream translations for: ' + unresolved.join(', '));

const masterKeys = flatten(english);
const masterSet = new Set(masterKeys);
const results = [{ locale: 'en-US.json', added: addedEnglish.length }];
for (const filename of locales) {
  if (filename === 'en-US.json') continue;
  const file = path.join(translationDir, filename);
  const obj = JSON.parse(fs.readFileSync(file, 'utf8'));
  const sources = readUpstream(filename);
  let added = 0;
  for (const key of masterKeys) {
    if (leaf(obj, key) !== undefined) continue;
    const translated = sources.map((src) => leaf(src.value, key)).find((value) => value !== undefined);
    const fallback = leaf(english, key);
    writeLeaf(obj, key, translated ?? fallback);
    added++;
  }
  const orphans = flatten(obj).filter((key) => !masterSet.has(key));
  if (orphans.length) {
    throw new Error(filename + ' contains orphan keys outside en-US: ' + orphans.join(', '));
  }
  if (added) fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n');
  results.push({ locale: filename, added });
}
if (addedEnglish.length) fs.writeFileSync(englishPath, JSON.stringify(english, null, 2) + '\n');
process.stdout.write(JSON.stringify({ addedEnglish, results }, null, 2) + '\n');
