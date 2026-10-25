import React from "react";

// The three glyphs the ticket card needs, inlined rather than pulled from an
// icon package. The pixel face only carries Latin; ← → and the like fall
// through to the monospace stack and render as smudges at 9px (see the
// unicode-range note in index.css). An SVG stroke scales cleanly, takes
// currentColor, and costs no dependency — this app has no component library
// on purpose. Paths are lucide's (ISC), 24-unit grid.
function Icon({ children, className = "h-3.5 w-3.5", ...rest }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...rest}
    >
      {children}
    </svg>
  );
}

export const ChevronLeft = (props) => (
  <Icon {...props}>
    <path d="m15 18-6-6 6-6" />
  </Icon>
);

export const ChevronRight = (props) => (
  <Icon {...props}>
    <path d="m9 18 6-6-6-6" />
  </Icon>
);

export const GripVertical = (props) => (
  <Icon {...props}>
    <circle cx="9" cy="5" r="1.25" fill="currentColor" stroke="none" />
    <circle cx="9" cy="12" r="1.25" fill="currentColor" stroke="none" />
    <circle cx="9" cy="19" r="1.25" fill="currentColor" stroke="none" />
    <circle cx="15" cy="5" r="1.25" fill="currentColor" stroke="none" />
    <circle cx="15" cy="12" r="1.25" fill="currentColor" stroke="none" />
    <circle cx="15" cy="19" r="1.25" fill="currentColor" stroke="none" />
  </Icon>
);
