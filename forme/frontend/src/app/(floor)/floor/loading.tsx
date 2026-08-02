export default function FloorLoading() {
  return (
    <main id="main" className="min-h-dvh bg-ink text-paper">
      <div className="flex items-baseline justify-between border-b-2 border-rule-ink px-[1.5vw] py-[1vh]">
        <p className="num font-semibold tracking-[0.2em] text-[clamp(1rem,1.6vw,2rem)]">
          FORME PRESS FLOOR
        </p>
        <p className="num text-muted-ink">READING PRESSES</p>
      </div>
      <div className="grid lg:grid-cols-3">
        {['XL75', 'G40', 'INDIGO'].map((id) => (
          <div key={id} className="border-t border-rule-ink px-6 py-6 lg:border-l lg:border-t-0">
            <p className="num text-[clamp(1.5rem,3vw,3rem)]">{id}</p>
            <div className="mt-6 space-y-3" aria-hidden="true">
              <div className="h-[clamp(2.25rem,6vw,7rem)] w-[70%] bg-rule-ink" />
              <div className="h-4 w-[40%] bg-rule-ink" />
              <div className="h-[clamp(2rem,5vw,5rem)] w-[55%] bg-rule-ink" />
              <div className="h-3 w-[60%] bg-rule-ink" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
