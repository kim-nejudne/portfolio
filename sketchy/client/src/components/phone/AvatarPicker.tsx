import { AVATARS } from '../../../../shared/constants.js';
import type { Avatar } from '../../../../shared/types.js';
import type { Translate } from '../../lib/copy.js';

/**
 * The avatar grid (F53), adapted from Buzzr's join form (buzzer/client/src/pages/Play.tsx): the 24
 * emoji as toggle buttons, one always picked, so unlike Buzzr's a second tap doesn't clear it.
 */
export function AvatarPicker({
  avatar,
  onAvatar,
  t,
}: {
  avatar: Avatar;
  onAvatar: (avatar: Avatar) => void;
  t: Translate;
}) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="mb-2 font-hand text-xl leading-tight">{t('yourAvatar')}</legend>
      {/* At least 44 px a cell: 4 across below 360 px (6 rows), 6 from 360 px (4 rows). */}
      <div className="grid grid-cols-4 gap-1.5 min-[360px]:grid-cols-6">
        {AVATARS.map((option) => (
          <button
            key={option}
            type="button"
            aria-label={t('avatarOption', { emoji: option })}
            aria-pressed={avatar === option}
            onClick={() => onAvatar(option)}
            className={`wobbly grid aspect-square min-h-11 place-items-center border-[2.5px] text-[26px] leading-none focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-pen ${
              avatar === option ? 'border-ink bg-hl' : 'border-soft bg-paper'
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
