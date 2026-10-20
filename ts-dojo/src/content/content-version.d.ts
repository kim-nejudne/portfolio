// The §7 `contentVersion`, served at build time by the content plugin
// (src/content/node/vite-plugin.ts): the SHA-256 of the content tree.
declare module 'virtual:ts-dojo/content-version' {
  const contentVersion: string;
  export default contentVersion;
}
