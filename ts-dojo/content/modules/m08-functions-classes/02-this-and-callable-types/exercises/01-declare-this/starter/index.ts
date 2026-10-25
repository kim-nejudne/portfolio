export interface Tally {
  name: string;
  votes: number;
}

export function vote(by: number): string {
  this.votes += by;
  return `${this.name}: ${this.votes}`;
}

const poll = { name: 'tabs', votes: 0, vote };
export const first = poll.vote(2);
