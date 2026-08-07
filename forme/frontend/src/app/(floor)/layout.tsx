import { GateNotice, SkipLink } from '@/components/shell/chrome';
import { getSession } from '@/lib/api/session';

export default async function FloorLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const allowed = session.role === 'floor' || session.role === 'admin' || session.role === 'prepress';

  if (!allowed) {
    return (
      <div className="min-h-dvh bg-paper">
        <SkipLink />
        <GateNotice
          surface="The floor board"
          required="floor"
          current={session.role}
          explanation="The board is furniture in a room, not a page to browse. It is shown on the press floor screens and needs a floor, prepress or admin session."
        />
      </div>
    );
  }

  return <>{children}</>;
}
