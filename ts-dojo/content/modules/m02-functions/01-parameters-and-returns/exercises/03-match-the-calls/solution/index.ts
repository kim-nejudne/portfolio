export function formatPrice(amount: number, currency = '$', digits = 2) {
  return `${currency}${amount.toFixed(digits)}`;
}

export function total(...prices: number[]) {
  let sum = 0;
  for (const price of prices) sum += price;
  return sum;
}

export function discount(amount: number): number {
  if (amount >= 100) return amount * 0.1;
  if (amount >= 50) return amount * 0.05;
  return 0;
}

// How the rest of the app calls the three functions. Change the functions, not these calls.
export const examples = [
  formatPrice(9.5), // "$9.50": the currency defaults to "$", the digits to 2
  formatPrice(9.5, '€'), // "€9.50"
  formatPrice(9.5, '€', 0), // "€10"
  formatPrice(total(4, 5.5)), // "$9.50"
  formatPrice(total()), // "$0.00"
  formatPrice(discount(total(60, 60))), // "$12.00"
  formatPrice(discount(20)), // "$0.00"
];
