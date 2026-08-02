import type { Customer } from '@/lib/types';
import { apiDelay } from './delay';
import { CUSTOMERS } from './fixtures/customers';

export async function getCustomers(): Promise<readonly Customer[]> {
  await apiDelay(90);
  return CUSTOMERS;
}

export async function getCustomer(id: string): Promise<Customer | null> {
  await apiDelay(80);
  return CUSTOMERS.find((customer) => customer.id === id) ?? null;
}

export function customerById(id: string): Customer {
  return (
    CUSTOMERS.find((customer) => customer.id === id) ?? {
      id,
      name: 'Unknown account',
      shortName: 'Unknown',
      contact: '\u2014',
      city: '\u2014',
      terms: '\u2014',
      account: '\u2014',
    }
  );
}
