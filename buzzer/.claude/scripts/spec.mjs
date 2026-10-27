// Print only the docs/SPEC.md sections a roadmap item cites, instead of reading the whole spec.
//
//   node .claude/scripts/spec.mjs F07                      sections from F07's "Spec:" line
//   node .claude/scripts/spec.mjs "Scoring rules" "HTTP"   sections by heading
//   node .claude/scripts/spec.mjs --toc                    headings with line numbers and sizes
//
// A citation is "Heading (Sub, Sub: detail)". When every parenthesised name matches a subheading
// of that section (or is "intro", the text before the first subheading), only those parts print;
// otherwise the whole section prints.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SPEC = join(ROOT, 'docs', 'SPEC.md');
const ROADMAP = join(ROOT, 'docs', 'ROADMAP.md');

function fail(message) {
  process.stderr.write(message + '\n');
  process.exit(1);
}

if (!existsSync(SPEC)) fail('docs/SPEC.md not found');
const lines = readFileSync(SPEC, 'utf8').split(/\r?\n/);

const norm = (s) => s.replace(/`/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

// Headings outside code fences, each spanning to the next heading of the same or higher level.
const headings = [];
let fenced = false;
lines.forEach((line, index) => {
  if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
  const m = !fenced && /^(#{1,6}) (.*)$/.exec(line);
  if (m) headings.push({ level: m[1].length, text: m[2], key: norm(m[2]), start: index });
});
for (const [i, h] of headings.entries()) {
  const nextSame = headings.slice(i + 1).find((o) => o.level <= h.level);
  h.end = nextSame ? nextSame.start : lines.length;
  const firstChild = headings[i + 1];
  h.introEnd = firstChild && firstChild.start < h.end ? firstChild.start : h.end;
}

function match(name, within) {
  const pool = within ? headings.filter((h) => h.start > within.start && h.start < within.end) : headings;
  const key = norm(name);
  if (!key) return undefined;
  return pool.find((h) => h.key === key) ?? pool.find((h) => h.key.startsWith(key));
}

// Split on separators that sit outside parentheses.
function splitTop(text, separators) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const ch of text) {
    if (ch === '(') depth++;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (depth === 0 && separators.includes(ch)) {
      parts.push(current);
      current = '';
    } else current += ch;
  }
  parts.push(current);
  return parts.map((p) => p.trim()).filter(Boolean);
}

function resolveCitation(citation) {
  const m = /^(.*?)\s*\((.*)\)\s*$/.exec(citation);
  const parentName = m ? m[1] : citation;
  const parent = match(parentName);
  if (!parent) return { missing: citation };
  if (!m) return { ranges: [[parent.start, parent.end]] };

  const ranges = [];
  for (const sub of splitTop(m[2], [',', ';'])) {
    const name = sub.split(':')[0].trim();
    if (norm(name) === 'intro') {
      ranges.push([parent.start, parent.introEnd]);
      continue;
    }
    const child = match(name, parent);
    // A hint that is not a subheading (a bullet, a sentence) could be anywhere: print the whole section.
    if (!child) return { ranges: [[parent.start, parent.end]] };
    ranges.push([child.start, child.end]);
  }
  return { ranges };
}

function citationsFor(id) {
  if (!existsSync(ROADMAP)) fail('docs/ROADMAP.md not found');
  const roadmap = readFileSync(ROADMAP, 'utf8').split(/\r?\n/);
  const start = roadmap.findIndex((l) => new RegExp(`^\\s*- \\[.\\] ${id}\\s`, 'i').test(l));
  if (start < 0) fail(`${id}: no such roadmap item`);
  for (let i = start + 1; i < roadmap.length && !/^\s*- \[.\] /.test(roadmap[i]); i++) {
    const s = /^\s*- Spec:\s*(.*)$/.exec(roadmap[i]);
    if (s) return splitTop(s[1], [';']);
  }
  fail(`${id}: no "Spec:" line (collapsed done items have none; use "show" on an open item)`);
}

const args = process.argv.slice(2);
if (!args.length) fail('usage: spec.mjs ID | "Heading (Sub)" ... | --toc');

if (args[0] === '--toc') {
  const out = headings.map((h) => `${String(h.start + 1).padStart(4)}  ${'  '.repeat(h.level - 1)}${h.text}  (${h.end - h.start} lines)`);
  process.stdout.write(out.join('\n') + '\n');
  process.exit(0);
}

const citations = args.length === 1 && /^[FB]\d+[a-z]?$/i.test(args[0]) ? citationsFor(args[0]) : args;
const ranges = [];
const missing = [];
for (const c of citations) {
  const r = resolveCitation(c);
  if (r.missing) missing.push(r.missing);
  else ranges.push(...r.ranges);
}

// Merge overlapping ranges so no line prints twice.
ranges.sort((a, b) => a[0] - b[0]);
const merged = [];
for (const r of ranges) {
  const last = merged[merged.length - 1];
  if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
  else merged.push([...r]);
}

const out = [];
for (const [start, end] of merged) {
  out.push(`<!-- docs/SPEC.md lines ${start + 1}-${end} -->`, ...lines.slice(start, end));
}
if (missing.length) out.push(`<!-- not found: ${missing.join('; ')}. Run with --toc to see headings. -->`);
process.stdout.write(out.join('\n').replace(/\n{3,}/g, '\n\n') + '\n');
process.exit(missing.length && !merged.length ? 1 : 0);
