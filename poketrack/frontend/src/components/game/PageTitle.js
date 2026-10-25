import React from "react";

// The small uppercase label over a page title, the title, and an optional lede.
export function PageTitle({ label, children, testId, lede, as: Tag = "h1" }) {
  return (
    <div className="min-w-0">
      {label && <p className="font-body text-[13px] font-extrabold uppercase tracking-[0.07em] text-label">{label}</p>}
      <Tag className="mt-1 break-words font-display text-[40px] font-bold leading-[1.1] text-fg" data-testid={testId}>{children}</Tag>
      {lede && <p className="mt-2 max-w-2xl font-body text-[15px] text-muted">{lede}</p>}
    </div>
  );
}

export default PageTitle;
