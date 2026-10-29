import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './constants.js';
import { createRoomBodySchema, questionSetSchema } from './schemas.js';
import { STARTER_CATEGORIES, STARTER_SETS } from './starterSets/index.js';

const LEVELS = [
  { level: 'easy', title: '– Easy', points: 100 },
  { level: 'medium', title: '– Medium', points: 200 },
  { level: 'hard', title: '– Hard', points: 300 },
] as const;

function question(id: string) {
  const q = STARTER_SETS.flatMap((s) => s.questions).find((q) => q.id === id);
  if (!q) throw new Error(`No question ${id}`);
  return q;
}

describe('STARTER_SETS', () => {
  it('holds 60 sets: each category in list order, Easy, Medium, Hard within it', () => {
    expect(STARTER_SETS.map((s) => s.id)).toEqual(
      STARTER_CATEGORIES.flatMap((slug) => LEVELS.map((l) => `starter-${slug}-${l.level}`)),
    );
    expect(STARTER_SETS).toHaveLength(60);
  });

  it('every set is a valid, unchanged question set of 15 questions', () => {
    for (const set of STARTER_SETS) {
      expect(questionSetSchema.parse(set), set.id).toEqual(set);
      expect(set.questions, set.id).toHaveLength(15);
      expect([set.createdAt, set.updatedAt, set.schemaVersion], set.id).toEqual([0, 0, 1]);
    }
  });

  it('keeps the set file key order', () => {
    for (const set of STARTER_SETS) {
      expect(Object.keys(set), set.id).toEqual([
        'id',
        'title',
        'category',
        'difficulty',
        'questions',
        'createdAt',
        'updatedAt',
        'schemaVersion',
      ]);
      for (const q of set.questions) {
        const keys = ['id', 'text', 'answer', ...(q.hostNotes ? ['hostNotes'] : []), 'points'];
        expect(Object.keys(q), q.id).toEqual(keys);
      }
    }
  });

  it('titles, points and question ids follow the level', () => {
    STARTER_SETS.forEach((set, i) => {
      const { level, title, points } = LEVELS[i % 3]!;
      const slug = STARTER_CATEGORIES[Math.floor(i / 3)]!;
      expect(set.title.endsWith(title), set.title).toBe(true);
      set.questions.forEach((q, j) => {
        expect(q.points, q.id).toBe(points);
        expect(q.id).toBe(`${slug}-${level}-${String(j + 1).padStart(2, '0')}`);
      });
    });
  });

  it('every set carries its category and difficulty, matching its title and id', () => {
    STARTER_SETS.forEach((set, i) => {
      const { level, title } = LEVELS[i % 3]!;
      expect(set.difficulty, set.id).toBe(level);
      expect(set.category, set.id).toBeTruthy();
      expect(set.title, set.id).toBe(`${set.category} ${title}`);
    });
  });

  it('STARTER_CATEGORIES and the files agree: one category name per slug, all different', () => {
    const names = STARTER_CATEGORIES.map((slug) => {
      const sets = STARTER_SETS.filter((s) => s.id.startsWith(`starter-${slug}-`));
      expect(sets, slug).toHaveLength(3);
      expect(new Set(sets.map((s) => s.category)).size, slug).toBe(1);
      return sets[0]!.category;
    });
    expect(new Set(names).size).toBe(STARTER_CATEGORIES.length);
  });

  it('question ids are unique across all sets, and no question has a picture', () => {
    const questions = STARTER_SETS.flatMap((s) => s.questions);
    expect(new Set(questions.map((q) => q.id)).size).toBe(900);
    expect(questions.filter((q) => q.imageId !== undefined)).toEqual([]);
  });

  it('each set can create a room with the default settings', () => {
    for (const set of STARTER_SETS) {
      expect(
        createRoomBodySchema.safeParse({ set, settings: DEFAULT_SETTINGS }).success,
        set.id,
      ).toBe(true);
    }
  });

  it('carries the review fixes', () => {
    expect(question('space-easy-12').hostNotes).toBeUndefined();
    expect(question('tech-medium-02').answer).toBe('Xiaomi');
    expect(question('health-medium-15').hostNotes).not.toMatch(/type O, O\b/);
    expect(question('music-easy-06').text).not.toMatch(/Swift/);
  });
});
