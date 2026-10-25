# ts-dojo

A personal web app that teaches TypeScript from the basics to the advanced type system: a roadmap of 19 modules, lessons with theory and compiler-verified exercises, and a REPL with Vim keybindings backed by the real TypeScript compiler running in the browser. Static, single-user, hosted on Kim's droplet.

**docs/spec.md is the source of truth.** §11 of the spec is the build order and §12 the acceptance criteria; docs/progress.md tracks them feature by feature.

## Development

Node 24 and pnpm 12 (`corepack enable` picks the version pinned in `package.json`), then `pnpm install`.

| Script | What it does |
| --- | --- |
| `pnpm dev` | copies the compiler's `lib.*.d.ts` files into `public/ts/`, then starts Vite |
| `pnpm build` | the same copy, then a production build into `dist/` |
| `pnpm preview` | serves `dist/` |
| `pnpm typecheck` | `tsc` over the app (`tsconfig.json`) and the Node-side code (`tsconfig.node.json`) |
| `pnpm lint` | ESLint |
| `pnpm format` / `pnpm format:check` | Prettier |
| `pnpm test --run` / `pnpm test:watch` | Vitest, one pass or watching |
| `pnpm test:e2e` | Playwright against a fresh build, in the installed Google Chrome |

Since 25 October 2026 ts-dojo lives in `ts-dojo/` of the [portfolio](https://github.com/kim-nejudne/portfolio) repository, imported with its history; the standalone repository is archived. Run every script from this directory. The portfolio's CI (`.github/workflows/ci.yml` at the repository root) runs typecheck, lint, format check, unit tests, the content lint and build on every push and pull request.
