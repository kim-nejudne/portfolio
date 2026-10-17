// Which project file an EditorState holds: every file has its own state (its own history and
// cursor) and the TS extensions read the path from this facet when they talk to ts-ls.
import { Facet } from '@codemirror/state';

export const filePath = Facet.define<string, string>({
  combine: (values) => values[0] ?? '',
});
