import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { pageMetaFor } from '../lib/pageMeta';

interface RouteAnnouncerProps {
  /** The <main> landmark, which receives focus after a route change. */
  mainRef: React.RefObject<HTMLElement | null>;
}

/**
 * A client-side route change swaps the entire page underneath the user without
 * any of the things a real navigation does: the title does not change, focus
 * stays wherever the clicked link was, the viewport keeps its scroll offset,
 * and a screen reader says nothing at all. All four are restored here.
 */
export const RouteAnnouncer: React.FC<RouteAnnouncerProps> = ({ mainRef }) => {
  const { pathname } = useLocation();
  const [announcement, setAnnouncement] = useState('');
  const isFirstRender = useRef(true);

  useEffect(() => {
    document.title = pageMetaFor(pathname).title;

    // On the first paint the browser has already done all of this itself.
    // Stealing focus or announcing here would fight it.
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    window.scrollTo(0, 0);
    mainRef.current?.focus();

    // Re-set on every change even when the label repeats: assigning the same
    // string to a live region is a no-op, so a trailing space would be needed
    // to force a re-announce. Distinct labels per route make that unnecessary.
    setAnnouncement(pageMetaFor(pathname).label);
  }, [pathname, mainRef]);

  return (
    <p aria-live="polite" aria-atomic="true" className="sr-only">
      {announcement}
    </p>
  );
};
