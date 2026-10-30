import { BUILT_IN_LOAD_ERROR } from '../lib/builtInSets.js';
import { BUTTON_SMALL } from '../lib/ui.js';

/** Where the built-in sets would be: the failed fetch's message and **Retry** (DECISIONS F104). */
export function BuiltInSetsError({
  onRetry,
  retrying = false,
}: {
  onRetry: () => void;
  retrying?: boolean;
}) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 text-buzz">
      <p>{BUILT_IN_LOAD_ERROR}</p>
      <button type="button" onClick={onRetry} disabled={retrying} className={BUTTON_SMALL}>
        {retrying ? 'Retrying…' : 'Retry'}
      </button>
    </div>
  );
}
