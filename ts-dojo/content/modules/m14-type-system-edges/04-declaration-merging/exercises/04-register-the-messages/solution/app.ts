import { t, type Catalog } from './i18n';

export const en = {
  'cart.empty': 'Your cart is empty',
  'cart.one': 'One item in your cart',
  'cart.many': '{count} items in your cart',
};

// The registration: Register gains a messages property, so i18n.ts's conditional type
// infers typeof en, and MessageKey becomes en's three keys.
declare module './i18n' {
  interface Register {
    messages: typeof en;
  }
}

// With en registered, satisfies Catalog reported the misspelt key and the missing one.
export const sv = {
  'cart.empty': 'Din varukorg är tom',
  'cart.one': 'En vara i din varukorg',
  'cart.many': '{count} varor i din varukorg',
} satisfies Catalog;

/** The cart's label in the current language: 'cart.empty', 'cart.one' or 'cart.many'. */
export function cartLabel(count: number): string {
  if (count === 0) return t('cart.empty');
  if (count === 1) return t('cart.one');
  return t('cart.many', count);
}
