import { t, type Catalog } from './i18n';

export const en = {
  'cart.empty': 'Your cart is empty',
  'cart.one': 'One item in your cart',
  'cart.many': '{count} items in your cart',
};

// 1. Register the type of en with i18n.ts.

export const sv = {
  'cart.emtpy': 'Din varukorg är tom',
  'cart.one': 'En vara i din varukorg',
  'cart.many': '{count} varor i din varukorg',
} satisfies Catalog;

/** The cart's label in the current language: 'cart.empty', 'cart.one' or 'cart.many'. */
export function cartLabel(count: number): string {
  throw new Error(`not implemented for ${count} items`);
}
