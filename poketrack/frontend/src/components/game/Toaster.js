import React from "react";

// Toast host.
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
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-[110] w-[min(560px,92vw)] -translate-x-1/2 space-y-2" role="status" aria-live="polite" data-testid="toaster">
      {items.map((it) => (
        <div key={it.id} className="pointer-events-auto animate-pop-in rounded-card bg-surface-raised px-5 py-4 shadow-hard-lg">
          <p className="font-body text-[15px] font-bold leading-snug text-fg">{it.text}</p>
        </div>
      ))}
    </div>
  );
}

export default Toaster;
