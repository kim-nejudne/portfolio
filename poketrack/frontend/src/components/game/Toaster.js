import React from "react";

// Toast host — uses Pokémon dialogue box styling.
let listeners = [];
let counter = 1;
export function pushToast(text, variant = "info") {
  const id = counter++;
  listeners.forEach((l) => l({ id, text, variant }));
  return id;
}

export function Toaster() {
  const [items, setItems] = React.useState([]);
  React.useEffect(() => {
    const cb = (item) => {
      setItems((s) => [...s, item]);
      setTimeout(() => setItems((s) => s.filter((x) => x.id !== item.id)), 3800);
    };
    listeners.push(cb);
    return () => { listeners = listeners.filter((x) => x !== cb); };
  }, []);
  return (
    <div className="fixed bottom-4 left-1/2 z-[110] w-[min(560px,92vw)] -translate-x-1/2 space-y-2 pointer-events-none" data-testid="toaster">
      {items.map((it) => (
        <div key={it.id} className="pointer-events-auto animate-level-up-slam">
          <div className={`relative rounded-[14px] bg-[#F7F7FB] text-[#0B0D10] outline outline-4 outline-black outline-offset-2 shadow-frame`}>
            <div className="m-1 rounded-[10px] border-2 border-black/90 p-3">
              <p className="font-pixel text-[10px] leading-5 tracking-wide">{it.text}</p>
              <span className="absolute bottom-2 right-3 h-0 w-0 border-l-[7px] border-r-[7px] border-t-[9px] border-l-transparent border-r-transparent border-t-black/90 animate-dialogue-arrow-blink" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default Toaster;
