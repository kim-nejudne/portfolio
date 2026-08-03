import type { Customer } from '@forme/domain';

export const CUSTOMERS: readonly Customer[] = [
  {
    id: 'atelier-sur',
    name: 'Atelier Sur',
    shortName: 'Atelier Sur',
    contact: 'Bea Villarosa',
    city: 'Makati',
    terms: '30 days',
    account: 'AS-041',
  },
  {
    id: 'bureau-printing',
    name: 'Bureau of Printing and Reproduction Services',
    shortName: 'Bureau of Printing',
    contact: 'Dante Ocampo',
    city: 'Quezon City',
    terms: '45 days',
    account: 'BP-118',
  },
  {
    id: 'kalsada-press',
    name: 'Kalsada Press',
    shortName: 'Kalsada Press',
    contact: 'Ramon Tiu',
    city: 'Pasig',
    terms: '30 days',
    account: 'KP-207',
  },
  {
    id: 'nine-dots',
    name: 'Nine Dots Studio',
    shortName: 'Nine Dots',
    contact: 'Ivy Sarmiento',
    city: 'Mandaluyong',
    terms: 'Pro forma',
    account: 'ND-063',
  },
  {
    id: 'talim-editions',
    name: 'Talim Editions',
    shortName: 'Talim Editions',
    contact: 'Miguel Arceo',
    city: 'Manila',
    terms: '30 days',
    account: 'TE-152',
  },
];
