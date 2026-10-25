// Quiz scores, shared by the three functions below.
const scores = [];

export function record(score: number) {
  scores.push(score);
}

export function best(): number {
  return Math.max(...scores);
}

export function average(): number {
  let sum = 0;
  for (const score of scores) {
    sum += score;
  }
  return sum / scores.length;
}
