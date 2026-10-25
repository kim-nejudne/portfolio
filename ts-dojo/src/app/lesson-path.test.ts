// Lesson ids contain a slash (`m03-unions/05-discriminated-unions`, spec §3), so the §6 routes
// `/l/:lesson` and `/l/:lesson/:exercise` are matched as `l/*` and split here.
import { describe, expect, it } from 'vitest';
import { lessonHref, parseLessonPath } from './lesson-path.ts';

describe('parseLessonPath (§6)', () => {
  it('reads /l/<module>/<lesson> as the lesson with no exercise', () => {
    expect(parseLessonPath('m03-unions/05-discriminated-unions')).toEqual({
      lesson: 'm03-unions/05-discriminated-unions',
    });
  });

  it('reads /l/<module>/<lesson>/<exercise> as lesson and exercise', () => {
    expect(
      parseLessonPath(
        'm03-unions/05-discriminated-unions/01-handle-the-new-shape',
      ),
    ).toEqual({
      lesson: 'm03-unions/05-discriminated-unions',
      exercise: '01-handle-the-new-shape',
    });
  });

  it('tolerates a trailing slash', () => {
    expect(parseLessonPath('m03-unions/05-discriminated-unions/')).toEqual({
      lesson: 'm03-unions/05-discriminated-unions',
    });
  });

  it('rejects anything with fewer than two or more than three segments', () => {
    expect(parseLessonPath(undefined)).toBeNull();
    expect(parseLessonPath('')).toBeNull();
    expect(parseLessonPath('m03-unions')).toBeNull();
    expect(parseLessonPath('a/b/c/d')).toBeNull();
  });

  it('lessonHref builds the §6 URL and round-trips', () => {
    expect(lessonHref('m03-unions/05-discriminated-unions')).toBe(
      '/l/m03-unions/05-discriminated-unions',
    );
    expect(
      lessonHref(
        'm03-unions/05-discriminated-unions',
        '01-handle-the-new-shape',
      ),
    ).toBe('/l/m03-unions/05-discriminated-unions/01-handle-the-new-shape');
    const href = lessonHref('m00-orientation/01-why-types', '02-predict');
    expect(parseLessonPath(href.slice('/l/'.length))).toEqual({
      lesson: 'm00-orientation/01-why-types',
      exercise: '02-predict',
    });
  });
});
