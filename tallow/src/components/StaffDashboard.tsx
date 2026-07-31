import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link, Routes, Route, Navigate } from 'react-router-dom';
import { MenuItem, Reservation, CoverSummary, ReservationStatus } from '../types';
import { adminFetch, getRole, setSession, ReadOnlyError, SessionExpiredError } from '../lib/session';
import { Key, AlertTriangle, Plus, Trash2, Edit2, Search, Check, Flame, Users, Calendar, Filter, Command, Eye } from 'lucide-react';

interface StaffDashboardProps {
  authenticated: boolean;
  onAuthenticate: (token: string) => void;
  onSignOut: () => void;
  onMenuUpdated: () => void;
  menuItems: MenuItem[];
}

export const StaffDashboard: React.FC<StaffDashboardProps> = ({
  authenticated,
  onAuthenticate,
  onSignOut,
  onMenuUpdated,
  menuItems,
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Auth state
  const [pin, setPin] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  // Summary & Reservations data
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [summary, setSummary] = useState<CoverSummary | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Table filter & Keyboard Navigation
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [focusedRowIndex, setFocusedRowIndex] = useState<number>(0);
  const filterInputRef = useRef<HTMLInputElement>(null);

  // Menu Edit Modal State
  const [editingItem, setEditingItem] = useState<Partial<MenuItem> | null>(null);
  const [isNewItem, setIsNewItem] = useState(false);

  // A demo session may read the dashboard but not change anything; the server
  // enforces this, and the UI mirrors it so nothing looks broken when it refuses.
  const [role, setRole] = useState<'staff' | 'demo' | null>(getRole());
  const [actionError, setActionError] = useState<string | null>(null);
  const [demoPin, setDemoPin] = useState<string | null>(null);
  const readOnly = role === 'demo';
  // One place to express "this control writes", so a read-only session cannot
  // fire it and it visibly reads as unavailable rather than broken.
  const writeProps = readOnly
    ? { disabled: true, title: 'Disabled in the read-only preview' }
    : {};
  const writeClass = readOnly ? ' opacity-40 cursor-not-allowed' : '';

  // Surfaces a refused write, rather than logging it where nobody looks.
  const reportActionError = (err: unknown, fallback: string) => {
    if (err instanceof ReadOnlyError) setActionError(err.message);
    else if (err instanceof SessionExpiredError) { setRole(null); setActionError(err.message); }
    else { console.error(fallback, err); setActionError(fallback); }
  };

  // Fetch staff data
  const fetchStaffData = async () => {
    setLoadingData(true);
    try {
      const res = await adminFetch(`/api/admin/reservations?date=${selectedDate}`);
      const data = await res.json();
      if (data.summary) setSummary(data.summary);
      if (data.reservations) setReservations(data.reservations);
    } catch (err) {
      reportActionError(err, 'Failed to load staff data.');
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (authenticated) {
      fetchStaffData();
    }
  }, [authenticated, selectedDate]);

  // The demo PIN is served by the API rather than compiled into the bundle, so
  // rotating it does not require a rebuild.
  useEffect(() => {
    if (authenticated) return;
    let cancelled = false;
    fetch('/api/admin/demo-hint')
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setDemoPin(d.demoPin ?? null); })
      .catch(() => { /* hint is optional */ });
    return () => { cancelled = true; };
  }, [authenticated]);

  // Handle PIN authentication
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSession(data.token, data.role);
        setRole(data.role);
        onAuthenticate(data.token);
      } else {
        setAuthError(data.error || 'Invalid PIN code.');
      }
    } catch (err) {
      setAuthError('Authentication service error.');
    }
  };

  // 86 Board Toggle
  const handleToggle86 = async (menuItemId: string, current86: boolean) => {
    try {
      const res = await adminFetch('/api/admin/86', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menuItemId, is86: !current86 }),
      });
      if (res.ok) {
        setActionError(null);
        onMenuUpdated();
      }
    } catch (err) {
      reportActionError(err, 'Failed to toggle 86 status.');
    }
  };

  // Set Dish of the Day
  const handleSetDishOfDay = async (menuItemId: string) => {
    try {
      const res = await adminFetch('/api/admin/dish-of-the-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menuItemId }),
      });
      if (res.ok) {
        onMenuUpdated();
      }
    } catch (err) {
      reportActionError(err, 'Failed to set dish of the day.');
    }
  };

  // Inline Status Change for Reservations
  const handleStatusChange = async (resvId: string, newStatus: ReservationStatus) => {
    try {
      const res = await adminFetch(`/api/admin/reservations/${resvId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchStaffData();
      }
    } catch (err) {
      reportActionError(err, 'Failed to update reservation status.');
    }
  };

  // Save Menu Item (CRUD)
  const handleSaveMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    try {
      const res = await adminFetch('/api/admin/menu/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingItem),
      });
      if (res.ok) {
        setEditingItem(null);
        onMenuUpdated();
      }
    } catch (err) {
      reportActionError(err, 'Failed to save menu item.');
    }
  };

  // Delete Menu Item
  const handleDeleteMenuItem = async (id: string) => {
    if (!confirm('Permanently remove this dish from menu database?')) return;
    try {
      const res = await adminFetch(`/api/admin/menu/${id}`, { method: 'DELETE' });
      if (res.ok) {
        onMenuUpdated();
      }
    } catch (err) {
      reportActionError(err, 'Failed to delete menu item.');
    }
  };

  // Filtered reservations for keyboard table
  const filteredReservations = reservations.filter((r) => {
    const matchesDate = r.date === selectedDate;
    const matchesSearch =
      r.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      r.token.toLowerCase().includes(searchFilter.toLowerCase()) ||
      r.phone.includes(searchFilter) ||
      r.email.toLowerCase().includes(searchFilter.toLowerCase());
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;

    return matchesDate && matchesSearch && matchesStatus;
  });

  // Keyboard Shortcuts Handler (j / k / / / 1-4)
  useEffect(() => {
    if (!authenticated || !location.pathname.includes('/reservations')) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in filter input
      if (document.activeElement === filterInputRef.current) {
        if (e.key === 'Escape') {
          filterInputRef.current?.blur();
        }
        return;
      }

      if (e.key === '/') {
        e.preventDefault();
        filterInputRef.current?.focus();
        return;
      }

      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedRowIndex((prev) => Math.min(prev + 1, Math.max(0, filteredReservations.length - 1)));
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedRowIndex((prev) => Math.max(0, prev - 1));
      } else if (filteredReservations[focusedRowIndex]) {
        const target = filteredReservations[focusedRowIndex];
        if (e.key === '1') {
          handleStatusChange(target.id, 'seated');
        } else if (e.key === '2') {
          handleStatusChange(target.id, 'confirmed');
        } else if (e.key === '3') {
          handleStatusChange(target.id, 'completed');
        } else if (e.key === '4') {
          handleStatusChange(target.id, 'cancelled');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [authenticated, location.pathname, filteredReservations, focusedRowIndex]);

  // Auth Gate
  if (!authenticated) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 border-2 border-[#1A1715] bg-[#F7F4EE]">
        <div className="text-center mb-6">
          <div className="w-10 h-10 bg-[#7A2322] text-[#F7F4EE] flex items-center justify-center mx-auto mb-3">
            <Key className="w-5 h-5" />
          </div>
          <h2 className="font-display text-2xl text-[#1A1715]">STAFF SERVICE PORTAL</h2>
          <p className="font-serif-body text-xs text-[#6B635A] italic mt-1">
            Back-of-house cover dashboard & 86 board control
          </p>
        </div>

        {authError && (
          <div className="mb-4 p-3 bg-[#7A2322]/10 border border-[#7A2322] text-[#7A2322] text-xs font-mono-data">
            {authError}
          </div>
        )}

        <form onSubmit={handleAuthSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono-data uppercase tracking-wider text-[#1A1715] mb-1">
              Staff Security PIN
            </label>
            <input
              type="password"
              required
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Enter staff PIN"
              className="w-full px-3 py-2 bg-[#EFE6D5] border border-[#38322D] font-mono-data text-sm text-[#1A1715] focus:outline-none"
            />
            {demoPin && (
              <p className="text-[10px] font-mono-data text-[#8C6E43] mt-1 leading-relaxed">
                Viewing this as a portfolio piece? Use <code className="font-bold">{demoPin}</code> for a
                read-only tour of the back of house — the 86 board and cover maths are live, but changes are disabled.
              </p>
            )}
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-[#1A1715] hover:bg-[#7A2322] text-[#F7F4EE] text-xs font-sans-ui uppercase tracking-widest transition-colors"
          >
            Authenticate Service Access
          </button>
        </form>
      </div>
    );
  }

  const currentPath = location.pathname;

  return (
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
          <h2 className="font-display text-3xl text-[#1A1715]">STAFF SERVICE CONSOLE</h2>
          <button
            onClick={() => { setRole(null); onSignOut(); }}
            className="mt-1 text-[10px] font-mono-data uppercase tracking-wider text-[#6B635A] hover:text-[#7A2322] underline"
          >
            Sign out
          </button>
        </div>

        <div className="flex items-center space-x-3">
          <input
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
      <div className="flex flex-wrap gap-2 border-b border-[#DDD6C8] pb-4 mb-8 text-xs font-mono-data uppercase tracking-wider">
        <Link
          to="/staff/covers"
          className={`px-4 py-2 border transition-colors ${
            currentPath.includes('/staff/covers')
              ? 'bg-[#1A1715] text-[#F7F4EE] border-[#1A1715]'
              : 'bg-[#EFE6D5] text-[#1A1715] border-[#DDD6C8] hover:border-[#1A1715]'
          }`}
        >
          Covers & Sittings
        </Link>
        <Link
          to="/staff/reservations"
          className={`px-4 py-2 border transition-colors ${
            currentPath.includes('/staff/reservations')
              ? 'bg-[#1A1715] text-[#F7F4EE] border-[#1A1715]'
              : 'bg-[#EFE6D5] text-[#1A1715] border-[#DDD6C8] hover:border-[#1A1715]'
          }`}
        >
          Keyboard Reservations Table
        </Link>
        <Link
          to="/staff/86board"
          className={`px-4 py-2 border transition-colors ${
            currentPath.includes('/staff/86board')
              ? 'bg-[#7A2322] text-[#F7F4EE] border-[#7A2322]'
              : 'bg-[#EFE6D5] text-[#1A1715] border-[#DDD6C8] hover:border-[#1A1715]'
          }`}
        >
          86 Board (Live Guest Sync)
        </Link>
        <Link
          to="/staff/menucrud"
          className={`px-4 py-2 border transition-colors ${
            currentPath.includes('/staff/menucrud')
              ? 'bg-[#1A1715] text-[#F7F4EE] border-[#1A1715]'
              : 'bg-[#EFE6D5] text-[#1A1715] border-[#DDD6C8] hover:border-[#1A1715]'
          }`}
        >
          Menu Manager & Dish of Day
        </Link>
      </div>

      <Routes>
        <Route path="/" element={<Navigate to="/staff/covers" replace />} />
        
        {/* TAB 1: Covers & Sittings at a Glance */}
        <Route path="covers" element={
          <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="p-5 bg-[#F7F4EE] border border-[#DDD6C8]">
                <span className="text-[10px] font-mono-data uppercase text-[#6B635A] block">Date</span>
                <span className="font-display text-2xl text-[#1A1715]">{selectedDate}</span>
              </div>
              <div className="p-5 bg-[#F7F4EE] border border-[#DDD6C8]">
                <span className="text-[10px] font-mono-data uppercase text-[#6B635A] block">Total Booked Covers</span>
                <span className="font-display text-3xl text-[#7A2322]">
                  {summary?.totalCovers || 0}
                </span>
              </div>
              <div className="p-5 bg-[#F7F4EE] border border-[#DDD6C8]">
                <span className="text-[10px] font-mono-data uppercase text-[#6B635A] block">Total Parties</span>
                <span className="font-display text-3xl text-[#1A1715]">
                  {summary?.totalReservations || 0}
                </span>
              </div>
              <div className="p-5 bg-[#F7F4EE] border border-[#DDD6C8]">
                <span className="text-[10px] font-mono-data uppercase text-[#6B635A] block">Cap Capacity</span>
                <span className="font-display text-2xl text-[#8C6E43]">
                  16 Covers / Sitting
                </span>
              </div>
            </div>

            {/* Sittings breakdown bar */}
            <div className="insert-stock p-6 border border-[#38322D]/20 space-y-4">
              <h3 className="font-display text-2xl text-[#1A1715]">Sitting Windows Summary</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono-data">
                <div className="p-4 bg-[#F7F4EE] border border-[#DDD6C8]">
                  <span className="text-[#8C6E43] uppercase block font-bold">Early Sitting (17:00 – 18:30)</span>
                  <span className="text-2xl font-display text-[#1A1715] mt-1 block">
                    {summary?.sittingCounts.early || 0} Covers
                  </span>
                </div>

                <div className="p-4 bg-[#F7F4EE] border border-[#DDD6C8]">
                  <span className="text-[#7A2322] uppercase block font-bold">Prime Sitting (18:30 – 20:30)</span>
                  <span className="text-2xl font-display text-[#7A2322] mt-1 block">
                    {summary?.sittingCounts.prime || 0} Covers
                  </span>
                </div>

                <div className="p-4 bg-[#F7F4EE] border border-[#DDD6C8]">
                  <span className="text-[#8C6E43] uppercase block font-bold">Late Sitting (20:30 – 22:30)</span>
                  <span className="text-2xl font-display text-[#1A1715] mt-1 block">
                    {summary?.sittingCounts.late || 0} Covers
                  </span>
                </div>
              </div>
            </div>
          </div>
        } />

        {/* TAB 2: Dense Keyboard-Navigable Reservations Table */}
        <Route path="reservations" element={
          <div className="space-y-4">
            
            {/* Keyboard Shortcuts Hint Bar */}
            <div className="p-3 bg-[#1A1715] text-[#F7F4EE] text-xs font-mono-data flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center space-x-4">
                <span><kbd className="px-1.5 py-0.5 bg-[#7A2322] text-[#F7F4EE]">j</kbd> / <kbd className="px-1.5 py-0.5 bg-[#7A2322] text-[#F7F4EE]">k</kbd> Navigate Rows</span>
                <span><kbd className="px-1.5 py-0.5 bg-[#7A2322] text-[#F7F4EE]">/</kbd> Focus Filter</span>
                <span>Shortcuts: <kbd className="px-1.5 py-0.5 bg-[#38322D]">1</kbd> Seated · <kbd className="px-1.5 py-0.5 bg-[#38322D]">2</kbd> Confirmed · <kbd className="px-1.5 py-0.5 bg-[#38322D]">3</kbd> Completed · <kbd className="px-1.5 py-0.5 bg-[#38322D]">4</kbd> Cancelled</span>
              </div>
              <span className="text-[#8C6E43]">{filteredReservations.length} Bookings Shown</span>
            </div>

            {/* Search and Status Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#6B635A]" />
                <input
                  ref={filterInputRef}
                  type="text"
                  placeholder="Press / to filter by name, phone, email, token..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-[#EFE6D5] border border-[#38322D] font-mono-data text-xs text-[#1A1715] focus:outline-none"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-[#EFE6D5] border border-[#38322D] font-mono-data text-xs text-[#1A1715]"
              >
                <option value="all">All Statuses</option>
                <option value="confirmed">Confirmed</option>
                <option value="seated">Seated</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            {/* Dense Table */}
            <div className="overflow-x-auto border border-[#38322D]">
              <table className="w-full text-left font-mono-data text-xs border-collapse">
                <thead>
                  <tr className="bg-[#1A1715] text-[#F7F4EE] border-b border-[#38322D] uppercase tracking-wider text-[10px]">
                    <th className="p-2.5">Time</th>
                    <th className="p-2.5">Token</th>
                    <th className="p-2.5">Guest Name</th>
                    <th className="p-2.5 text-center">Party</th>
                    <th className="p-2.5">Phone / Contact</th>
                    <th className="p-2.5">Notes</th>
                    <th className="p-2.5">Status</th>
                    <th className="p-2.5 text-right">Quick Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DDD6C8]">
                  {filteredReservations.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-[#6B635A] italic">
                        No reservations found matching filter criteria for {selectedDate}.
                      </td>
                    </tr>
                  ) : (
                    filteredReservations.map((resv, idx) => {
                      const isFocused = idx === focusedRowIndex;
                      return (
                        <tr
                          key={resv.id}
                          onClick={() => setFocusedRowIndex(idx)}
                          className={`transition-colors cursor-pointer ${
                            isFocused
                              ? 'bg-[#1A1715] text-[#F7F4EE]'
                              : resv.status === 'cancelled'
                              ? 'bg-[#1A1715]/5 text-[#8A827A] line-through'
                              : resv.status === 'seated'
                              ? 'bg-[#7A2322]/10 text-[#1A1715]'
                              : 'hover:bg-[#EFE6D5] text-[#1A1715]'
                          }`}
                        >
                          <td className="p-2.5 font-bold">{resv.time}</td>
                          <td className="p-2.5">{resv.token}</td>
                          <td className="p-2.5 font-medium">{resv.name}</td>
                          <td className="p-2.5 text-center font-bold">{resv.partySize}</td>
                          <td className="p-2.5">{resv.phone}</td>
                          <td className="p-2.5 max-w-xs truncate italic">{resv.notes || '—'}</td>
                          <td className="p-2.5 uppercase font-bold text-[10px]">
                            <span
                              className={`px-2 py-0.5 ${
                                resv.status === 'seated'
                                  ? 'bg-[#7A2322] text-[#F7F4EE]'
                                  : resv.status === 'confirmed'
                                  ? 'bg-[#8C6E43] text-[#F7F4EE]'
                                  : resv.status === 'completed'
                                  ? 'bg-[#38322D] text-[#F7F4EE]'
                                  : 'bg-[#DDD6C8] text-[#1A1715]'
                              }`}
                            >
                              {resv.status}
                            </span>
                          </td>
                          <td className="p-2.5 text-right space-x-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStatusChange(resv.id, 'seated');
                              }}
                              className="px-2 py-1 bg-[#7A2322] text-[#F7F4EE] text-[9px] uppercase hover:bg-[#581413]"
                            >
                              Seat
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStatusChange(resv.id, 'completed');
                              }}
                              className="px-2 py-1 bg-[#38322D] text-[#F7F4EE] text-[9px] uppercase"
                            >
                              Done
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStatusChange(resv.id, 'cancelled');
                              }}
                              className="px-2 py-1 border border-[#7A2322] text-[#7A2322] text-[9px] uppercase"
                            >
                              Cancel
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        } />

        {/* TAB 3: 86 Board (Live Sync to Public Menu) */}
        <Route path="86board" element={
          <div className="space-y-6">
            <div className="p-4 bg-[#7A2322]/10 border border-[#7A2322] text-[#7A2322] text-xs font-mono-data leading-relaxed">
              <span className="font-bold block uppercase mb-1">Live Back-of-House 86 Board</span>
              Toggling a dish 86'd here immediately strikes the item on the public guest menu in real-time.
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {menuItems.map((item) => (
                <div
                  key={item.id}
                  className={`p-4 border transition-all ${
                    item.is86
                      ? 'bg-[#1A1715]/10 border-[#7A2322]'
                      : 'bg-[#F7F4EE] border-[#DDD6C8]'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="text-[10px] font-mono-data uppercase text-[#8C6E43]">
                        {item.category}
                      </span>
                      <h4 className={`font-display text-xl ${item.is86 ? 'line-through text-[#7A2322]' : 'text-[#1A1715]'}`}>
                        {item.name}
                      </h4>
                    </div>
                    <span className="font-display text-lg text-[#7A2322]">£{item.price}</span>
                  </div>

                  <div className="mt-4 flex items-center justify-between pt-3 border-t border-[#DDD6C8]">
                    <span className="text-xs font-mono-data uppercase">
                      {item.is86 ? (
                        <span className="text-[#7A2322] font-bold">STRIKE (86'D)</span>
                      ) : (
                        <span className="text-[#8C6E43]">AVAILABLE</span>
                      )}
                    </span>

                    <button
                      onClick={() => handleToggle86(item.id, item.is86)}
                      {...writeProps}
                      className={`px-3 py-1.5 text-xs font-mono-data uppercase tracking-wider transition-colors ${
                        item.is86
                          ? 'bg-[#1A1715] text-[#F7F4EE] hover:bg-[#8C6E43]'
                          : 'bg-[#7A2322] text-[#F7F4EE] hover:bg-[#581413]'
                      }${writeClass}`}
                    >
                      {item.is86 ? 'Re-List Dish' : '86 Dish Now'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        } />

        {/* TAB 4: Menu Manager & Dish of Day CRUD */}
        <Route path="menucrud" element={
          <div className="space-y-8">
            
            <div className="flex justify-between items-center border-b border-[#DDD6C8] pb-4">
              <h3 className="font-display text-2xl text-[#1A1715]">Menu CRUD & Dish of the Day</h3>
              <button
                onClick={() => {
                  setEditingItem({
                    name: '',
                    category: 'cuts',
                    price: 40,
                    description: '',
                    is86: false,
                    isDishOfDay: false,
                    sortOrder: menuItems.length + 1,
                  });
                  setIsNewItem(true);
                }}
                className="px-4 py-2 bg-[#1A1715] text-[#F7F4EE] text-xs font-sans-ui uppercase tracking-widest flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Add New Menu Cut</span>
              </button>
            </div>

            {/* Menu Items CRUD Table */}
            <div className="space-y-4">
              {menuItems.map((item) => (
                <div key={item.id} className="p-4 bg-[#F7F4EE] border border-[#DDD6C8] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <h4 className="font-display text-xl text-[#1A1715]">{item.name}</h4>
                      {item.isDishOfDay && (
                        <span className="text-[10px] font-mono-data bg-[#8C6E43] text-[#F7F4EE] px-2 py-0.5 uppercase">
                          Current Dish of Day
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-mono-data text-[#8C6E43] uppercase">
                      Cat: {item.category} · Price: £{item.price} · {item.agingDays ? `${item.agingDays}d Aged` : 'Fresh'} · {item.weightGrams ? `${item.weightGrams}g` : 'Standard'}
                    </p>
                  </div>

                  <div className="flex items-center space-x-3 w-full sm:w-auto">
                    {!item.isDishOfDay && (
                      <button
                        onClick={() => handleSetDishOfDay(item.id)}
                        {...writeProps}
                        className={"px-3 py-1.5 border border-[#8C6E43] text-[#8C6E43] hover:bg-[#8C6E43] hover:text-[#F7F4EE] text-xs font-mono-data uppercase" + writeClass}
                      >
                        Make Dish of Day
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setEditingItem(item);
                        setIsNewItem(false);
                      }}
                      className="p-2 border border-[#38322D] text-[#1A1715] hover:bg-[#1A1715] hover:text-[#F7F4EE]"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteMenuItem(item.id)}
                      {...writeProps}
                      className={"p-2 border border-[#7A2322] text-[#7A2322] hover:bg-[#7A2322] hover:text-[#F7F4EE]" + writeClass}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Edit Modal / Form */}
            {editingItem && (
              <div className="fixed inset-0 z-50 bg-[#1A1715]/70 flex items-center justify-center p-4">
                <div className="bg-[#F7F4EE] border-2 border-[#1A1715] p-6 max-w-lg w-full space-y-4">
                  <h3 className="font-display text-2xl text-[#1A1715]">
                    {isNewItem ? 'Create New Dish' : 'Edit Menu Selection'}
                  </h3>

                  <form onSubmit={handleSaveMenuItem} className="space-y-3 font-mono-data text-xs">
                    <div>
                      <label className="block text-[#1A1715] mb-1">Dish Name *</label>
                      <input
                        type="text"
                        required
                        value={editingItem.name || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                        className="w-full p-2 bg-[#EFE6D5] border border-[#38322D]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[#1A1715] mb-1">Category *</label>
                        <select
                          value={editingItem.category || 'cuts'}
                          onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value as any })}
                          className="w-full p-2 bg-[#EFE6D5] border border-[#38322D]"
                        >
                          <option value="cuts">Cuts</option>
                          <option value="starters">Starters</option>
                          <option value="sides">Sides</option>
                          <option value="sauces">Sauces</option>
                          <option value="desserts">Desserts</option>
                          <option value="drinks">Drinks</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[#1A1715] mb-1">Price (£) *</label>
                        <input
                          type="number"
                          required
                          value={editingItem.price || 0}
                          onChange={(e) => setEditingItem({ ...editingItem, price: parseFloat(e.target.value) })}
                          className="w-full p-2 bg-[#EFE6D5] border border-[#38322D]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[#1A1715] mb-1">Cut Spec</label>
                        <input
                          type="text"
                          value={editingItem.cutName || ''}
                          onChange={(e) => setEditingItem({ ...editingItem, cutName: e.target.value })}
                          placeholder="e.g. Flank"
                          className="w-full p-2 bg-[#EFE6D5] border border-[#38322D]"
                        />
                      </div>
                      <div>
                        <label className="block text-[#1A1715] mb-1">Aging (Days)</label>
                        <input
                          type="number"
                          value={editingItem.agingDays || ''}
                          onChange={(e) => setEditingItem({ ...editingItem, agingDays: parseInt(e.target.value, 10) })}
                          placeholder="e.g. 45"
                          className="w-full p-2 bg-[#EFE6D5] border border-[#38322D]"
                        />
                      </div>
                      <div>
                        <label className="block text-[#1A1715] mb-1">Weight (g)</label>
                        <input
                          type="number"
                          value={editingItem.weightGrams || ''}
                          onChange={(e) => setEditingItem({ ...editingItem, weightGrams: parseInt(e.target.value, 10) })}
                          placeholder="e.g. 800"
                          className="w-full p-2 bg-[#EFE6D5] border border-[#38322D]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[#1A1715] mb-1">Image URL</label>
                      <input
                        type="url"
                        value={editingItem.photoUrl || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, photoUrl: e.target.value })}
                        placeholder="https://..."
                        className="w-full p-2 bg-[#EFE6D5] border border-[#38322D]"
                      />
                    </div>

                    <div>
                      <label className="block text-[#1A1715] mb-1">Description Prose</label>
                      <textarea
                        rows={3}
                        value={editingItem.description || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                        className="w-full p-2 bg-[#EFE6D5] border border-[#38322D] font-serif-body"
                      />
                    </div>

                    <div className="pt-4 flex justify-end space-x-3">
                      <button
                        type="button"
                        onClick={() => setEditingItem(null)}
                        className="px-4 py-2 border border-[#38322D] text-[#1A1715]"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-6 py-2 bg-[#7A2322] text-[#F7F4EE] hover:bg-[#581413]"
                      >
                        Save Dish
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

          </div>
        } />
      </Routes>

    </div>
  );
};
