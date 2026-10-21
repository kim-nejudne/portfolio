// shout('hey') should return 'HEY!'.
export function shout(word: string) {
  return word.toUpperCase() + '!';
}

console.log(shout('hey'));
