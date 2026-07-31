import React, { useEffect, useRef, useState } from 'react';
import { Reservation } from '../types';
import { buildReservationIcs } from '../lib/ics';
import { CheckCircle, Download, AlertTriangle, ArrowLeft } from 'lucide-react';

interface BookingConfirmationProps {
  reservationToken?: string;
  reservationData?: Reservation | null;
  onReturnHome: () => void;
}

export const BookingConfirmation: React.FC<BookingConfirmationProps> = ({
  reservationToken,
  reservationData,
  onReturnHome,
}) => {
  const [reservation, setReservation] = useState<Reservation | null>(reservationData || null);
  const [loading, setLoading] = useState<boolean>(!reservationData && Boolean(reservationToken));
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<boolean>(false);
  const [confirmingCancel, setConfirmingCancel] = useState<boolean>(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const confirmCancelRef = useRef<HTMLButtonElement>(null);

  const isCancelled = reservation?.status === 'cancelled';

  useEffect(() => {
    if (reservationData || !reservationToken) return;

    const controller = new AbortController();

    async function fetchToken() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/reservations/token/${reservationToken}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        if (res.ok && data.reservation) {
          setReservation(data.reservation);
        } else {
          setError(data.error || 'Invalid reservation token.');
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setError('Failed to retrieve reservation details.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    fetchToken();
    return () => controller.abort();
  }, [reservationToken, reservationData]);

  // Move focus onto the confirm control when the two-step cancel opens, so the
  // destructive choice is where the keyboard already is.
  useEffect(() => {
    if (confirmingCancel) confirmCancelRef.current?.focus();
  }, [confirmingCancel]);

  const handleDownloadCalendar = () => {
    if (!reservation) return;

    const blob = new Blob([buildReservationIcs(reservation)], {
      type: 'text/calendar;charset=utf-8',
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `TALLOW_Reservation_${reservation.token}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // The scaffold never released the object URL, so every download leaked the
    // blob for the life of the document.
    window.URL.revokeObjectURL(url);
  };

  const handleCancelBooking = async () => {
    if (!reservation) return;
    setCancelling(true);
    setCancelError(null);
    try {
      const res = await fetch('/api/reservations/cancel-by-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: reservation.token }),
      });
      if (res.ok) {
        setReservation({ ...reservation, status: 'cancelled' });
        setConfirmingCancel(false);
      } else {
        setCancelError('The sitting could not be cancelled. Please call the hearth on +44 (0)20 7946 0912.');
      }
    } catch (err) {
      setCancelError('Network error cancelling the booking. Please try again.');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4 text-center font-mono-data text-xs text-[#6B635A]" role="status">
        Retrieving tokenised booking record...
      </div>
    );
  }

  if (error || !reservation) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4 text-center border border-[#7A2322] bg-[#7A2322]/5 my-8" role="alert">
        <AlertTriangle className="w-8 h-8 text-[#7A2322] mx-auto mb-3" aria-hidden="true" />
        <h1 className="font-display text-2xl text-[#1A1715] mb-2">Booking Token Unresolved</h1>
        <p className="font-serif-body text-sm text-[#6B635A] mb-6">
          {error || 'No matching reservation token was found.'}
        </p>
        <button
          type="button"
          onClick={onReturnHome}
          className="px-6 py-2.5 bg-[#1A1715] text-[#F7F4EE] text-xs font-sans-ui uppercase tracking-widest"
        >
          Return to Overview
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-12 px-4 sm:px-8">

      {/* Voucher Ticket Box */}
      <div className="insert-stock border-2 border-[#1A1715] p-6 sm:p-10 relative">

        {/* Token Stamp */}
        <div className="flex justify-between items-start border-b-2 border-[#1A1715] pb-4 mb-6">
          <div>
            <span className="font-mono-data text-[10px] uppercase tracking-[0.25em] text-[#8C6E43]">
              Confirmed Sitting Voucher
            </span>
            <h1 className="font-display text-3xl sm:text-4xl text-[#1A1715] mt-1">
              TALLOW SITTING
            </h1>
          </div>

          <div className="text-right">
            <span className="font-mono-data text-xs uppercase text-[#6B635A] block" id="token-label">
              Booking Token
            </span>
            <span
              aria-labelledby="token-label"
              className="font-mono-data text-lg font-bold text-[#7A2322] tracking-widest bg-[#1A1715]/10 px-3 py-1 inline-block mt-1"
            >
              {reservation.token}
            </span>
          </div>
        </div>

        {/* Status changes in place after a cancellation, so it is announced. */}
        <div role="status">
          {isCancelled ? (
            <p className="p-4 bg-[#7A2322]/10 border border-[#7A2322] text-[#7A2322] font-mono-data text-xs uppercase tracking-wider mb-6 text-center">
              Sitting Cancelled — Table Released
            </p>
          ) : (
            <p className="flex items-center space-x-2 text-xs font-mono-data text-[#8C6E43] uppercase tracking-wider mb-6">
              <CheckCircle className="w-4 h-4 text-[#7A2322]" aria-hidden="true" />
              <span>Guaranteed Hearth Sitting Confirmed</span>
            </p>
          )}
        </div>

        {/* Structured Booking Details */}
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8 bg-[#1A1715]/5 p-4 border border-[#38322D]/10 text-xs font-mono-data">
          <div>
            <dt className="text-[10px] uppercase text-[#6B635A] block">Date</dt>
            <dd className="font-bold text-[#1A1715] text-sm">{reservation.date}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase text-[#6B635A] block">Sitting Time</dt>
            <dd className="font-bold text-[#1A1715] text-sm">{reservation.time}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase text-[#6B635A] block">Party Size</dt>
            <dd className="font-bold text-[#1A1715] text-sm">{reservation.partySize} Guests</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase text-[#6B635A] block">Primary Guest</dt>
            <dd className="font-medium text-[#1A1715]">{reservation.name}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase text-[#6B635A] block">Contact Phone</dt>
            <dd className="font-medium text-[#1A1715]">{reservation.phone}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase text-[#6B635A] block">Email</dt>
            <dd className="font-medium text-[#1A1715] truncate">{reservation.email}</dd>
          </div>
        </dl>

        {reservation.notes && (
          <p className="mb-6 p-3 bg-[#F7F4EE] border border-[#DDD6C8] text-xs font-serif-body italic text-[#1A1715]">
            Guest Note: &ldquo;{reservation.notes}&rdquo;
          </p>
        )}

        {/* Venue Location Block */}
        <div className="border-t border-[#DDD6C8] pt-6 mb-8 text-xs font-serif-body text-[#6B635A] space-y-1">
          <h2 className="font-bold text-[#1A1715] uppercase font-sans-ui text-[11px] tracking-wider">
            TALLOW Soho Location
          </h2>
          <address className="not-italic">14 Beak Street, Soho, London W1F 9RD</address>
          <p className="text-[11px] font-mono-data text-[#8C6E43] break-all">
            Direct link for this booking: {window.location.origin}/?token={reservation.token}
          </p>
        </div>

        {cancelError && (
          <p role="alert" className="mb-4 p-3 border border-[#7A2322] bg-[#7A2322]/10 text-[#7A2322] text-xs font-mono-data">
            {cancelError}
          </p>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t-2 border-[#1A1715]">
          <button
            type="button"
            onClick={onReturnHome}
            className="flex items-center space-x-2 text-xs font-sans-ui uppercase tracking-wider text-[#6B635A] hover:text-[#1A1715]"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Return to Site</span>
          </button>

          {!isCancelled && (
            <div className="flex items-center space-x-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleDownloadCalendar}
                className="flex-1 sm:flex-none px-4 py-2.5 bg-[#1A1715] text-[#F7F4EE] hover:bg-[#7A2322] text-xs font-sans-ui uppercase tracking-wider transition-colors flex items-center justify-center space-x-2"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Add to Calendar (.ics)</span>
              </button>

              {/* Releasing a table is destructive and cannot be undone from
                  here, so it asks first — in the page rather than through a
                  native confirm() the printed styling cannot reach. */}
              {confirmingCancel ? (
                <span className="flex items-center gap-2">
                  <button
                    ref={confirmCancelRef}
                    type="button"
                    onClick={handleCancelBooking}
                    disabled={cancelling}
                    className="px-3 py-2.5 bg-[#7A2322] text-[#F7F4EE] text-xs font-sans-ui uppercase tracking-wider disabled:opacity-60"
                  >
                    {cancelling ? 'Cancelling…' : 'Confirm Release'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingCancel(false)}
                    disabled={cancelling}
                    className="px-3 py-2.5 border border-[#38322D] text-[#1A1715] text-xs font-sans-ui uppercase tracking-wider"
                  >
                    Keep
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingCancel(true)}
                  className="px-3 py-2.5 border border-[#7A2322] text-[#7A2322] hover:bg-[#7A2322] hover:text-[#F7F4EE] text-xs font-sans-ui uppercase tracking-wider transition-colors"
                >
                  Cancel Sitting
                </button>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
