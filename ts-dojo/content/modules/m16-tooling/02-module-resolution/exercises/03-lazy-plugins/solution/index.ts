import type { Plugin } from './plugins/types';

// Each plugin is loaded only when it is first asked for.
const loaders = {
  markdown: () => import('./plugins/markdown.js'),
  shout: () => import('./plugins/shout/index.js'),
} satisfies Record<string, () => Promise<{ plugin: Plugin }>>;

export type PluginName = keyof typeof loaders;

export async function render(name: PluginName, text: string): Promise<string> {
  const loaded = await loaders[name]();
  return loaded.plugin.render(text);
}
