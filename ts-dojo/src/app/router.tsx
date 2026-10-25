// The §6 routes. `l/*` stands for `/l/:lesson` and `/l/:lesson/:exercise` (lesson ids contain a
// slash; src/app/lesson-path.ts splits the rest). The layout route carries the header, the
// global keys and the help overlay.
import { createBrowserRouter } from 'react-router';
import { LessonPage } from '@/pages/lesson';
import { ModulePage } from '@/pages/module';
import { NotFoundPage } from '@/pages/not-found';
import { ProgressPage } from '@/pages/progress';
import { ReplPage } from '@/pages/repl';
import { RoadmapPage } from '@/pages/roadmap';
import { SettingsPage } from '@/pages/settings';
import { Layout } from './layout';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <RoadmapPage /> },
      { path: 'm/:module', element: <ModulePage /> },
      { path: 'l/*', element: <LessonPage /> },
      { path: 'repl', element: <ReplPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'progress', element: <ProgressPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
