import type { Customer } from '@forme/domain';
import { apiFetch } from './client';

export async function getCustomers(): Promise<readonly Customer[]> {
  const { customers } = await apiFetch<{ customers: Customer[] }>('/customers');
  return customers;
}
