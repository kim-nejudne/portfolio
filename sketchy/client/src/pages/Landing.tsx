import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from '../lib/router.js';
import { createRoom, roomExists } from '../lib/api.js';
import { saveHostToken } from '../lib/hostTokens.js';
import { Highlight } from '../components/sketch/Highlight.js';
import { InkReplay } from '../components/sketch/InkReplay.js';
import { SketchButton } from '../components/sketch/SketchButton.js';
import { SpiralRings } from '../components/sketch/SpiralRings.js';
import { Tape } from '../components/sketch/Tape.js';

/** Room codes use these letters (no I, L or O); the server checks the code itself. */
const CODE_LETTERS = /[^ABCDEFGHJKMNPQRSTUVWXYZ]/g;
const CODE_LENGTH = 4;

/** What the code field keeps of what was typed or pasted: uppercased, code letters only, 4 at most. */
export function cleanCode(typed: string): string {
  return typed.toUpperCase().replace(CODE_LETTERS, '').slice(0, CODE_LENGTH);
}

/**
 * The landing page (UI by role and phase, Landing page; Sketchbook surfaces: Landing): **Join a
 * game** with a code, or **Start a game on this screen**, which creates a room, keeps its hostToken
 * on this device and opens the Screen. English only. A phone gets one column under spiral rings; a
 * laptop gets two, with a drawing that draws itself on under the logo.
 */
export function Landing() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  // Blocks a second POST from a fast double tap before `starting` re-renders the button.
  const startingRef = useRef(false);

  const join = async (e: FormEvent) => {
    e.preventDefault();
    if (code.length !== CODE_LENGTH) return;
    setChecking(true);
    // One refusal at a time: both together would push Start off a 360×560 phone.
    setJoinError(null);
    setStartError(null);
    try {
      const room = await roomExists(code);
      if (!room.exists) setJoinError('No game with that code. Check the TV.');
      else if (room.full) setJoinError('That game is full.');
      else navigate(`/play/${code}`);
    } catch (err) {
      setJoinError((err as Error).message);
    } finally {
      setChecking(false);
    }
  };

  const start = async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    setStarting(true);
    setStartError(null);
    setJoinError(null);
    try {
      const room = await createRoom();
      saveHostToken(room.code, room.hostToken);
      navigate(`/screen/${room.code}`);
    } catch (err) {
      setStartError((err as Error).message);
      startingRef.current = false;
      setStarting(false);
    }
  };

  return (
    <main className="paper-dots flex min-h-dvh flex-col bg-paper pb-[max(0.75rem,env(safe-area-inset-bottom))] font-hand text-ink lg:justify-center">
      <div className="pt-[env(safe-area-inset-top)] lg:hidden">
        <SpiralRings />
      </div>
      <div className="mx-auto grid w-full max-w-md gap-[clamp(12px,2.6dvh,26px)] pr-[max(18px,env(safe-area-inset-right))] pl-[max(18px,env(safe-area-inset-left))] lg:max-w-6xl lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-16 lg:px-20 lg:py-10">
        <header className="pt-[clamp(4px,1.2dvh,24px)] lg:pt-0">
          <h1 className="relative text-[clamp(48px,9dvh,64px)] leading-none font-normal lg:text-[clamp(72px,14dvh,120px)]">
            Sketchy
            {/* The pen scribble under the logo: decoration, so only it tilts. */}
            <span
              aria-hidden
              className="absolute right-2.5 -bottom-1.5 left-0 h-2.5 -rotate-[1.5deg] rounded-b-[60%_100%_40%_100%] border-b-4 border-pen"
            />
          </h1>
          <p className="mt-[clamp(6px,1.4dvh,16px)] text-[clamp(22px,4dvh,26px)] leading-tight lg:text-[clamp(28px,5dvh,40px)]">
            Draw it. Guess it. <Highlight>Laugh.</Highlight>
          </p>
          <div className="hidden lg:block">
            <InkReplay className="mt-6 size-[min(380px,42dvh)]" />
          </div>
        </header>

        <div className="grid gap-[clamp(16px,3dvh,26px)]">
          <form onSubmit={join} className="contents">
            <Card>
              <label htmlFor="code" className="text-[clamp(24px,4.4dvh,28px)] leading-tight">
                Join a game
              </label>
              <CodeCells code={code}>
                <input
                  id="code"
                  value={code}
                  onChange={(e) => {
                    setCode(cleanCode(e.target.value));
                    setJoinError(null);
                  }}
                  autoComplete="off"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  inputMode="text"
                  enterKeyHint="go"
                  aria-describedby="join-error"
                  // Transparent over the cells: it takes the taps, the typing and the focus, and
                  // the cells show what it holds. 16 px so iOS doesn't zoom in on focus.
                  className="absolute inset-0 size-full cursor-text bg-transparent text-[16px] text-transparent caret-transparent outline-none selection:bg-transparent"
                />
              </CodeCells>
              <div>
                <SketchButton
                  type="submit"
                  disabled={code.length !== CODE_LENGTH || checking}
                  className="w-full"
                >
                  Join
                </SketchButton>
                <ErrorLine id="join-error" text={joinError} />
              </div>
            </Card>
          </form>

          <Card alt>
            <h2 className="text-[clamp(24px,4.4dvh,28px)] leading-tight font-normal">
              Start a game on this screen
            </h2>
            <p className="text-base leading-snug text-soft">
              Use the device everyone can see: a laptop on the TV, a tablet, or a spare phone.
            </p>
            <div>
              <SketchButton variant="ghost" onClick={start} disabled={starting} className="w-full">
                Start
              </SketchButton>
              <ErrorLine text={startError} />
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}

/**
 * A refusal under its button, in `ink` after a red-pen ✗ (red text would miss 4.5:1 on the Start
 * card's wash). Always in the DOM, so screen readers announce it when text arrives; empty, it
 * takes no room.
 */
function ErrorLine({ id, text }: { id?: string; text: string | null }) {
  return (
    <p id={id} role="alert" className="text-lg leading-snug text-ink not-empty:mt-2">
      {text && (
        <>
          <span aria-hidden className="text-red">
            ✗{' '}
          </span>
          {text}
        </>
      )}
    </p>
  );
}

/** A landing card: paper (or a faint highlighter wash), an `ink` outline, a hard shadow, tape. */
function Card({ alt = false, children }: { alt?: boolean; children: ReactNode }) {
  return (
    <section
      className={`relative grid gap-[clamp(8px,1.6dvh,12px)] rounded-[3px] border-[2.5px] border-ink px-[clamp(16px,4vw,20px)] pt-[clamp(14px,2.8dvh,24px)] pb-[clamp(12px,2.4dvh,20px)] shadow-[4px_5px_0_var(--color-ink)] ${
        alt ? 'bg-[color-mix(in_srgb,var(--color-hl)_20%,var(--color-paper))]' : 'bg-paper'
      }`}
    >
      <Tape place="top" />
      {children}
    </section>
  );
}

/**
 * The code as 4 Nunito cells on `pen` underlines. The real input lies over them (its child), so
 * the cells are only a picture of its value: hidden from screen readers. While it has focus, the
 * cell the next letter goes into shows a blinking caret.
 */
export function CodeCells({ code, children }: { code: string; children: ReactNode }) {
  const next = Math.min(code.length, CODE_LENGTH - 1);
  return (
    <div className="group relative flex min-w-0 gap-[clamp(6px,2.4vw,10px)] rounded-sm outline-offset-4 outline-pen has-[input:focus-visible]:outline-2">
      {children}
      {Array.from({ length: CODE_LENGTH }, (_, i) => (
        <span
          key={i}
          aria-hidden
          data-code-cell
          className="pointer-events-none relative grid h-[clamp(44px,8dvh,62px)] min-w-0 flex-1 place-items-center border-b-4 border-pen font-num text-[clamp(28px,5.6dvh,36px)] leading-none font-black"
        >
          {code[i] ?? ''}
          {i === next && code.length < CODE_LENGTH && (
            <span className="absolute inset-y-[22%] left-1/2 hidden w-[3px] -translate-x-1/2 bg-pen group-has-[input:focus]:block motion-safe:animate-blink" />
          )}
        </span>
      ))}
    </div>
  );
}
