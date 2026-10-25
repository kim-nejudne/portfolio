import React, { useEffect, useState } from "react";
import { useReducedMotionMedia } from "@/lib/motion";

// A speech panel with an optional typewriter reveal and a blinking "more" arrow.
// The full text is always in the accessible name; only the visible copy types.
export function DialogueBox({ text, showArrow = true, className = "", testId = "dialogue-box", speed = 22 }) {
  const reduce = useReducedMotionMedia();
  const [shown, setShown] = useState("");
  useEffect(() => {
    if (reduce) { setShown(text); return undefined; }
    setShown("");
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, speed, reduce]);
  return (
    <div className={`relative rounded-hero bg-surface-raised p-5 pr-10 text-fg shadow-hard-lg ${className}`} data-testid={testId}>
      <p className="sr-only">{text}</p>
      <p className="whitespace-pre-wrap font-body text-[16px] font-semibold leading-relaxed" aria-hidden>
        {shown}<span className="ml-0.5 inline-block w-2 text-label animate-typewriter-caret">|</span>
      </p>
      {showArrow && (
        <span aria-hidden className="absolute bottom-4 right-4 h-0 w-0 border-l-[7px] border-r-[7px] border-t-[9px] border-l-transparent border-r-transparent border-t-[var(--label)] animate-dialogue-arrow-blink" />
      )}
    </div>
  );
}

export default DialogueBox;
