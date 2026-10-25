// The prelude on a plain global in Node: console entries with their level, serialized args
// and TypeScript `loc` (§12 F4 criterion 1), the output caps (criterion 6: 500 entries or
// 200 KB, then one truncation), the pending-timer count behind "still running (1 timer)"
// (criterion 7) and the runtime error position (criterion 3).
import ts from 'typescript';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_OUTPUT_BYTES,
  MAX_OUTPUT_ENTRIES,
  type SandboxEvent,
} from '@/protocol/sandbox';
import {
  createModuleRegistry,
  installPrelude,
  type SandboxGlobal,
} from './prelude';

const URL_A = 'blob:http://localhost:4173/0b8c1b8e-1111-4d3e-9f1a-aaaaaaaaaaaa';

function transpile(text: string): string {
  return ts.transpileModule(text, {
    fileName: '/index.ts',
    compilerOptions: {
      target: ts.ScriptTarget.ES2025,
      module: ts.ModuleKind.ESNext,
      inlineSourceMap: true,
      inlineSources: true,
    },
  }).outputText;
}

function setup(locate: () => null = () => null) {
  const events: SandboxEvent[] = [];
  const global: SandboxGlobal = {
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    setInterval: globalThis.setInterval,
    clearInterval: globalThis.clearInterval,
  };
  let clock = 1000;
  const prelude = installPrelude({
    global,
    post: (event) => events.push(event),
    locate,
    now: () => clock,
  });
  // The shim the prelude installed, typed as the console the fixtures call.
  const out = global.console as Console;
  return { events, global, out, prelude, tick: (ms: number) => (clock += ms) };
}

describe('the console shim', () => {
  it('posts one entry per call with the level and the serialized arguments', () => {
    const { events, out } = setup();
    out.log('hi', { a: 1 }, new Map([['k', 1]]));
    out.warn('careful');
    out.error(new Error('boom'));
    expect(events).toEqual([
      {
        type: 'console',
        level: 'log',
        args: ['hi', '{ a: 1 }', "Map(1) { 'k' => 1 }"],
        loc: null,
      },
      { type: 'console', level: 'warn', args: ['careful'], loc: null },
      { type: 'console', level: 'error', args: ['Error: boom'], loc: null },
    ]);
  });

  it('stops at 500 entries with one truncation event', () => {
    const { events, out } = setup();
    for (let i = 0; i < MAX_OUTPUT_ENTRIES + 10; i += 1) out.log(i);
    const consoleEvents = events.filter((e) => e.type === 'console');
    const truncations = events.filter((e) => e.type === 'truncated');
    expect(consoleEvents).toHaveLength(MAX_OUTPUT_ENTRIES);
    expect(truncations).toHaveLength(1);
    expect(truncations[0]).toMatchObject({
      type: 'truncated',
      entries: MAX_OUTPUT_ENTRIES,
    });
    expect(events.at(-1)?.type).toBe('truncated');
  });

  it('stops at 200 KB with one truncation event', () => {
    const { events, out } = setup();
    for (let i = 0; i < 5; i += 1) out.log('x'.repeat(50_000));
    expect(events.filter((e) => e.type === 'console')).toHaveLength(4);
    expect(events.at(-1)).toEqual({
      type: 'truncated',
      entries: 4,
      bytes: MAX_OUTPUT_BYTES,
    });
  });
});

describe('the module registry', () => {
  it('maps a frame in a registered module to its TypeScript line', () => {
    const registry = createModuleRegistry();
    const js = transpile(
      ['type T = 1;', 'const a = 1;', '', 'console.log(a);'].join('\n'),
    );
    registry.register({ url: URL_A, path: '/index.ts', js, lineOffset: 0 });
    const generatedLine =
      js.split('\n').findIndex((l) => l.startsWith('console.log')) + 1;
    const stack = [
      'Error',
      '    at Object.log (http://localhost:4173/assets/worker-abc.js:10:20)',
      `    at ${URL_A}:${String(generatedLine)}:9`,
      `    at async ${URL_A}:1:1`,
    ].join('\n');
    expect(registry.locate(stack)).toEqual({
      file: '/index.ts',
      line: 4,
      column: 9,
    });
  });

  it('subtracts the wrapper line of a CommonJS module and accepts a frame with a function name', () => {
    const registry = createModuleRegistry();
    const js = transpile(
      [
        'export const f = () => {',
        '  throw new Error("x");',
        '};',
        'f();',
      ].join('\n'),
    );
    registry.register({ url: URL_A, path: '/index.ts', js, lineOffset: 1 });
    const throwLine = js.split('\n').findIndex((l) => l.includes('throw')) + 1;
    expect(
      registry.locate(
        `Error: x\n    at f (${URL_A}:${String(throwLine + 1)}:11)\n    at ${URL_A}:5:1`,
      ),
    ).toEqual({ file: '/index.ts', line: 2, column: 9 });
  });

  it('returns null when no frame is in a module', () => {
    const registry = createModuleRegistry();
    expect(
      registry.locate('Error\n    at http://localhost/app.js:1:1'),
    ).toBeNull();
    expect(registry.locate(undefined)).toBeNull();
  });
});

describe('timers and done', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('counts pending timers into done and posts done again when they drain', () => {
    const { events, global, out, prelude, tick } = setup();
    global.setTimeout(() => out.log('late'), 50);
    const interval = global.setInterval(() => {}, 10);
    expect(prelude.pendingTimers()).toBe(2);
    tick(5);
    prelude.settle();
    expect(events.at(-1)).toEqual({
      type: 'done',
      durationMs: 5,
      pendingTimers: 2,
    });
    global.clearInterval(interval);
    expect(prelude.pendingTimers()).toBe(1);
    vi.advanceTimersByTime(50);
    tick(50);
    expect(prelude.pendingTimers()).toBe(0);
    expect(events.slice(-2)).toEqual([
      { type: 'console', level: 'log', args: ['late'], loc: null },
      { type: 'done', durationMs: 5, pendingTimers: 0 },
    ]);
  });

  it('posts done once when nothing is pending, and a cleared timer is not pending', () => {
    const { events, global, prelude } = setup();
    const id = global.setTimeout(() => {}, 1000);
    global.clearTimeout(id);
    prelude.settle();
    prelude.settle();
    expect(events).toEqual([{ type: 'done', durationMs: 0, pendingTimers: 0 }]);
  });
});

describe('reportError', () => {
  it('posts the message, the stack and the located position', () => {
    const { events, prelude } = setup(() => null);
    const error = new TypeError('bad');
    prelude.reportError(error);
    expect(events[0]).toEqual({
      type: 'runtimeError',
      message: 'TypeError: bad',
      stack: error.stack,
      loc: null,
    });
    prelude.reportError('a string was thrown');
    expect(events[1]).toEqual({
      type: 'runtimeError',
      message: 'a string was thrown',
      stack: '',
      loc: null,
    });
  });
});
