import { useEffect } from 'react';
import { ScrollTrigger } from './gsapSetup';
import Nav from './components/Nav';
import Hero from './components/Hero';
import Premise from './components/Premise';
import Planner from './components/Planner';
import Blocks from './components/Blocks';
import LoadCurve from './components/LoadCurve';
import Session from './components/Session';
import Sunday from './components/Sunday';
import Evidence from './components/Evidence';
import Close from './components/Close';

export default function App() {
  useEffect(() => {
    document.fonts.ready.then(() => ScrollTrigger.refresh());
  }, []);

  return (
    <>
      <a
        href="#main"
        data-testid="skip-link"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:bg-ink focus:px-4 focus:py-2 focus:font-mono focus:text-xs focus:uppercase focus:tracking-[0.2em] focus:text-bone"
      >
        Skip to content
      </a>
      <Nav />
      <main id="main">
        <Hero />
        <Premise />
        <Planner />
        <Blocks />
        <LoadCurve />
        <Session />
        <Sunday />
        <Evidence />
        <Close />
      </main>
    </>
  );
}
