export function send(method: 'GET' | 'POST', path: string): string {
  return `${method} ${path}`;
}

// The upload to retry. attempts counts the tries so far.
export const upload = { method: 'POST' as const, path: '/photos', attempts: 0 };

// Every line sent so far, shared by the functions below.
const sent: string[] = [];

export function retry(): string {
  upload.attempts += 1;
  const line = send(upload.method, upload.path);
  sent.push(line);
  return line;
}

export function lastSent(): string {
  return sent[sent.length - 1];
}

export function sentCount(): number {
  return sent.length;
}
