import React, { useEffect, useState } from "react";

// Pokémon-style dialogue box with optional typewriter effect and blinking arrow.
export function DialogueBox({ text, showArrow = true, className = "", testId = "dialogue-box", speed = 22 }) {
  const [shown, setShown] = useState("");
  useEffect(() => {
    setShown("");
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);
  return (
    <div className={`relative rounded-[14px] bg-[#F7F7FB] text-[#0B0D10] shadow-frameSm ring-2 ring-white/70 outline outline-4 outline-black outline-offset-2 ${className}`} data-testid={testId}>
      <div className="m-1 rounded-[10px] border-2 border-black/90 p-4">
        <p className="font-pixel text-[10px] leading-6 tracking-wide whitespace-pre-wrap">
          {shown}<span className="inline-block w-2 animate-typewriter-caret">|</span>
        </p>
        {showArrow && (
          <span className="absolute bottom-2 right-3 h-0 w-0 border-l-[7px] border-r-[7px] border-t-[9px] border-l-transparent border-r-transparent border-t-black/90 animate-dialogue-arrow-blink" />
        )}
      </div>
    </div>
  );
}

export default DialogueBox;
