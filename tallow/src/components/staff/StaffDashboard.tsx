import React, { useCallback, useId, useMemo, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AlertTriangle, Eye } from 'lucide-react';
import { MenuItem } from '../../types';
import { Role, ReadOnlyError, SessionExpiredError, getRole } from '../../lib/session';
import { StaffSessionProvider } from './StaffSessionContext';
import { useStaffData } from './useStaffData';
import { StaffSignIn } from './StaffSignIn';
import { CoversPanel } from './CoversPanel';
import { ReservationsPanel } from './ReservationsPanel';
import { Board86Panel } from './Board86Panel';
import { MenuManagerPanel } from './MenuManagerPanel';

interface StaffDashboardProps {
  authenticated: boolean;
  onAuthenticate: (token: string) => void;
  onSignOut: () => void;
  onMenuUpdated: () => void;
  menuItems: MenuItem[];
}

const TABS = [
  { to: '/staff/covers', label: 'Covers & Sittings', activeClass: 'bg-[#1A1715] border-[#1A1715]' },
  { to: '/staff/reservations', label: 'Keyboard Reservations Table', activeClass: 'bg-[#1A1715] border-[#1A1715]' },
  { to: '/staff/86board', label: '86 Board (Live Guest Sync)', activeClass: 'bg-[#7A2322] border-[#7A2322]' },
  { to: '/staff/menucrud', label: 'Menu Manager & Dish of Day', activeClass: 'bg-[#1A1715] border-[#1A1715]' },
] as const;

export const StaffDashboard: React.FC<StaffDashboardProps> = ({
  authenticated,
  onAuthenticate,
  onSignOut,
  onMenuUpdated,
  menuItems,
}) => {
  const currentPath = useLocation().pathname;
  const fieldId = useId();

  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [role, setRole] = useState<Role | null>(getRole());
  const [actionError, setActionError] = useState<string | null>(null);

  const readOnly = role === 'demo';

  const reportActionError = useCallback((err: unknown, fallback: string) => {
    if (err instanceof ReadOnlyError) setActionError(err.message);
    else if (err instanceof SessionExpiredError) {
      setRole(null);
      setActionError(err.message);
    } else {
      console.error(fallback, err);
      setActionError(fallback);
    }
  }, []);

  const { summary, reservations, loading, refresh } = useStaffData({
    authenticated,
    selectedDate,
    onError: reportActionError,
  });

  const session = useMemo(
    () => ({
      role,
      readOnly,
      writeProps: readOnly
        ? ({ disabled: true, title: 'Disabled in the read-only preview' } as const)
        : {},
      writeClass: readOnly ? ' opacity-40 cursor-not-allowed' : '',
      reportActionError,
    }),
    [role, readOnly, reportActionError]
  );

  if (!authenticated) {
    return (
      <StaffSignIn
        onAuthenticated={(token, signedInRole) => {
          setRole(signedInRole);
          onAuthenticate(token);
        }}
      />
    );
  }

  return (
    <StaffSessionProvider value={session}>
      <div className="max-w-6xl mx-auto py-8 px-4 sm:px-8">

        {readOnly && (
          <div
            className="flex items-start gap-3 mb-6 p-3 border border-[#8C6E43] bg-[#EFE6D5] text-[#5C4A2E]"
            role="status"
          >
            <Eye className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
            <p className="text-[11px] font-mono-data leading-relaxed">
              <span className="font-bold uppercase tracking-wider">Read-only preview.</span>{' '}
              Every number below is live — cover maths, sitting loads, the 86 board. Writes are
              disabled so the public demo stays intact.
            </p>
          </div>
        )}

        {actionError && (
          <div
            className="flex items-start gap-3 mb-6 p-3 border border-[#7A2322] bg-[#7A2322]/10 text-[#7A2322]"
            role="alert"
          >
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
            <p className="text-[11px] font-mono-data leading-relaxed flex-1">{actionError}</p>
            <button
              type="button"
              onClick={() => setActionError(null)}
              className="text-[10px] font-mono-data uppercase tracking-wider underline shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Staff Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b-2 border-[#1A1715] pb-4 mb-6 gap-4">
          <div>
            <span className="font-mono-data text-[10px] uppercase tracking-[0.25em] text-[#7A2322] font-bold">
              {readOnly ? 'Read-Only Session' : 'Service Control Active'}
            </span>
            <h1 className="font-display text-3xl text-[#1A1715]">STAFF SERVICE CONSOLE</h1>
            <button
              type="button"
              onClick={() => { setRole(null); onSignOut(); }}
              className="mt-1 text-[10px] font-mono-data uppercase tracking-wider text-[#6B635A] hover:text-[#7A2322] underline"
            >
              Sign out
            </button>
          </div>

          <div className="flex items-center space-x-3">
            <label htmlFor={`${fieldId}-service-date`} className="sr-only">
              Service date
            </label>
            <input
              id={`${fieldId}-service-date`}
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-1.5 bg-[#EFE6D5] border border-[#38322D] font-mono-data text-xs text-[#1A1715]"
            />
            <span className="text-xs font-mono-data bg-[#7A2322] text-[#F7F4EE] px-2 py-1">
              Service Active
            </span>
          </div>
        </div>

        {/* Staff Sub-Tabs */}
        <nav aria-label="Staff console sections" className="flex flex-wrap gap-2 border-b border-[#DDD6C8] pb-4 mb-8 text-xs font-mono-data uppercase tracking-wider">
          {TABS.map(({ to, label, activeClass }) => {
            const isCurrent = currentPath.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                aria-current={isCurrent ? 'page' : undefined}
                className={`px-4 py-2 border transition-colors ${
                  isCurrent
                    ? `${activeClass} text-[#F7F4EE]`
                    : 'bg-[#EFE6D5] text-[#1A1715] border-[#DDD6C8] hover:border-[#1A1715]'
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <Routes>
          <Route path="/" element={<Navigate to="/staff/covers" replace />} />
          <Route
            path="covers"
            element={<CoversPanel selectedDate={selectedDate} summary={summary} loading={loading} />}
          />
          <Route
            path="reservations"
            element={
              <ReservationsPanel
                reservations={reservations}
                selectedDate={selectedDate}
                loading={loading}
                onChanged={refresh}
              />
            }
          />
          <Route
            path="86board"
            element={<Board86Panel menuItems={menuItems} onMenuUpdated={onMenuUpdated} />}
          />
          <Route
            path="menucrud"
            element={<MenuManagerPanel menuItems={menuItems} onMenuUpdated={onMenuUpdated} />}
          />
          <Route path="*" element={<Navigate to="/staff/covers" replace />} />
        </Routes>

      </div>
    </StaffSessionProvider>
  );
};
