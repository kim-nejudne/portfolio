import { describe, expect, it } from 'vitest';
import { APP_NAME, DEFAULT_PORT } from './constants.js';

describe('shared constants', () => {
  it('names the app and the server port the Vite proxy targets', () => {
    expect(APP_NAME).toBe('Buzzr');
    expect(DEFAULT_PORT).toBe(3000);
  });
});
