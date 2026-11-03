// A stand-in for the real generator (F83), used in development when there is no
// SKETCHY_ANTHROPIC_API_KEY, so the admin's generation can be played through with no key and no
// spend. Ported and adapted from Buzzr (buzzer/server/generate/fake.ts). It waits `stepMs` in each
// stage so the progress shows, and drafts everyday words from a fixed list, skipping any already
// in the category. A title that holds "fail" fails.

import type { AdminDraftWord } from '../../shared/types.js';
import { normalize } from '../match.js';
import { type GenerationResult, type WordRequest, GenerationError } from './generator.js';
import type { GenerateFn } from './jobs.js';

/** The fake's whole vocabulary: `word|level|alt,alt`. */
const FAKE_WORDS = `apple|1
banana|1
bicycle|1|bike
book|1
bridge|2
butterfly|1
cactus|1
camera|1
candle|1
castle|2
cloud|1
crown|1
cupcake|1
dinosaur|2
dolphin|1
dragon|2
drum|1
elephant|1
envelope|2
feather|1
fire truck|2|fire engine
fishing|3
flower|1
ghost|1
giraffe|1
guitar|1
hammer|1
helicopter|2
honey|2
igloo|2
island|2
jellyfish|2
kangaroo|2
kite|1
ladder|1
lighthouse|2
lion|1
magnet|2
mermaid|2
moon|1
mountain|1
mushroom|1
octopus|1
owl|1
paddle|2
parachute|2
penguin|1
piano|2
pirate|2
pizza|1
rainbow|1
robot|1
rocket|1
sailing|3
sandcastle|2
scarecrow|2
skateboard|2
snail|1
snowman|1
spider|1
sunflower|1
surfing|3
telescope|2
tent|1
tornado|2
treasure|2
umbrella|1
volcano|2
waterfall|2
whale|1
windmill|2
wizard|2
yo-yo|2|yoyo
zebra|1
picnic|3
camping|3
birthday party|3
traffic jam|3
sleepwalking|3
juggling|3`;

const VOCABULARY: AdminDraftWord[] = FAKE_WORDS.split('\n').map((line) => {
  const [word = '', level = '2', alt = ''] = line.split('|');
  return {
    word,
    difficulty: Number(level) as 1 | 2 | 3,
    alt: alt === '' ? [] : alt.split(','),
  };
});

/** What a fake generation reports spending: nothing, under its own model name. */
export const FAKE_MODEL = 'fake';
export const FAKE_EMOJI = '🎲';
export const FAKE_FAIL = 'The fake generator fails every title that holds “fail”.';

export function fakeGenerator({
  stepMs = 1200,
  wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
}: { stepMs?: number; wait?: (ms: number) => Promise<void> } = {}): GenerateFn {
  return async (request: WordRequest, onStage): Promise<GenerationResult> => {
    onStage('writing');
    await wait(stepMs);
    onStage('checking');
    await wait(stepMs);
    const usage = [
      {
        model: FAKE_MODEL,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      },
    ];
    if (request.title.toLowerCase().includes('fail')) throw new GenerationError(FAKE_FAIL, usage);
    const avoid = new Set(request.avoid.map(normalize));
    const words = VOCABULARY.filter(
      (w) => !avoid.has(normalize(w.word)) && !w.alt.some((a) => avoid.has(normalize(a))),
    )
      .slice(0, request.count)
      .map((w) => ({ ...w, alt: [...w.alt] }));
    return { words, ...(request.wantEmoji ? { emoji: FAKE_EMOJI } : {}), usage };
  };
}
