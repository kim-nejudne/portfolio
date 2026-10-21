/** Called once for every name. visitAll never uses what it returns. */
export type Visit = (name: string) => undefined;

export function visitAll(names: string[], visit: Visit) {
  for (const name of names) visit(name);
}

/** shout(['ada', 'grace']) is ['ADA', 'GRACE']. */
export function shout(names: string[]) {
  const loud: string[] = [];
  visitAll(names, (name) => loud.push(name.toUpperCase()));
  return loud;
}

/** Logs every name on its own line. */
export function logAll(names: string[]) {
  visitAll(names, (name) => console.log(name));
}
