// `npm run generate:try -- "<category>" <easy|medium|hard> <count>` (F109): generates one level
// with the real API and prints the questions and what they cost. It saves nothing. The npm script
// runs Node with `--env-file-if-exists=.env`, so the key comes from buzzer/.env. It spends money:
// only Kim runs it; build sessions and tests never do.

import {
  DIFFICULTIES,
  GENERATE_COUNT_MAX,
  GENERATE_COUNT_MIN,
  SET_CATEGORY_MAX,
} from '../../shared/constants.js';
import type { Difficulty } from '../../shared/types.js';
import { parseAnthropicApiKey } from '../env.js';
import { createChecker, createWriter } from './anthropic.js';
import { createAnthropicClient } from './client.js';
import { GenerationError, generateLevel } from './generator.js';
import { formatUsd } from './pricing.js';

const USAGE = `Usage: npm run generate:try -- "<category>" <${DIFFICULTIES.join('|')}> <count ${GENERATE_COUNT_MIN}-${GENERATE_COUNT_MAX}>`;

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const [category = '', level = '', countText = ''] = process.argv.slice(2);
const name = category.trim();
if (name === '' || name.length > SET_CATEGORY_MAX) {
  fail(`The category must be 1 to ${SET_CATEGORY_MAX} characters.\n${USAGE}`);
}
if (!(DIFFICULTIES as readonly string[]).includes(level)) {
  fail(`The level must be one of ${DIFFICULTIES.join(', ')}.\n${USAGE}`);
}
const count = Number(countText);
if (!Number.isInteger(count) || count < GENERATE_COUNT_MIN || count > GENERATE_COUNT_MAX) {
  fail(
    `The count must be a whole number from ${GENERATE_COUNT_MIN} to ${GENERATE_COUNT_MAX}.\n${USAGE}`,
  );
}

const apiKey = parseAnthropicApiKey(process.env.BUZZR_ANTHROPIC_API_KEY);
if (apiKey === null) {
  fail('BUZZR_ANTHROPIC_API_KEY is not set. Add it to buzzer/.env (it is never committed).');
}

const client = createAnthropicClient(apiKey);
console.log(`Generating ${count} ${level} questions for "${name}"…`);
try {
  const result = await generateLevel(
    { category: name, guidance: '', difficulty: level as Difficulty, count, avoid: [] },
    { writer: createWriter(client), checker: createChecker(client) },
  );
  result.questions.forEach((q, i) => {
    console.log(`\n${i + 1}. ${q.text}\n   Answer: ${q.answer}`);
    if (q.hostNotes) console.log(`   Notes: ${q.hostNotes}`);
  });
  const { usage } = result;
  console.log(
    `\n${result.questions.length} of ${count} questions${result.short ? ' (short)' : ''}.` +
      ` ${usage.inputTokens} input, ${usage.outputTokens} output,` +
      ` ${usage.cacheReadTokens} cache-read tokens; ${usage.searches} searches.` +
      ` Estimated cost ${formatUsd(usage.costUsd)}. Nothing was saved.`,
  );
} catch (err) {
  if (!(err instanceof GenerationError)) throw err;
  fail(`${err.message} Spent so far: ${formatUsd(err.usage.costUsd)}.`);
}
