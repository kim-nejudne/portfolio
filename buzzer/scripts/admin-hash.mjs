#!/usr/bin/env node
// `npm run admin:hash`: prints an ADMIN_PASSWORD_HASH (`scrypt$N$r$p$salt$hash`) for a password
// read without echo (F105). Piped input works too: `printf 'secret\n' | npm run -s admin:hash`.
// The prompts go to stderr, so stdout holds only the hash.
import { randomBytes, scrypt } from 'node:crypto';

// N = 2^15, r = 8: 32 MB and about 100 ms per sign-in. The server reads the costs from the hash.
const N = 2 ** 15;
const r = 8;
const p = 1;
const KEY_BYTES = 32;
const SALT_BYTES = 16;

/** One line typed with echo off. Backspace edits; Ctrl-C and Ctrl-D give up. */
function readHidden(prompt) {
  return new Promise((resolve, reject) => {
    const { stdin, stderr } = process;
    stderr.write(prompt);
    stdin.setRawMode(true);
    stdin.setEncoding('utf8');
    stdin.resume();
    let text = '';
    const done = (error) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.off('data', onData);
      stderr.write('\n');
      if (error) reject(error);
      else resolve(text);
    };
    const onData = (chunk) => {
      for (const char of chunk) {
        if (char === '\r' || char === '\n') return done();
        if (char === '\u0003' || char === '\u0004') return done(new Error('Cancelled.'));
        if (char === '\u007f' || char === '\b') text = text.slice(0, -1);
        else if (char >= ' ') text += char;
      }
    };
    stdin.on('data', onData);
  });
}

/** The first line of piped input. */
async function readPiped() {
  let text = '';
  for await (const chunk of process.stdin) text += chunk;
  return text.split(/\r?\n/)[0] ?? '';
}

async function readPassword() {
  if (!process.stdin.isTTY) return readPiped();
  const password = await readHidden('Admin password: ');
  if ((await readHidden('Same again: ')) !== password) throw new Error('The passwords differ.');
  return password;
}

try {
  const password = await readPassword();
  if (password === '') throw new Error('The password is empty.');
  const salt = randomBytes(SALT_BYTES);
  // Same sum as the server's `scryptMaxmem`; Node's 32 MB default is just short of N = 2^15.
  const maxmem = 128 * r * (N + 2 + p);
  const key = await new Promise((resolve, reject) =>
    scrypt(password.normalize('NFC'), salt, KEY_BYTES, { N, r, p, maxmem }, (err, derived) =>
      err ? reject(err) : resolve(derived),
    ),
  );
  console.log(`scrypt$${N}$${r}$${p}$${salt.toString('base64url')}$${key.toString('base64url')}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
