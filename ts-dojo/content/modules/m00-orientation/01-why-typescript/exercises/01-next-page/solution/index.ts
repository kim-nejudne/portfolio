// A URL's query string is always text: ?page=41 gives the string '41'.
function nextPage(page: number): number {
  return page + 1;
}

export function nextPageFrom(query: string): number {
  return nextPage(Number(query));
}

console.log(nextPageFrom('41'));
