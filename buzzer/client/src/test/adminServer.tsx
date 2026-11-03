// A fake admin server and fixtures for the admin pages' tests (F111, F115).
import { act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { Route, Routes, useLocation } from 'react-router';
import { vi } from 'vitest';
import { ADMIN_SESSION_MS } from '../../../shared/constants.js';
import type {
  AdminCategoriesResponse,
  AdminCategory,
  AdminCategoryLevel,
  GenerateJob,
} from '../../../shared/types.js';
import { AdminLayout } from '../pages/AdminLayout.js';

export type Answer = () => Response;
export type Call = { key: string; init?: RequestInit };

export const json =
  (body: unknown, status = 200): Answer =>
  () =>
    Response.json(body, { status });

// Relative to the clock at answer time: a fixed instant would expire once the real clock passes it.
export const signedIn: Answer = () => Response.json({ expiresAt: Date.now() + ADMIN_SESSION_MS });

/**
 * A fake server: each `METHOD path` answers with the next of its queue. Unlisted calls fail as a
 * network error would. Returns the calls made, with their init.
 */
export function stubServer(routes: Record<string, Answer[]>): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const key = `${init?.method ?? 'GET'} ${url}`;
      calls.push({ key, init });
      const answer = routes[key]?.shift();
      if (!answer) throw new TypeError('Failed to fetch');
      return answer();
    }),
  );
  return calls;
}

export const bodyOf = (calls: Call[], key: string) =>
  JSON.parse(calls.find((c) => c.key === key)!.init!.body as string) as unknown;

export const callsTo = (calls: Call[], key: string) => calls.filter((c) => c.key === key).length;

export const level = (overrides: Partial<AdminCategoryLevel> = {}): AdminCategoryLevel => ({
  setId: 'riv-e',
  title: 'Rivers – Easy',
  difficulty: 'easy',
  questions: 15,
  wanted: null,
  status: 'live',
  reviewed: true,
  ...overrides,
});

export const RIVERS: AdminCategory = {
  name: 'Rivers',
  levels: [
    level(),
    level({
      setId: 'riv-m',
      title: 'Rivers – Medium',
      difficulty: 'medium',
      questions: 13,
      wanted: 15,
      status: 'new',
    }),
    level({ setId: 'riv-h', title: 'Rivers – Hard', difficulty: 'hard', status: 'draft' }),
  ],
  job: null,
};

export const job = (overrides: Partial<GenerateJob> = {}): GenerateJob => ({
  id: 'job1',
  kind: 'generate',
  setId: null,
  category: 'Moons',
  guidance: '',
  levels: [
    { difficulty: 'easy', count: 15 },
    { difficulty: 'medium', count: 15 },
  ],
  questionId: null,
  note: '',
  queuePosition: null,
  replaced: null,
  state: 'writing',
  currentLevel: 'easy',
  finished: [],
  short: [],
  usage: {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    searches: 0,
    costUsd: 0.03,
  },
  error: null,
  startedAt: 0,
  finishedAt: null,
  ...overrides,
});

export function catalog(
  categories: AdminCategory[] = [RIVERS],
  generation: Partial<AdminCategoriesResponse['generation']> = {},
): Answer {
  return json({
    categories,
    generation: {
      enabled: true,
      usedToday: 2,
      dailyLimit: 20,
      running: null,
      replacements: { usedToday: 0, dailyLimit: 100 },
      ...generation,
    },
  } satisfies AdminCategoriesResponse);
}

export const CATEGORIES = 'GET /api/admin/categories';

/**
 * Lets pending fetches and their state updates finish under fake timers, where `findBy` and
 * `waitFor` would wait on a faked `setTimeout` for ever.
 */
export async function settle() {
  for (let i = 0; i < 5; i++) await act(() => vi.advanceTimersByTimeAsync(0));
}

/** Runs the 2 s poll timer and lets its fetch and state updates settle. */
export async function nextPoll() {
  await act(() => vi.advanceTimersByTimeAsync(2000));
}

/** The router's location, path and query, for tests that check where a page went. */
export function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname + location.search}</span>;
}

/**
 * `page` at `path` inside `AdminLayout`, as `App` routes it (F119), with every other route
 * empty. The layout holds the session gate, so a page renders only for the signed-in admin.
 */
export function AdminRoutes({ path, page }: { path: string; page: ReactNode }) {
  const child = path.replace(/^\/admin\/?/, '');
  return (
    <Routes>
      <Route path="/admin" element={<AdminLayout />}>
        {child === '' ? <Route index element={page} /> : <Route path={child} element={page} />}
      </Route>
      <Route path="*" element={null} />
    </Routes>
  );
}

/** A `matchMedia` for which only `queries` match. Undo it with `unstubMedia`. */
export function stubMedia(...queries: string[]) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({
      matches: queries.includes(query),
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  });
}

export function unstubMedia() {
  Reflect.deleteProperty(window, 'matchMedia');
}
