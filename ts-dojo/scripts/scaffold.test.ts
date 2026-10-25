// Proves §12 F1 at the repository level: the §2 scripts exist (criterion 1), the CI workflow
// runs typecheck, lint, format check, unit tests and build on pushes to main and every pull
// request (criterion 2; since the import into the portfolio monorepo, the root workflow's
// `ts-dojo` job, and pushes to main only, under Deviations in docs/progress.md), tsconfig.json carries every §2 flag (criterion 3), and shadcn is initialised
// as base-nova with the six primitives (criterion 5). Criterion 4 (every §6 route in light and
// dark, `?` opening the help overlay) is e2e/scaffold.spec.ts.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { ROOT } from './copy-ts-libs.ts';

const read = (rel: string): string =>
  readFileSync(path.join(ROOT, rel), 'utf8');
const json = <T>(rel: string): T => JSON.parse(read(rel)) as T;

interface PackageJson {
  packageManager: string;
  engines?: { node?: string };
  scripts: Record<string, string>;
}

describe('package.json scripts (§2 Build, §12 F1)', () => {
  const pkg = json<PackageJson>('package.json');

  it('defines dev, build, preview, typecheck, lint, format, format:check, test, test:watch and test:e2e', () => {
    for (const name of [
      'dev',
      'build',
      'preview',
      'typecheck',
      'lint',
      'format',
      'format:check',
      'test',
      'test:watch',
      'test:e2e',
    ]) {
      expect(pkg.scripts, name).toHaveProperty(name);
    }
  });

  it('build and dev copy the lib files and (F14) the pre-bundled packages first, then run vite (§2 Build)', () => {
    expect(pkg.scripts['build']).toBe(
      'pnpm copy-ts-libs && pnpm copy-packages && vite build',
    );
    expect(pkg.scripts['dev']).toBe(
      'pnpm copy-ts-libs && pnpm copy-packages && vite',
    );
    expect(pkg.scripts['preview']).toBe('vite preview');
  });

  it('test is vitest so `pnpm test --run` is one pass; typecheck covers both projects; lint is eslint', () => {
    expect(pkg.scripts['test']).toBe('vitest');
    expect(pkg.scripts['typecheck']).toContain('tsconfig.json');
    expect(pkg.scripts['typecheck']).toContain('tsconfig.node.json');
    expect(pkg.scripts['lint']).toBe('eslint .');
    expect(pkg.scripts['format:check']).toBe('prettier --check .');
    expect(pkg.scripts['test:e2e']).toBe('playwright test');
  });

  it('pins pnpm 12 and requires Node 24', () => {
    expect(pkg.packageManager).toMatch(/^pnpm@12\./);
    expect(pkg.engines?.node).toBe('>=24');
  });
});

interface WorkflowStep {
  uses?: string;
  run?: string;
  with?: Record<string, unknown>;
}
interface WorkflowJob {
  'runs-on': string;
  defaults?: { run?: { 'working-directory'?: string } };
  steps: WorkflowStep[];
}
interface Workflow {
  on: Record<string, unknown>;
  jobs: Record<string, WorkflowJob>;
}

// The portfolio's workflow, one directory up: a workflow under ts-dojo/.github never runs.
describe('the portfolio .github/workflows/ci.yml, job ts-dojo (§12 F1)', () => {
  const load = (): Workflow =>
    parse(read('../.github/workflows/ci.yml')) as Workflow;

  it('runs on pushes to main and every pull request', () => {
    const workflow = load();
    expect(Object.keys(workflow.on)).toEqual(
      expect.arrayContaining(['push', 'pull_request']),
    );
    const push = workflow.on['push'];
    const branches =
      push !== null && typeof push === 'object' && 'branches' in push
        ? (push as { branches: string[] }).branches
        : null;
    expect(branches === null || branches.includes('main')).toBe(true);
    const pr = workflow.on['pull_request'];
    const everyPr =
      pr === null || (typeof pr === 'object' && !('branches' in pr));
    expect(everyPr, 'pull_request is not limited to some branches').toBe(true);
  });

  it('runs typecheck, lint, format check, unit tests and build in that order, on Node 24 with pnpm, in ts-dojo/', () => {
    const workflow = load();
    const job = workflow.jobs['ts-dojo'];
    expect(job, 'a ts-dojo job').toBeDefined();
    if (!job) return;
    expect(job['runs-on']).toBe('ubuntu-latest');
    expect(job.defaults?.run?.['working-directory']).toBe('ts-dojo');
    const order = [
      'pnpm install --frozen-lockfile',
      'pnpm typecheck',
      'pnpm lint',
      'pnpm format:check',
      'pnpm test --run',
      'pnpm build',
    ];
    const runs = job.steps
      .map((step) => step.run)
      .filter((run) => run !== undefined);
    expect(runs.filter((run) => order.includes(run))).toEqual(order);
    expect(
      job.steps.some((step) => step.uses?.startsWith('pnpm/action-setup@')),
    ).toBe(true);
    const node = job.steps.find((step) =>
      step.uses?.startsWith('actions/setup-node@'),
    );
    expect(node?.with?.['node-version']).toBe(24);
    expect(node?.with?.['cache']).toBe('pnpm');
  });
});

interface TsConfig {
  extends?: string;
  compilerOptions: Record<string, unknown>;
  include: string[];
}

describe('tsconfig.json (§2)', () => {
  const app = json<TsConfig>('tsconfig.json');

  it('has every flag §2 lists', () => {
    for (const flag of [
      'strict',
      'noUncheckedIndexedAccess',
      'exactOptionalPropertyTypes',
      'verbatimModuleSyntax',
      'noUnusedLocals',
      'noUnusedParameters',
      'noFallthroughCasesInSwitch',
    ]) {
      expect(app.compilerOptions[flag], flag).toBe(true);
    }
    expect(app.compilerOptions['moduleResolution']).toBe('bundler');
    expect(app.compilerOptions['paths']).toEqual({ '@/*': ['./src/*'] });
  });

  it('is the app project (src, react-jsx, no Node globals) and tsconfig.node.json extends it for Node-side code', () => {
    expect(app.include).toEqual(['src']);
    expect(app.compilerOptions['jsx']).toBe('react-jsx');
    expect(app.compilerOptions['types']).toEqual(['vite/client']);
    const node = json<TsConfig>('tsconfig.node.json');
    expect(node.extends).toBe('./tsconfig.json');
    expect(node.compilerOptions['types']).toEqual(['node']);
    for (const dir of ['scripts', 'spike', 'e2e']) {
      expect(node.include, dir).toContain(dir);
    }
  });
});

interface ComponentsJson {
  style: string;
  rsc: boolean;
  tsx: boolean;
  tailwind: { css: string; cssVariables: boolean };
  aliases: Record<string, string>;
}

describe('shadcn (§12 F1)', () => {
  it('components.json is base-nova with rsc false', () => {
    const components = json<ComponentsJson>('components.json');
    expect(components.style).toBe('base-nova');
    expect(components.rsc).toBe(false);
    expect(components.tsx).toBe(true);
    expect(components.tailwind.css).toBe('src/app/globals.css');
    expect(components.tailwind.cssVariables).toBe(true);
    expect(components.aliases['ui']).toBe('@/components/ui');
  });

  it('Button, Dialog, Tabs, Tooltip, Command and Sheet exist under src/components/ui and export their parts', async () => {
    const modules: Record<
      string,
      { parts: string[]; load: () => Promise<Record<string, unknown>> }
    > = {
      button: {
        parts: ['Button'],
        load: () => import('../src/components/ui/button.tsx'),
      },
      dialog: {
        parts: ['Dialog', 'DialogTrigger', 'DialogContent', 'DialogTitle'],
        load: () => import('../src/components/ui/dialog.tsx'),
      },
      tabs: {
        parts: ['Tabs', 'TabsList', 'TabsTrigger', 'TabsContent'],
        load: () => import('../src/components/ui/tabs.tsx'),
      },
      tooltip: {
        parts: [
          'Tooltip',
          'TooltipTrigger',
          'TooltipContent',
          'TooltipProvider',
        ],
        load: () => import('../src/components/ui/tooltip.tsx'),
      },
      command: {
        parts: ['Command', 'CommandInput', 'CommandList', 'CommandItem'],
        load: () => import('../src/components/ui/command.tsx'),
      },
      sheet: {
        parts: ['Sheet', 'SheetTrigger', 'SheetContent', 'SheetTitle'],
        load: () => import('../src/components/ui/sheet.tsx'),
      },
    };
    for (const [file, { parts, load }] of Object.entries(modules)) {
      expect(
        existsSync(path.join(ROOT, 'src', 'components', 'ui', `${file}.tsx`)),
        `${file}.tsx`,
      ).toBe(true);
      const mod = await load();
      for (const part of parts) {
        expect(typeof mod[part], `${file} exports ${part}`).toBe('function');
      }
    }
  });
});
