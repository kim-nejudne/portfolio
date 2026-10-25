import type { Plugin } from './types';

export const plugin: Plugin = {
  name: 'markdown',
  render: (text) => `<p>${text}</p>`,
};
