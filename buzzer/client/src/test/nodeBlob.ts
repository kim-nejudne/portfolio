// fake-indexeddb clones with Node's structuredClone, which keeps a Node Blob but not a jsdom one.
// The client tsconfig has no Node types, so the module is typed here.
export const { Blob: NodeBlob } = (
  globalThis as unknown as {
    process: { getBuiltinModule(id: 'node:buffer'): { Blob: typeof Blob } };
  }
).process.getBuiltinModule('node:buffer');
