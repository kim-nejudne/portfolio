import type { Press } from '@/lib/types';
import { apiDelay } from './delay';
import { PRESSES } from './fixtures/presses';

export async function getPresses(): Promise<readonly Press[]> {
  await apiDelay(120);
  return PRESSES;
}

export async function getPress(id: string): Promise<Press | null> {
  await apiDelay(90);
  return PRESSES.find((press) => press.id === id) ?? null;
}

function advance(press: Press, elapsedSeconds: number): Press {
  if (press.state === 'RUNNING') {
    const sheetsRun = Math.min(
      press.sheetsTarget,
      press.sheetsRun + Math.floor((press.sheetsPerHour * elapsedSeconds) / 3600),
    );
    const remaining = press.sheetsTarget - sheetsRun;
    if (remaining <= 0) {
      return { ...press, sheetsRun: press.sheetsTarget, state: 'WASHUP', minutesRemaining: 6 };
    }
    return {
      ...press,
      sheetsRun,
      wasteSheets: press.wasteSheets + Math.floor(elapsedSeconds / 45),
      minutesRemaining: Math.max(1, Math.ceil((remaining / press.sheetsPerHour) * 60)),
    };
  }

  if (press.state === 'MAKEREADY') {
    const minutesRemaining = press.minutesRemaining - Math.floor(elapsedSeconds / 60);
    if (minutesRemaining <= 0) {
      return { ...press, state: 'RUNNING', minutesRemaining: Math.ceil((press.sheetsTarget / press.sheetsPerHour) * 60) };
    }
    return { ...press, minutesRemaining, wasteSheets: press.wasteSheets + Math.floor(elapsedSeconds / 90) };
  }

  if (press.state === 'WASHUP') {
    const minutesRemaining = press.minutesRemaining - Math.floor(elapsedSeconds / 60);
    return minutesRemaining <= 0
      ? { ...press, state: 'IDLE', minutesRemaining: 0 }
      : { ...press, minutesRemaining };
  }

  return press;
}

/**
 * The floor board's live feed. Polling lives here so a WebSocket replaces it
 * without touching the board: same snapshot in, same snapshot out.
 */
export function subscribeToFloor(
  initial: readonly Press[],
  onTick: (presses: readonly Press[]) => void,
  intervalMs = 1000,
): () => void {
  let elapsed = 0;
  const timer = setInterval(() => {
    elapsed += intervalMs / 1000;
    onTick(initial.map((press) => advance(press, elapsed)));
  }, intervalMs);
  return () => clearInterval(timer);
}
