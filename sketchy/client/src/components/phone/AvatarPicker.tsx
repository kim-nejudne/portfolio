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
      <legend className="mb-2 text-lg font-semibold">{t('yourAvatar')}</legend>
      {/* At least 44 px a cell: 4 across below 360 px (6 rows), 6 from 360 px (4 rows). */}
      <div className="grid grid-cols-4 gap-1.5 min-[360px]:grid-cols-6">
        {AVATARS.map((option) => (
          <button
            key={option}
            type="button"
            aria-label={t('avatarOption', { emoji: option })}
            aria-pressed={avatar === option}
            onClick={() => onAvatar(option)}
            className={`grid aspect-square min-h-11 place-items-center rounded-xl border-2 text-[26px] leading-none ${
              avatar === option ? 'border-[#FF6B35] bg-[#FF6B35]/25' : 'border-white/15 bg-white/5'
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
