// The §7 `contentVersion`, served at build time by the content plugin
// (src/content/node/vite-plugin.ts): the SHA-256 of the content tree.
declare module 'virtual:ts-dojo/content-version' {
  const contentVersion: string;
  export default contentVersion;
}

// The content tree the build read, relative to the repository root: `content`, or
// `fixtures/content` in the e2e build (src/content/node/roots.ts).
declare module 'virtual:ts-dojo/content-root' {
  const contentRoot: string;
  export default contentRoot;
}
