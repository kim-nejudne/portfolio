import { useEffect, useRef, useState, type FormEvent } from 'react';
import { PLAYER_NAME_MAX } from '../../../../shared/constants.js';
import type { Avatar } from '../../../../shared/types.js';
import type { Translate } from '../../lib/copy.js';
import { AvatarPicker } from './AvatarPicker.js';

/**
 * The name step at `/play/:code`, for a phone that has never joined this room, with the avatar
 * grid under it (F53): the last avatar this phone used here, else a random one, already picked.
 */
export function JoinForm({
  code,
  initialName,
  initialAvatar,
  busy,
  error,
  onJoin,
  t,
}: {
  code: string;
  initialName: string;
  initialAvatar: Avatar;
  busy: boolean;
  error: string | null;
  onJoin: (name: string, avatar: Avatar) => void;
  t: Translate;
}) {
  const [name, setName] = useState(initialName);
  const [avatar, setAvatar] = useState(initialAvatar);
  const trimmed = name.trim();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (trimmed && !busy) onJoin(trimmed, avatar);
  };

  return (
    <form
      onSubmit={submit}
      className="mx-auto flex w-full max-w-md flex-col gap-3 px-4 pt-6 pb-[max(1rem,env(safe-area-inset-bottom))]"
    >
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
      <AvatarPicker avatar={avatar} onAvatar={setAvatar} t={t} />
    </form>
  );
}

/**
 * The name typed belongs to a player whose phone is disconnected (F42): "Are you Jun? · Rejoin as
 * Jun / Pick another name". Rejoining moves that player (score, crown) to this phone.
 */
export function TakeOverPrompt({
  name,
  busy,
  onRejoin,
  onPickAnother,
  t,
}: {
  name: string;
  busy: boolean;
  onRejoin: () => void;
  onPickAnother: () => void;
  t: Translate;
}) {
  // The name field it replaces had focus: the question takes it, so a screen reader reads it out.
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  return (
    <section
      aria-labelledby="take-over"
      className="mx-auto flex w-full max-w-md flex-col gap-3 px-4 pt-6"
    >
      <h1
        id="take-over"
        ref={heading}
        tabIndex={-1}
        className="font-display text-3xl font-bold break-words outline-none"
      >
        {t('areYou', { name })}
      </h1>
      <p className="text-lg text-white/80">{t('areYouHint', { name })}</p>
      <button
        type="button"
        onClick={onRejoin}
        disabled={busy}
        className="min-h-12 rounded-xl bg-[#FF6B35] px-5 text-xl font-bold break-words text-[#1D1B22] disabled:opacity-40"
      >
        {busy ? t('joining') : t('rejoinAs', { name })}
      </button>
      <button
        type="button"
        onClick={onPickAnother}
        disabled={busy}
        className="min-h-12 rounded-xl border-2 border-white/40 px-5 text-xl font-semibold disabled:opacity-40"
      >
        {t('pickAnotherName')}
      </button>
    </section>
  );
}
