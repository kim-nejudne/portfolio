/** greet('Ada') is "Hello, Ada!"; greet('Ada', ' Welcome ') is "Welcome, Ada!". */
export function greet(name: string, greeting = 'Hello') {
  return `${greeting.trim()}, ${name}!`;
}

/** repeat('ab') is "abab"; repeat('ab', 3) is "ababab". */
export function repeat(text: string, count = 2) {
  return text.repeat(count);
}
