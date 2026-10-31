// "1 light", "3 lights". Nouns here are all regular English plurals.
export function plural(count: number, noun: string) {
  return `${count} ${count === 1 ? noun : `${noun}s`}`;
}
