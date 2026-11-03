// `/dev/sketch`: every Sketchbook primitive (F56) on one page, to set beside the mockup
// (docs/design/sketchbook.html) while M12 restyles the app. App.tsx registers this route only in
// development builds, and the page is its own lazy chunk.

import { AVATARS, CHOOSE_MS, PLAYER_COLORS } from '../../../shared/constants.js';
import { Avatar } from '../components/Avatar.js';
import { Blanks } from '../components/sketch/Blanks.js';
import { CountdownRing } from '../components/sketch/CountdownRing.js';
import { Paper } from '../components/sketch/Paper.js';
import { SketchButton } from '../components/sketch/SketchButton.js';
import { SpiralRings } from '../components/sketch/SpiralRings.js';
import { Tape } from '../components/sketch/Tape.js';
import { Tagline } from './Landing.js';

export default function DevSketch() {
  return (
    <main className="min-h-dvh bg-desk p-4 font-hand text-ink">
      <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
        <Paper variant="dots" className="relative overflow-hidden" data-sheet="dots">
          <SpiralRings />
          <div className="flex flex-col gap-4 px-[22px] pt-2 pb-6">
            <h1 className="text-[30px] leading-tight">
              <Tagline />
            </h1>
            <p className="text-soft">Dot-grid paper, Patrick Hand, one weight.</p>
            <p className="font-num text-[40px] leading-none font-black">0123456789 KPRW</p>
            <div className="flex flex-wrap gap-3">
              <SketchButton>Join</SketchButton>
              <SketchButton variant="ghost">Start</SketchButton>
              <SketchButton disabled>Busy</SketchButton>
            </div>
            <SketchButton full>Start game</SketchButton>
            <div className="flex items-center gap-4">
              <CountdownRing remainingMs={10_000} totalMs={CHOOSE_MS} choosing size="58px" />
              <CountdownRing remainingMs={47_000} totalMs={60_000} size="64px" />
              <CountdownRing remainingMs={8_000} totalMs={60_000} size="64px" />
            </div>
          </div>
        </Paper>

        <Paper variant="ruled" className="relative overflow-hidden" data-sheet="ruled">
          <SpiralRings />
          <div className="flex flex-col gap-4 pt-2 pr-[22px] pb-6 pl-[62px]">
            <p className="text-[22px]">Ruled paper, text right of the margin.</p>
            <div className="text-[25px]">
              <Blanks mask={[...'b__n____a']} label="6 letters to guess, hints: b, n, a" />
            </div>
            <div className="text-[40px]">
              <Blanks mask={[...'_____ ____']} label="9 letters to guess" size="40px" />
            </div>
            <div className="w-40 text-[40px]">
              <Blanks mask={[...'__________ _____']} label="15 letters to guess" size="40px" />
            </div>
            <ul className="flex flex-wrap gap-2" aria-label="Player colors">
              {PLAYER_COLORS.map((color, i) => (
                <li key={color} className="flex items-center gap-1 text-[18px]" style={{ color }}>
                  <Avatar player={{ color, avatar: AVATARS[i]! }} size="34px" />
                  {color}
                </li>
              ))}
            </ul>
            <div className="flex items-end gap-3">
              <Avatar player={{ color: PLAYER_COLORS[0], avatar: '🦊' }} size="64px" />
              <Avatar player={{ color: PLAYER_COLORS[2], avatar: '🐙' }} size="132px" />
            </div>
          </div>
        </Paper>

        <div className="relative bg-paper p-6 shadow-[6px_7px_0_var(--color-ink)]">
          <Tape place="tl" />
          <Tape place="tr" />
          <Tape place="top" />
          <div className="aspect-square bg-canvas" />
        </div>

        <p className="relative justify-self-center px-4 py-1 font-num text-lg font-black">
          <Tape place="wide" />
          <span className="relative z-[4]">sketchy.kimnejudne.dev · KPRW</span>
        </p>

        <div className="flex h-64 border-2 border-ink bg-paper">
          <div className="flex-1" />
          <SpiralRings direction="column" count={8} />
          <div className="flex-1" />
        </div>
      </div>
    </main>
  );
}
