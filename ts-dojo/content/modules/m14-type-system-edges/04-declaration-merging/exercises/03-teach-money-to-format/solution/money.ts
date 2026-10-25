// Money, from a shared module that other teams own. This file is right as it is: leave it
// alone, and add to Money from format.ts.
export class Money {
  constructor(
    readonly cents: number,
    readonly currency: string,
  ) {}
}
