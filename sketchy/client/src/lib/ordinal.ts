/**
 * The suffix of an English ordinal, for the phone's big rank ("2nd", Sketchbook Results): 1st,
 * 2nd, 3rd, 4th, …, 11th–13th, 21st. The spoken line comes from the rank copy, so this is only
 * what the page shows.
 */
export function ordinalSuffix(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return 'th';
  return ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
}
