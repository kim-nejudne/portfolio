// Console arguments as readable text (§4 Running): depth 3, cycle-safe, with Error, Map, Set,
// Date, class names and functions shown the way Node's console does, and nothing that needs
// the structured-clone of an object (a class instance would lose its name, a function would
// throw). Pure: runs in the sandbox worker and in Node tests; the test harness (F7) reuses it
// for `expected` and `actual`.

export const MAX_DEPTH = 3;

const TYPED_ARRAY_TAGS = new Set([
  'Int8Array',
  'Uint8Array',
  'Uint8ClampedArray',
  'Int16Array',
  'Uint16Array',
  'Int32Array',
  'Uint32Array',
  'Float32Array',
  'Float64Array',
  'BigInt64Array',
  'BigUint64Array',
]);

function quote(text: string): string {
  return `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;
}

function keyText(key: string | symbol): string {
  if (typeof key === 'symbol') return `[${key.toString()}]`;
  return /^[A-Za-z_$][\w$]*$/.test(key) ? key : quote(key);
}

function constructorName(value: object): string | null {
  const proto: unknown = Object.getPrototypeOf(value);
  if (proto === null) return null;
  const ctor = (proto as { constructor?: unknown }).constructor;
  return typeof ctor === 'function' && ctor.name !== '' ? ctor.name : 'Object';
}

function wrap(open: string, items: string[], close: string): string {
  return items.length === 0
    ? `${open}${close}`
    : `${open} ${items.join(', ')} ${close}`;
}

function ownEntries(value: object, depth: number, seen: Set<object>): string[] {
  const keys: (string | symbol)[] = [
    ...Object.keys(value),
    ...Object.getOwnPropertySymbols(value).filter(
      (s) => Object.getOwnPropertyDescriptor(value, s)?.enumerable === true,
    ),
  ];
  return keys.map((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor?.get !== undefined) return `${keyText(key)}: [Getter]`;
    let text: string;
    try {
      text = inner(
        (value as Record<string | symbol, unknown>)[key],
        depth,
        seen,
      );
    } catch {
      text = '[Getter]';
    }
    return `${keyText(key)}: ${text}`;
  });
}

function inner(value: unknown, depth: number, seen: Set<object>): string {
  switch (typeof value) {
    case 'string':
      return quote(value);
    case 'number':
      return Object.is(value, -0) ? '-0' : String(value);
    case 'bigint':
      return `${String(value)}n`;
    case 'boolean':
    case 'undefined':
      return String(value);
    case 'symbol':
      return value.toString();
    case 'function': {
      const source = Function.prototype.toString.call(value);
      const isClass = /^class[\s{]/.test(source);
      const name = value.name === '' ? '' : value.name;
      if (isClass)
        return name === '' ? '[class (anonymous)]' : `[class ${name}]`;
      return name === '' ? '[Function (anonymous)]' : `[Function: ${name}]`;
    }
    case 'object':
      break;
  }
  if (value === null) return 'null';
  const object = value;
  if (seen.has(object)) return '[Circular]';
  if (object instanceof Error) {
    const head = `${object.name}: ${object.message}`;
    if (!('cause' in object) || depth >= MAX_DEPTH) return head;
    seen.add(object);
    const cause = inner(object.cause, depth + 1, seen);
    seen.delete(object);
    return `${head} { cause: ${cause} }`;
  }
  if (object instanceof Date) {
    return Number.isNaN(object.getTime())
      ? 'Invalid Date'
      : object.toISOString();
  }
  if (object instanceof RegExp) return String(object);
  if (object instanceof Promise) return 'Promise {}';
  const name = constructorName(object);
  const tag = Object.prototype.toString.call(object).slice(8, -1);
  if (depth >= MAX_DEPTH) {
    if (Array.isArray(object)) return '[Array]';
    return name === null || name === 'Object' ? '[Object]' : `[${name}]`;
  }
  seen.add(object);
  try {
    if (Array.isArray(object)) {
      return wrap(
        '[',
        object.map((item) => inner(item, depth + 1, seen)),
        ']',
      );
    }
    if (TYPED_ARRAY_TAGS.has(tag)) {
      const items = Array.from(object as ArrayLike<unknown>, (item) =>
        inner(item, depth + 1, seen),
      );
      return wrap(`${tag}(${String(items.length)}) [`, items, ']');
    }
    if (object instanceof Map) {
      const items = [...object].map(
        ([k, v]) =>
          `${inner(k, depth + 1, seen)} => ${inner(v, depth + 1, seen)}`,
      );
      return wrap(`Map(${String(object.size)}) {`, items, '}');
    }
    if (object instanceof Set) {
      const items = [...object].map((item) => inner(item, depth + 1, seen));
      return wrap(`Set(${String(object.size)}) {`, items, '}');
    }
    const entries = ownEntries(object, depth + 1, seen);
    const prefix =
      name === null
        ? '[Object: null prototype] '
        : name === 'Object'
          ? ''
          : `${name} `;
    return `${prefix}${wrap('{', entries, '}')}`;
  } finally {
    seen.delete(object);
  }
}

/** One value as the console would print it when nested (strings quoted). */
export function serialize(value: unknown): string {
  return inner(value, 0, new Set());
}

/** The console's argument list: a top-level string stays raw, everything else is serialized. */
export function formatArgs(args: readonly unknown[]): string[] {
  return args.map((arg) => (typeof arg === 'string' ? arg : serialize(arg)));
}
