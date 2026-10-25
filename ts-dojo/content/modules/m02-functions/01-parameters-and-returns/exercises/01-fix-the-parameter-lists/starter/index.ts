/** greet('Ada') is "Hello, Ada!"; greet('Ada', ' Welcome ') is "Welcome, Ada!". */
export function greet(name: string, greeting?: string) {
  return `${greeting.trim()}, ${name}!`;
}

/** repeat('ab') is "abab"; repeat('ab', 3) is "ababab". */
export function repeat(count?: number, text: string) {
  return text.repeat(count ?? 2);
}
