import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import type { PhotoCredit } from '#shared/types.js';
import { Photo } from '../components/Photo.js';
import { NETWORK_ERROR } from './Landing.js';

export const NO_CREDITS = 'No photos revealed yet';
export const GAME_ENDED = 'This game has ended';

const LINK =
  'inline-flex min-h-12 items-center font-semibold text-text underline underline-offset-4 [@media(hover:hover)]:hover:text-amber';

/** Only an https address becomes a link (never a `javascript:` one). */
const https = (url: string) => (url.startsWith('https://') ? url : undefined);

type State = { credits: PhotoCredit[] } | { error: string } | null;

/** `/credits/:code`: the photos of the room's revealed rounds (spec: Photos and credits). */
export function Credits() {
  const code = useParams().code ?? '';
  const [state, setState] = useState<State>(null);

  useEffect(() => {
    let live = true;
    fetch(`/api/credits/${encodeURIComponent(code)}`)
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as {
          credits: PhotoCredit[];
          error?: string;
        } | null;
        if (res.ok && body) return { credits: body.credits };
        if (res.status === 404) return { error: GAME_ENDED };
        return { error: typeof body?.error === 'string' ? body.error : NETWORK_ERROR };
      })
      .catch(() => ({ error: NETWORK_ERROR }))
      .then((next) => live && setState(next));
    return () => {
      live = false;
    };
  }, [code]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <h1 className="board-face text-3xl text-amber">Photo credits</h1>
      {state === null && (
        <p role="status" className="text-lg text-text-dim">
          Loading…
        </p>
      )}
      {state && 'error' in state && (
        <p role="alert" className="text-lg text-text">
          {state.error}
        </p>
      )}
      {state && 'credits' in state && state.credits.length === 0 && (
        <p role="status" className="text-lg text-text">
          {NO_CREDITS}
        </p>
      )}
      {state && 'credits' in state && state.credits.length > 0 && (
        <ul className="flex flex-col gap-4">
          {state.credits.map((c) => (
            <li
              key={c.thumbUrl}
              className="flex min-w-0 gap-4 rounded-card border border-line bg-board-panel p-4"
            >
              <Photo
                src={c.thumbUrl}
                alt={c.name}
                className="h-24 w-32 shrink-0 bg-board-bg object-contain"
                fallback={
                  <p className="flex h-24 w-32 shrink-0 items-center justify-center border border-line text-center text-sm text-text-dim">
                    Photo unavailable
                  </p>
                }
              />
              <div className="flex min-w-0 flex-col">
                <h2 className="text-lg font-bold text-text">{c.name}</h2>
                <p className="break-words text-text-dim">{c.author}</p>
                <p className="flex flex-wrap gap-x-4">
                  <a href={https(c.licenceUrl)} target="_blank" rel="noreferrer" className={LINK}>
                    {c.licence}
                  </a>
                  <a
                    href={https(c.sourceUrl)}
                    target="_blank"
                    rel="noreferrer"
                    className={`${LINK} break-all`}
                  >
                    {c.commonsFile}
                  </a>
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
