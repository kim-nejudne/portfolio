import { useEffect, useRef, useState, type FormEvent } from 'react';
import { PLAYER_NAME_MAX } from '../../../../shared/constants.js';
import type { Avatar } from '../../../../shared/types.js';
import type { Translate } from '../../lib/copy.js';
import { SketchButton } from '../sketch/SketchButton.js';
import { AvatarPicker } from './AvatarPicker.js';

/**
 * The name step at `/play/:code`, for a phone that has never joined this room, with the avatar
 * grid under it (F53): the last avatar this phone used here, else a random one, already picked.
 * Sketchbook look (F57): `Play` puts it on dot-grid paper under the rings.
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
      className="mx-auto flex w-full max-w-md flex-col gap-3 px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]"
    >
      <h1 className="text-[32px] leading-tight font-normal break-words">
        {t('joinTitle', { code })}
      </h1>
      <label htmlFor="name" className="text-xl leading-tight">
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
          className="sketch-border min-h-12 w-full min-w-0 bg-paper px-4 text-[22px] text-ink outline-none placeholder:text-soft focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-pen"
        />
        <SketchButton type="submit" disabled={!trimmed || busy} className="shrink-0">
          {busy ? t('joining') : t('join')}
        </SketchButton>
      </div>
      <p id="join-error" role="alert" className="min-h-6 text-lg leading-snug text-red">
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
      className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pt-2"
    >
      <h1
        id="take-over"
        ref={heading}
        tabIndex={-1}
        className="text-[32px] leading-tight font-normal break-words outline-none"
      >
        {t('areYou', { name })}
      </h1>
      <p className="text-lg leading-snug text-soft">{t('areYouHint', { name })}</p>
      <SketchButton onClick={onRejoin} disabled={busy} className="break-words">
        {busy ? t('joining') : t('rejoinAs', { name })}
      </SketchButton>
      <SketchButton variant="ghost" onClick={onPickAnother} disabled={busy}>
        {t('pickAnotherName')}
      </SketchButton>
    </section>
  );
}
