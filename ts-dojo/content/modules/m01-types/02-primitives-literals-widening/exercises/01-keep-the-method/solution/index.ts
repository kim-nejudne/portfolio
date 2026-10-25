export function request(url: string, method: 'GET' | 'POST'): string {
  return `${method} ${url}`;
}

export const options = { url: '/books', method: 'GET' } as const;

export const line = request(options.url, options.method);
