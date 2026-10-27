import React, { useEffect, useState } from "react";
import { classNames, useReducedMotionMedia } from "@/lib/motion";
import { ArrowUp } from "./Icons";

// A long board or ticket list scrolls the window, and the sticky top bar does
// not lead back to the project header. This appears once the page is a screen
// down. It stays mounted while hidden so it can fade, and takes itself out of
// the tab order and the accessibility tree instead.
export function BackToTop() {
  const reduce = useReducedMotionMedia();
  const [shown, setShown] = useState(false);

  useEffect(() => {
    // Only the boolean goes into state, so scrolling re-renders on the
    // threshold crossing rather than every frame.
    const onScroll = () => setShown(window.scrollY > window.innerHeight);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const toTop = () => {
    // The button hides once the page reaches the top, which would drop
    // keyboard focus onto <body>. Park it on <main> first.
    document.querySelector("main")?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <div className="fixed bottom-6 right-6 z-30">
      <button
        type="button"
        onClick={toTop}
        aria-label="Back to top"
        title="Back to top"
        aria-hidden={!shown}
        tabIndex={shown ? 0 : -1}
        data-testid="back-to-top"
        className={classNames(
          "grid h-[50px] w-[50px] place-items-center rounded-full bg-surface-raised text-fg shadow-hard",
          "transition-[opacity,transform,box-shadow] duration-150 hover:text-label",
          "active:translate-y-[2px] active:shadow-none motion-reduce:transition-none motion-reduce:active:translate-y-0",
          shown ? "opacity-100" : "pointer-events-none translate-y-2 opacity-0 motion-reduce:translate-y-0"
        )}
      >
        <ArrowUp />
      </button>
    </div>
  );
}

export default BackToTop;
