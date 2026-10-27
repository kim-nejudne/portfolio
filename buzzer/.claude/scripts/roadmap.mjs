// Roadmap helper, so sessions read one entry instead of the whole of docs/ROADMAP.md.
//
//   node .claude/scripts/roadmap.mjs next [ID]        status, the feature to build (full entry), newest 3 PROGRESS entries
//   node .claude/scripts/roadmap.mjs show ID          one entry in full
//   node .claude/scripts/roadmap.mjs mark ID MARK [note]
//        MARK is one of: todo ~ x !
//        x collapses the entry to its checkbox line (details live in PROGRESS.md and git history)
//        ! needs a note, added as "  - Blocked: <note>"
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const ROADMAP = join(ROOT, 'docs', 'ROADMAP.md');
const PROGRESS = join(ROOT, 'docs', 'PROGRESS.md');
const ITEM = /^\s*- \[( |~|x|!)\] ([FB]\d+[a-z]?)\s+(.*)$/;

function fail(message) {
  process.stderr.write(message + '\n');
  process.exit(1);
}

function load() {
  if (!existsSync(ROADMAP)) fail('docs/ROADMAP.md not found');
  const lines = readFileSync(ROADMAP, 'utf8').split(/\r?\n/);
  const items = [];
  lines.forEach((line, index) => {
    const m = ITEM.exec(line);
    if (m) items.push({ mark: m[1], id: m[2], title: m[3].trim(), start: index });
  });
  // An entry runs until the next item or heading; trailing blank lines are not part of it.
  for (const item of items) {
    let end = item.start + 1;
    while (end < lines.length && !ITEM.test(lines[end]) && !/^#{1,6} /.test(lines[end])) end++;
    while (end > item.start + 1 && lines[end - 1].trim() === '') end--;
    item.end = end;
    const depends = lines.slice(item.start + 1, end).find((l) => /^\s*- Depends:/.test(l));
    item.depends = depends ? (depends.match(/[FB]\d+[a-z]?/g) ?? []) : [];
  }
  return { lines, items };
}

function find(items, id) {
  const item = items.find((i) => i.id.toLowerCase() === String(id).toLowerCase());
  if (!item) fail(`${id}: no such roadmap item`);
  return item;
}

function entry(lines, item) {
  return lines.slice(item.start, item.end).join('\n');
}

function unmetDeps(items, item) {
  return item.depends.filter((dep) => items.find((i) => i.id === dep)?.mark !== 'x');
}

function newestProgress(count) {
  if (!existsSync(PROGRESS)) return [];
  const text = readFileSync(PROGRESS, 'utf8');
  const marker = text.indexOf('<!-- entries below, newest first -->');
  if (marker < 0) return [];
  const body = text.slice(marker).split(/\r?\n/).slice(1).join('\n');
  return body
    .split(/^(?=## )/m)
    .map((e) => e.trim())
    .filter((e) => e.startsWith('## '))
    .slice(0, count);
}

function next(requested) {
  const { lines, items } = load();
  const features = items.filter((i) => i.id.startsWith('F'));
  const out = [];
  const done = features.filter((i) => i.mark === 'x').length;
  const active = items.filter((i) => i.mark === '~');
  const blocked = items.filter((i) => i.mark === '!');
  const bugs = items.filter((i) => i.id.startsWith('B') && i.mark === ' ');
  out.push(`Done: ${done}/${features.length} features`);
  out.push(`In progress: ${active.map((i) => `${i.id} ${i.title}`).join('; ') || 'none'}`);
  out.push(`Blocked: ${blocked.map((i) => `${i.id} ${i.title}`).join('; ') || 'none'}`);
  if (bugs.length) out.push(`Open bugs: ${bugs.map((i) => `${i.id} ${i.title}`).join('; ')}`);
  out.push('');

  let pick;
  if (requested) {
    pick = find(items, requested);
    out.push(`Requested: ${pick.id} [${pick.mark}]`);
    const unmet = unmetDeps(items, pick);
    if (unmet.length) out.push(`WARNING: depends on unfinished ${unmet.join(', ')}`);
  } else if (active.length) {
    pick = active[0];
    out.push(`Resume: ${pick.id} is marked [~] from an earlier session`);
  } else {
    pick = features.find((i) => i.mark === ' ' && unmetDeps(items, i).length === 0);
    if (!pick) {
      const todo = features.filter((i) => i.mark === ' ');
      if (!todo.length) out.push('Nothing left: every feature is done or blocked.');
      else
        for (const i of todo.slice(0, 5)) out.push(`Not eligible: ${i.id} waits on ${unmetDeps(items, i).join(', ')}`);
    } else {
      out.push(`Next eligible: ${pick.id}`);
    }
  }
  if (pick) {
    out.push('', entry(lines, pick), '', `Spec sections: node .claude/scripts/spec.mjs ${pick.id}`);
  }

  const progress = newestProgress(3);
  out.push('', `--- Newest PROGRESS.md entries (${progress.length}) ---`);
  out.push(progress.length ? progress.join('\n\n') : 'none yet');
  process.stdout.write(out.join('\n') + '\n');
}

function show(id) {
  const { lines, items } = load();
  process.stdout.write(entry(lines, find(items, id)) + '\n');
}

function mark(id, newMark, note) {
  const marks = { todo: ' ', '~': '~', x: 'x', '!': '!' };
  if (!(newMark in marks)) fail('MARK must be one of: todo ~ x !');
  if (newMark === '!' && !note) fail('mark ID ! needs a note saying what blocks it');
  const { lines, items } = load();
  const item = find(items, id);
  const head = lines[item.start].replace(/\[( |~|x|!)\]/, `[${marks[newMark]}]`);
  let body = lines.slice(item.start + 1, item.end);
  if (newMark === 'x') body = [];
  if (newMark === '!') body = [...body.filter((l) => !/^\s*- Blocked:/.test(l)), `  - Blocked: ${note}`];
  lines.splice(item.start, item.end - item.start, head, ...body);
  writeFileSync(ROADMAP, lines.join('\n'));
  process.stdout.write(`${item.id} → [${marks[newMark]}]${newMark === 'x' ? ' (entry collapsed)' : ''}\n`);
}

const [command, ...args] = process.argv.slice(2);
if (command === 'next') next(args[0]);
else if (command === 'show' && args[0]) show(args[0]);
else if (command === 'mark' && args[0] && args[1]) mark(args[0], args[1], args.slice(2).join(' '));
else fail('usage: roadmap.mjs next [ID] | show ID | mark ID <todo|~|x|!> [note]');
