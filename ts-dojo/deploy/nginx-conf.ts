// A reader for deploy/nginx/ts-dojo.conf, the one source of the §10 headers. vite.config.ts takes
// the CSP from it for `vite preview`, so every Playwright run happens under the shipped policy,
// and deploy/deploy.test.ts checks the §10 rules through it. Enough of nginx's grammar for that
// file: directives, blocks, quoted strings and comments; and the location choice nginx makes for
// a URI (exact `=`, then the longest prefix, which wins outright with `^~`, then the first
// matching regex, then that longest prefix).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export interface Directive {
  name: string;
  args: string[];
  block?: Directive[];
}

export const CONF_PATH = fileURLToPath(
  new URL('./nginx/ts-dojo.conf', import.meta.url),
);

function tokenize(text: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i] as string;
    if (/\s/.test(c)) {
      i += 1;
    } else if (c === '#') {
      while (i < text.length && text[i] !== '\n') i += 1;
    } else if (c === '{' || c === '}' || c === ';') {
      tokens.push(c);
      i += 1;
    } else if (c === '"' || c === "'") {
      const end = text.indexOf(c, i + 1);
      if (end === -1) throw new Error(`unterminated string at ${String(i)}`);
      tokens.push(text.slice(i + 1, end));
      i = end + 1;
    } else {
      let j = i;
      while (j < text.length && !/[\s{};]/.test(text[j] as string)) j += 1;
      tokens.push(text.slice(i, j));
      i = j;
    }
  }
  return tokens;
}

export function parseNginx(text: string): Directive[] {
  const tokens = tokenize(text);
  let at = 0;
  const parseBlock = (nested: boolean): Directive[] => {
    const directives: Directive[] = [];
    while (at < tokens.length) {
      if (tokens[at] === '}') {
        if (!nested) throw new Error('unexpected }');
        at += 1;
        return directives;
      }
      const name = tokens[at] as string;
      at += 1;
      const args: string[] = [];
      while (at < tokens.length && tokens[at] !== ';' && tokens[at] !== '{') {
        args.push(tokens[at] as string);
        at += 1;
      }
      if (tokens[at] === ';') {
        at += 1;
        directives.push({ name, args });
      } else if (tokens[at] === '{') {
        at += 1;
        directives.push({ name, args, block: parseBlock(true) });
      } else {
        throw new Error(`directive ${name} has no ; or {`);
      }
    }
    if (nested) throw new Error('missing }');
    return directives;
  };
  return parseBlock(false);
}

export function readConf(path = CONF_PATH): Directive[] {
  return parseNginx(readFileSync(path, 'utf8'));
}

/** The `server` blocks, each with its `server_name`s and the ports it listens on. */
export function servers(conf: readonly Directive[]): Directive[] {
  return conf.filter((d) => d.name === 'server');
}

export function children(block: Directive, name: string): Directive[] {
  return (block.block ?? []).filter((d) => d.name === name);
}

/** The server for `name` that listens on `port` (`443` or `80`). */
export function serverFor(
  conf: readonly Directive[],
  name: string,
  port: string,
): Directive {
  const found = servers(conf).find(
    (s) =>
      children(s, 'server_name').some((d) => d.args.includes(name)) &&
      children(s, 'listen').some((d) => d.args[0]?.endsWith(port) === true),
  );
  if (found === undefined) {
    throw new Error(`no server for ${name} on port ${port}`);
  }
  return found;
}

/** The location nginx picks for `uri` in `server`. */
export function locationFor(server: Directive, uri: string): Directive {
  const locations = children(server, 'location');
  const exact = locations.find((l) => l.args[0] === '=' && l.args[1] === uri);
  if (exact !== undefined) return exact;
  let longest: Directive | null = null;
  let longestLength = -1;
  for (const l of locations) {
    const [modifier, path] =
      l.args.length === 2 ? l.args : ['', l.args[0] ?? ''];
    if (modifier !== '' && modifier !== '^~') continue;
    if (
      path !== undefined &&
      uri.startsWith(path) &&
      path.length > longestLength
    ) {
      longest = l;
      longestLength = path.length;
    }
  }
  if (longest?.args[0] === '^~') return longest;
  for (const l of locations) {
    const [modifier, pattern] = l.args;
    if ((modifier === '~' || modifier === '~*') && pattern !== undefined) {
      if (new RegExp(pattern, modifier === '~*' ? 'i' : '').test(uri)) return l;
    }
  }
  if (longest === null) throw new Error(`no location for ${uri}`);
  return longest;
}

/** The `add_header` values of a location, by header name. */
export function headers(location: Directive): Map<string, string> {
  const map = new Map<string, string>();
  for (const d of children(location, 'add_header')) {
    const [name, value] = d.args;
    if (name !== undefined && value !== undefined) map.set(name, value);
  }
  return map;
}

export const HOST = 'dojo.kimnejudne.dev';

/** The Content-Security-Policy the conf sends with the document (`location /` on HTTPS). */
export function documentCsp(conf: readonly Directive[] = readConf()): string {
  const csp = headers(
    locationFor(serverFor(conf, HOST, '443'), '/index.html'),
  ).get('Content-Security-Policy');
  if (csp === undefined) throw new Error('the document has no CSP');
  return csp;
}
