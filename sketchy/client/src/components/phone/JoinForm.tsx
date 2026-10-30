import { useState, type FormEvent } from 'react';
import { PLAYER_NAME_MAX } from '../../../../shared/constants.js';
import type { Translate } from '../../lib/copy.js';

/** The name step at `/play/:code`, for a phone that has never joined this room. */
export function JoinForm({
  code,
  initialName,
  busy,
  error,
  onJoin,
  t,
}: {
  code: string;
  initialName: string;
  busy: boolean;
  error: string | null;
  onJoin: (name: string) => void;
  t: Translate;
}) {
  const [name, setName] = useState(initialName);
  const trimmed = name.trim();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (trimmed && !busy) onJoin(trimmed);
  };

  return (
    <form onSubmit={submit} className="mx-auto flex w-full max-w-md flex-col gap-3 px-4 pt-6">
      <h1 className="font-display text-3xl font-bold">{t('joinTitle', { code })}</h1>
      <label htmlFor="name" className="text-lg font-semibold">
        {t('yourName')}
      </label>
      <div className="flex gap-3">
        <input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={PLAYER_NAME_MAX}
          placeholder={t('namePlaceholder')}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          aria-describedby="join-error"
          className="min-h-12 w-full min-w-0 rounded-xl bg-white px-4 text-xl text-[#1D1B22] placeholder:text-[#1D1B22]/65"
        />
        <button
          type="submit"
          disabled={!trimmed || busy}
          className="min-h-12 shrink-0 rounded-xl bg-[#FF6B35] px-5 text-xl font-bold text-[#1D1B22] disabled:opacity-40"
        >
          {busy ? t('joining') : t('join')}
        </button>
      </div>
      <p id="join-error" role="alert" className="min-h-6 text-[#FF8FA3]">
        {error}
      </p>
    </form>
  );
}
