// zod 4 probes for eval support with `new Function('')` the first time an object schema is built
// (src/store/import.ts builds its schemas when the module loads), and the §10 CSP has no
// 'unsafe-eval': Chrome blocks the probe and reports a violation on every page. `jitless` skips
// the probe and the compiled parsers; the interpreted ones are fast enough for an import file.
// main.tsx imports this module first, because imports are hoisted: a call in main's own body
// would run after every imported module, schemas included.
import { z } from 'zod';

z.config({ jitless: true });
