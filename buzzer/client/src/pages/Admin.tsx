import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { AdminCategories } from '../components/AdminCategories.js';
import { useDesktopLayout } from '../lib/useMediaQuery.js';

/**
 * `/admin` inside `AdminLayout` (F105, F111, F119), for the signed-in admin. On a phone it is the
 * category list. From `lg` the list has its own pane, and this fills the detail pane until a
 * category is chosen.
 */
export function Admin() {
  const desktop = useDesktopLayout();
  const navigate = useNavigate();
  const location = useLocation();
  // "<name> is live: N sets published.", handed over by the category review's Publish (F116).
  const [published] = useState<string | null>(() => {
    const text = (location.state as { published?: unknown } | null)?.published;
    return typeof text === 'string' ? text : null;
  });

  // Shown once: a reload or Back to this entry no longer repeats it.
  useEffect(() => {
    if (published !== null) void navigate('/admin', { replace: true, state: null });
  }, [published, navigate]);

  const notice = published !== null && (
    <p className="rounded-[20px] border-2 border-win bg-surface p-4 text-lg font-bold text-win">
      {published}
    </p>
  );

  if (desktop) {
    return (
      <>
        <h1 className="font-display text-3xl">Admin</h1>
        {notice}
        <p className="text-lg text-muted">Choose a category on the left, or add one.</p>
      </>
    );
  }
  return (
    <>
      <h1 className="sr-only">Admin</h1>
      {notice}
      <AdminCategories />
    </>
  );
}
