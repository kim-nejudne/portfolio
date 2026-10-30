// Prints the URLs a laptop's Screen and the phones on the same Wi-Fi open, with terminal QR codes.
//
//   npm run lan                 # Screen URL (the landing page: Start a game on this screen)
//   npm run lan -- ABCD         # also the join URL for room ABCD
//   npm run lan -- ABCD --port 3000   # against `npm start` instead of `npm run dev`
import { networkInterfaces } from 'node:os';
import { parseArgs } from 'node:util';
import QRCode from 'qrcode';
import { DEV_CLIENT_PORT } from '../shared/constants.js';
import { lanAddress } from '../server/lan.js';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { port: { type: 'string', default: String(DEV_CLIENT_PORT) } },
});

const port = Number(values.port);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error(`Not a port: ${values.port}`);
  process.exit(1);
}

const rawCode = positionals[0];
const code = rawCode?.trim().toUpperCase();
if (code !== undefined && !/^[A-Z]{4}$/.test(code)) {
  console.error(`A room code is 4 letters, got "${rawCode}".`);
  process.exit(1);
}

const address = lanAddress(networkInterfaces());
if (address === null) {
  console.error('No LAN address found. Is this computer on Wi-Fi or Ethernet?');
  process.exit(1);
}

const origin = `http://${address}:${port}`;

async function show(label: string, url: string): Promise<void> {
  console.log(`\n${label}: ${url}\n`);
  console.log(await QRCode.toString(url, { type: 'terminal', small: true }));
}

await show('Screen (open on the laptop, TV or tablet)', `${origin}/`);
if (code !== undefined)
  await show(`Join room ${code} (scan with a phone)`, `${origin}/play/${code}`);
