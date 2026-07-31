import React, { useState, useEffect } from 'react';
import { Reservation } from '../types';
import { CheckCircle, Calendar, Clock, MapPin, Download, AlertTriangle, ArrowLeft } from 'lucide-react';

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
  const [cancelled, setCancelled] = useState<boolean>(false);
  const [cancelling, setCancelling] = useState<boolean>(false);

  useEffect(() => {
    if (!reservationData && reservationToken) {
      async function fetchToken() {
        setLoading(true);
        setError(null);
        try {
          const res = await fetch(`/api/reservations/token/${reservationToken}`);
          const data = await res.json();
          if (res.ok && data.reservation) {
            setReservation(data.reservation);
            if (data.reservation.status === 'cancelled') {
              setCancelled(true);
            }
          } else {
            setError(data.error || 'Invalid reservation token.');
          }
        } catch (err) {
          setError('Failed to retrieve reservation details.');
        } finally {
          setLoading(false);
        }
      }
      fetchToken();
    }
  }, [reservationToken, reservationData]);

  // Generate .ics calendar download
  const handleDownloadCalendar = () => {
    if (!reservation) return;
    const startStr = `${reservation.date.replace(/-/g, '')}T${reservation.time.replace(':', '')}00`;
    const endHour = parseInt(reservation.time.split(':')[0], 10) + 2;
    const endStr = `${reservation.date.replace(/-/g, '')}T${endHour.toString().padStart(2, '0')}${reservation.time.split(':')[1]}00`;

    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//TALLOW Steakhouse London//EN
BEGIN:VEVENT
SUMMARY:TALLOW Steakhouse Sitting (${reservation.partySize} Guests)
DESCRIPTION:Sitting reservation at TALLOW London. Token: ${reservation.token}. Cut Notes: ${reservation.notes || 'None'}.
LOCATION:14 Beak Street, Soho, London W1F 9RD
DTSTART:${startStr}
DTEND:${endStr}
END:VEVENT
END:VCALENDAR`;

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `TALLOW_Reservation_${reservation.token}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCancelBooking = async () => {
    if (!reservation || !confirm('Are you sure you wish to cancel this sitting at TALLOW?')) return;
    setCancelling(true);
    try {
      const res = await fetch('/api/reservations/cancel-by-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: reservation.token }),
      });
      if (res.ok) {
        setCancelled(true);
        if (reservation) {
          setReservation({ ...reservation, status: 'cancelled' });
        }
      } else {
        alert('Could not cancel reservation. Please call the hearth directly.');
      }
    } catch (err) {
      alert('Error cancelling booking.');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4 text-center font-mono-data text-xs text-[#6B635A]">
        Retrieving tokenised booking record...
      </div>
    );
  }

  if (error || !reservation) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4 text-center border border-[#7A2322] bg-[#7A2322]/5 my-8">
        <AlertTriangle className="w-8 h-8 text-[#7A2322] mx-auto mb-3" />
        <h3 className="font-display text-2xl text-[#1A1715] mb-2">Booking Token Unresolved</h3>
        <p className="font-serif-body text-sm text-[#6B635A] mb-6">
          {error || 'No matching reservation token was found.'}
        </p>
        <button
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
            <h2 className="font-display text-3xl sm:text-4xl text-[#1A1715] mt-1">
              TALLOW SITTING
            </h2>
          </div>

          <div className="text-right">
            <span className="font-mono-data text-xs uppercase text-[#6B635A] block">Booking Token</span>
            <span className="font-mono-data text-lg font-bold text-[#7A2322] tracking-widest bg-[#1A1715]/10 px-3 py-1 inline-block mt-1">
              {reservation.token}
            </span>
          </div>
        </div>

        {cancelled || reservation.status === 'cancelled' ? (
          <div className="p-4 bg-[#7A2322]/10 border border-[#7A2322] text-[#7A2322] font-mono-data text-xs uppercase tracking-wider mb-6 text-center">
            Sitting Cancelled — Table Released
          </div>
        ) : (
          <div className="flex items-center space-x-2 text-xs font-mono-data text-[#8C6E43] uppercase tracking-wider mb-6">
            <CheckCircle className="w-4 h-4 text-[#7A2322]" />
            <span>Guaranteed Hearth Sitting Confirmed</span>
          </div>
        )}

        {/* Structured Booking Details */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8 bg-[#1A1715]/5 p-4 border border-[#38322D]/10 text-xs font-mono-data">
          <div>
            <span className="text-[10px] uppercase text-[#6B635A] block">Date</span>
            <span className="font-bold text-[#1A1715] text-sm">{reservation.date}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase text-[#6B635A] block">Sitting Time</span>
            <span className="font-bold text-[#1A1715] text-sm">{reservation.time}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase text-[#6B635A] block">Party Size</span>
            <span className="font-bold text-[#1A1715] text-sm">{reservation.partySize} Guests</span>
          </div>
          <div>
            <span className="text-[10px] uppercase text-[#6B635A] block">Primary Guest</span>
            <span className="font-medium text-[#1A1715]">{reservation.name}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase text-[#6B635A] block">Contact Phone</span>
            <span className="font-medium text-[#1A1715]">{reservation.phone}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase text-[#6B635A] block">Email</span>
            <span className="font-medium text-[#1A1715] truncate">{reservation.email}</span>
          </div>
        </div>

        {reservation.notes && (
          <div className="mb-6 p-3 bg-[#F7F4EE] border border-[#DDD6C8] text-xs font-serif-body italic text-[#1A1715]">
            Guest Note: "{reservation.notes}"
          </div>
        )}

        {/* Venue Location Block */}
        <div className="border-t border-[#DDD6C8] pt-6 mb-8 text-xs font-serif-body text-[#6B635A] space-y-1">
          <p className="font-bold text-[#1A1715] uppercase font-sans-ui text-[11px] tracking-wider">
            TALLOW Soho Location
          </p>
          <p>14 Beak Street, Soho, London W1F 9RD</p>
          <p className="text-[11px] font-mono-data text-[#8C6E43]">
            Direct Link for this booking: {window.location.origin}/?token={reservation.token}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t-2 border-[#1A1715]">
          <button
            onClick={onReturnHome}
            className="flex items-center space-x-2 text-xs font-sans-ui uppercase tracking-wider text-[#6B635A] hover:text-[#1A1715]"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Site</span>
          </button>

          {!cancelled && reservation.status !== 'cancelled' && (
            <div className="flex items-center space-x-3 w-full sm:w-auto">
              <button
                onClick={handleDownloadCalendar}
                className="flex-1 sm:flex-none px-4 py-2.5 bg-[#1A1715] text-[#F7F4EE] hover:bg-[#7A2322] text-xs font-sans-ui uppercase tracking-wider transition-colors flex items-center justify-center space-x-2"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Add to Calendar (.ics)</span>
              </button>

              <button
                onClick={handleCancelBooking}
                disabled={cancelling}
                className="px-3 py-2.5 border border-[#7A2322] text-[#7A2322] hover:bg-[#7A2322] hover:text-[#F7F4EE] text-xs font-sans-ui uppercase tracking-wider transition-colors"
              >
                {cancelling ? 'Cancelling...' : 'Cancel Sitting'}
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
