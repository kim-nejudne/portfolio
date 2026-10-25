// tiny-slug ships JavaScript and no types. Describe its API here, as the README in the
// prompt lists it. This file has no import or export, so it is a script and the
// declaration below is global, as it would be in a .d.ts file.
declare module 'tiny-slug' {
  export interface SlugOptions {
    separator?: string;
    lowercase?: boolean;
  }
  export function slugify(text: string, options?: SlugOptions): string;
  export class Slugger {
    constructor(options?: SlugOptions);
    slug(text: string): string;
    readonly count: number;
  }
  export const version: string;
}
