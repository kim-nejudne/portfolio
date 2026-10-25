// Reads a port number from a config value such as " 8080 ".
export function parsePort(text: string): number {
  return Number(text.trim());
}

// On most systems, ports below 1024 need admin rights.
export function needsAdmin(config: string): boolean {
  return parsePort(config) < 1024;
}
