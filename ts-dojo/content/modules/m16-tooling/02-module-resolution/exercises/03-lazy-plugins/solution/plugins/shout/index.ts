import type { Plugin } from '../types';

export const plugin: Plugin = {
  name: 'shout',
  render: (text) => `${text.toUpperCase()}!`,
};
