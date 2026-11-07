/** "1,240 km"; one decimal under 10 km ("4.2 km"), as the reveal rail writes distances. */
export function formatKm(km: number): string {
  const digits = km < 9.95 ? 1 : 0; // 9.96 would print "10.0"
  return `${km.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })} km`;
}
