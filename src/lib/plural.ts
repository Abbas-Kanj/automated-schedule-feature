// "1 crew" / "3 crews" — the naive plural behind every count-plus-noun
// string in this app's copy.
export function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}
