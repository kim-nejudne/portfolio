import { describeEvent, summary, type AppEvent } from './index';

const today: AppEvent[] = [
  { type: 'login', user: 'Ada' },
  { type: 'purchase', user: 'Ada', cents: 1250 },
  { type: 'logout', user: 'Ada' },
];

for (const event of today) {
  console.log(describeEvent(event));
}
console.log(summary(today));
