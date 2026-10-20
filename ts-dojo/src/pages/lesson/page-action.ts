// The ex commands that act on the lesson page as a whole (§4 Ex commands), whichever side ran
// them: the editor's `:` line, the palette with no editor (a `predict` exercise), or the
// `predict` panel. The exercise's own commands (`:w`, `:test`, `:kill`, `:hint`, `:sol`,
// `:reset`, `:prompt`) belong to the practice side and return false here.
import type { AppActions } from '@/app/app-actions';
import { exportedMessage } from '@/app/export-progress';
import type { HostAction, Pane } from '@/editor/host';
import { NOT_ON_LESSON_PAGE } from '../not-here';
import type { LessonController } from './controller';

export function runLessonAction(
  action: HostAction,
  lesson: LessonController,
  app: AppActions,
  from: Pane,
): boolean {
  switch (action.type) {
    case 'next':
      lesson.next();
      return true;
    case 'prev':
      lesson.prev();
      return true;
    case 'lesson':
      lesson.lesson(action.direction);
      return true;
    case 'done':
      lesson.done();
      return true;
    case 'layout':
      lesson.layout(action.mode);
      return true;
    case 'focusPane':
      lesson.focusPane(action.pane);
      return true;
    case 'focusDirection':
      lesson.focusDirection(from, action.direction);
      return true;
    case 'roadmap':
      app.goToRoadmap();
      return true;
    case 'help':
      app.openHelp();
      return true;
    case 'export':
      void app
        .exportProgress()
        .then((name) => lesson.notify(exportedMessage(name)));
      return true;
    default: {
      const notice = NOT_ON_LESSON_PAGE[action.type];
      if (notice === undefined) return false;
      lesson.notify(notice);
      return true;
    }
  }
}
