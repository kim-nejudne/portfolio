import type { PlayerView } from '../../../../shared/types.js';
import type { Translate } from '../../lib/copy.js';
import { LeaveButton } from './LeaveButton.js';

/**
 * REVEAL, SCOREBOARD and FINAL on a phone (UI by role and phase, Guesser phone; the drawer's is the
 * same plus "+N for your drawing"). During REVEAL only this turn's points, never a rank; the rank
 * and score come with SCOREBOARD and FINAL, where the view carries them. Awards arrive with F50.
 */
export function PhoneStandings({
  view,
  onLeave,
  t,
}: {
  view: PlayerView;
  onLeave: () => void;
  t: Translate;
}) {
  const { me, turn, phase } = view;
  const wasDrawer = turn?.drawerPid === me.pid;
  // The next drawer's word is chosen (F21); it stays off this screen until the pad.
  const drawsNext = (phase === 'REVEAL' || phase === 'SCOREBOARD') && view.secret?.word != null;

  return (
    <div className="flex h-full flex-col items-center gap-4 overflow-y-auto px-4 pt-6 pb-3 text-center">
      {drawsNext && (
        <p className="rounded-2xl bg-[#FFD166] px-4 py-1 text-lg font-bold text-[#1D1B22]">
          <span aria-hidden="true">✏️</span> {t('youDrawNextReady')}
        </p>
      )}
      {phase === 'REVEAL' && turn && (
        <>
          <div>
            {turn.endReason === 'allGuessed' && (
              <p className="text-xl font-bold text-[#2DC653]">
                {t('everyoneGotIt')} <span aria-hidden="true">🎉</span>
              </p>
            )}
            <p className="text-xl text-white/70">{t('itWas')}</p>
          </div>
          <p className="font-display text-5xl leading-tight font-bold break-words">
            {turn.word ?? ''}
          </p>
          {wasDrawer ? (
            me.turnPoints > 0 && (
              <p className="text-2xl font-bold text-[#2DC653]">
                {t('yourDrawingPoints', { points: me.turnPoints })}
              </p>
            )
          ) : (
            <p className="text-2xl font-bold">{t('turnPoints', { points: me.turnPoints })}</p>
          )}
          <p className="text-lg text-white/70">{t('watchScreen')}</p>
        </>
      )}

      {phase === 'SCOREBOARD' && (
        <>
          <p className="text-xl text-white/70">
            {t('roundDone', {
              cycle: turn?.cycle ?? 1,
              cycles: view.settings.cycles,
            })}
          </p>
          {me.rank && (
            <p className="font-display text-6xl font-bold">
              {t('rankOf', { rank: me.rank.rank, of: me.rank.of })}
            </p>
          )}
          <p className="text-2xl">{t('points', { points: me.score ?? 0 })}</p>
        </>
      )}

      {phase === 'FINAL' && (
        <>
          <h1 className="font-display text-3xl font-bold">{t('finalTitle')}</h1>
          {me.rank && (
            <p className="font-display text-5xl leading-tight font-bold">
              {t('finalRank', { rank: me.rank.rank, of: me.rank.of })}
            </p>
          )}
          <p className="text-2xl">{t('points', { points: me.score ?? 0 })}</p>
          <p className="text-lg text-white/70">{t('seeGallery')}</p>
        </>
      )}

      <div className="mt-auto">
        <LeaveButton onLeave={onLeave} inGame={phase !== 'FINAL'} t={t} />
      </div>
    </div>
  );
}
