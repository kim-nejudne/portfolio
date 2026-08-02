/**
 * The single artificial latency helper. Delete this one function when the NestJS API lands.
 */
export function apiDelay(ms = 140): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
