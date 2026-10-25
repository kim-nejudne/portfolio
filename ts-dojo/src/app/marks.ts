// User Timing marks for the §9 budgets, visible in DevTools' Performance panel and read by
// e2e/budgets.spec.ts: the shell interactive (the layout's global keys listening) and the
// compiler's first `ready`. Times are from navigation start (`startTime`).
export const SHELL_INTERACTIVE_MARK = 'ts-dojo:shell-interactive';
export const COMPILER_READY_MARK = 'ts-dojo:compiler-ready';

/** Sets the mark unless this document already has it. */
export function markOnce(name: string): void {
  if (performance.getEntriesByName(name, 'mark').length === 0) {
    performance.mark(name);
  }
}
