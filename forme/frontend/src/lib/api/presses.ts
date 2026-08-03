import type { Press } from '@forme/domain';
import { apiFetch } from './client';

export async function getPresses(): Promise<readonly Press[]> {
  const { presses } = await apiFetch<{ presses: Press[] }>('/presses', { authenticated: false });
  return presses;
}

export async function getPress(id: string): Promise<Press | null> {
  const presses = await getPresses();
  return presses.find((press) => press.id === id) ?? null;
}

// subscribeToFloor lives in ./live, for the same reason as subscribeToPreflight.
