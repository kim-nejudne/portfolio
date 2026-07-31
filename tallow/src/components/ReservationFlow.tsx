import React, { useState, useEffect } from 'react';
import { TimeSlotAvailability, Reservation } from '../types';
import { Calendar, Users, Clock, User, Mail, Phone, AlertCircle, CheckCircle, Flame } from 'lucide-react';

interface ReservationFlowProps {
  onBookingComplete: (reservation: Reservation) => void;
  initialDishPreference?: string;
}

export const ReservationFlow: React.FC<ReservationFlowProps> = ({
  onBookingComplete,
  initialDishPreference = '',
}) => {
  // 4 steps on ONE page: 1: Date, 2: Party, 3: Time, 4: Details
  const [step, setStep] = useState<number>(1);

  // Form State
  const [date, setDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [partySize, setPartySize] = useState<number>(2);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [notes, setNotes] = useState<string>(initialDishPreference ? `Interested in: ${initialDishPreference}` : '');

  // Availability State
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);
  const [slots, setSlots] = useState<TimeSlotAvailability[]>([]);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch real-time sittings availability whenever Date or Party Size changes
  useEffect(() => {
    let isMounted = true;
    async function fetchAvailability() {
      setLoadingSlots(true);
      setErrorMsg(null);
      try {
        const res = await fetch(`/api/reservations/availability?date=${date}&partySize=${partySize}`);
        const data = await res.json();
        if (isMounted && data.slots) {
          setSlots(data.slots);
          // Reset selected time if it's no longer available
          if (selectedTime) {
            const currentSlot = data.slots.find((s: TimeSlotAvailability) => s.time === selectedTime);
            if (!currentSlot || !currentSlot.isAvailable) {
              setSelectedTime('');
            }
          }
        }
      } catch (err) {
        if (isMounted) {
          console.error('Failed to query availability:', err);
        }
      } finally {
        if (isMounted) setLoadingSlots(false);
      }
    }

    fetchAvailability();
    return () => { isMounted = false; };
  }, [date, partySize]);

  // Handle Submit with real atomic DB-level conflict check
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTime) {
      setErrorMsg('Please select an available sitting time.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          time: selectedTime,
          partySize,
          name,
          email,
          phone,
          notes,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Honest specific capacity error returned from DB atomic check!
        setErrorMsg(data.error || 'The requested sitting could not be booked due to high demand.');
        setSubmitting(false);
        return;
      }

      if (data.success && data.reservation) {
        onBookingComplete(data.reservation);
      }
    } catch (err) {
      setErrorMsg('Network or server error submitting reservation. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-10 px-4 sm:px-8">
      
      {/* Header */}
      <div className="text-center mb-8 border-b border-[#DDD6C8] pb-6">
        <span className="font-mono-data text-[10px] uppercase tracking-[0.25em] text-[#8C6E43] block mb-1">
          Direct Table Sittings · TALLOW Soho
        </span>
        <h2 className="font-display text-3xl sm:text-4xl text-[#1A1715]">
          RESERVE A SITTING
        </h2>
        <p className="font-serif-body text-sm text-[#6B635A] italic mt-1">
          Guaranteed real-time availability. 16 covers maximum per sitting window.
        </p>
      </div>

      {/* Inline 4-Step Indicator Bar */}
      <div className="grid grid-cols-4 gap-2 mb-8 border-b border-[#38322D] pb-3 text-xs font-mono-data uppercase tracking-wider">
        <button
          onClick={() => setStep(1)}
          className={`text-left pb-1 transition-colors ${
            step === 1 ? 'border-b-2 border-[#7A2322] text-[#7A2322] font-bold' : 'text-[#6B635A]'
          }`}
        >
          1. Date
        </button>
        <button
          onClick={() => setStep(2)}
          className={`text-left pb-1 transition-colors ${
            step === 2 ? 'border-b-2 border-[#7A2322] text-[#7A2322] font-bold' : 'text-[#6B635A]'
          }`}
        >
          2. Party ({partySize})
        </button>
        <button
          onClick={() => setStep(3)}
          className={`text-left pb-1 transition-colors ${
            step === 3 ? 'border-b-2 border-[#7A2322] text-[#7A2322] font-bold' : 'text-[#6B635A]'
          }`}
        >
          3. Time ({selectedTime || 'Select'})
        </button>
        <button
          onClick={() => selectedTime && setStep(4)}
          disabled={!selectedTime}
          className={`text-left pb-1 transition-colors ${
            step === 4 ? 'border-b-2 border-[#7A2322] text-[#7A2322] font-bold' : 'text-[#6B635A] opacity-50'
          }`}
        >
          4. Confirm
        </button>
      </div>

      {/* Error Alert Banner */}
      {errorMsg && (
        <div className="mb-6 p-4 bg-[#7A2322]/10 border border-[#7A2322] text-[#7A2322] text-xs font-mono-data leading-relaxed flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold uppercase block mb-1">Availability Conflict</span>
            <p>{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Step 1: Date Selection */}
      {step === 1 && (
        <div className="space-y-6 bg-[#F7F4EE] p-6 border border-[#DDD6C8]">
          <div className="flex items-center space-x-2 text-sm font-sans-ui uppercase tracking-wider text-[#1A1715]">
            <Calendar className="w-4 h-4 text-[#7A2322]" />
            <span>Select Sitting Date</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-4">
            <input
              type="date"
              value={date}
              min={new Date().toISOString().split('T')[0]}
              onChange={(e) => setDate(e.target.value)}
              className="w-full sm:w-auto px-4 py-3 bg-[#EFE6D5] border border-[#38322D] font-mono-data text-sm text-[#1A1715] focus:outline-none focus:ring-1 focus:ring-[#7A2322]"
            />
            <span className="text-xs font-serif-body text-[#6B635A] italic">
              Reservations open 30 days in advance.
            </span>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              onClick={() => setStep(2)}
              className="px-6 py-2.5 bg-[#1A1715] text-[#F7F4EE] text-xs font-sans-ui uppercase tracking-widest hover:bg-[#7A2322] transition-colors"
            >
              Next: Select Party Size →
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Party Size Selection */}
      {step === 2 && (
        <div className="space-y-6 bg-[#F7F4EE] p-6 border border-[#DDD6C8]">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-sm font-sans-ui uppercase tracking-wider text-[#1A1715]">
              <Users className="w-4 h-4 text-[#7A2322]" />
              <span>Select Guest Count ({date})</span>
            </div>
            <button onClick={() => setStep(1)} className="text-xs text-[#6B635A] underline">
              Change Date
            </button>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => setPartySize(num)}
                className={`py-3 text-center border font-mono-data text-sm transition-all ${
                  partySize === num
                    ? 'bg-[#7A2322] border-[#7A2322] text-[#F7F4EE] font-bold'
                    : 'bg-[#EFE6D5] border-[#38322D]/30 text-[#1A1715] hover:border-[#1A1715]'
                }`}
              >
                {num} {num === 1 ? 'Guest' : 'Guests'}
              </button>
            ))}
          </div>

          <div className="pt-4 flex justify-between">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 border border-[#38322D] text-xs font-sans-ui uppercase tracking-widest text-[#1A1715]"
            >
              ← Back
            </button>
            <button
              onClick={() => setStep(3)}
              className="px-6 py-2.5 bg-[#1A1715] text-[#F7F4EE] text-xs font-sans-ui uppercase tracking-widest hover:bg-[#7A2322] transition-colors"
            >
              Next: Choose Sitting Time →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Time Slot Selection (Queried Real Availability) */}
      {step === 3 && (
        <div className="space-y-6 bg-[#F7F4EE] p-6 border border-[#DDD6C8]">
          <div className="flex items-center justify-between border-b border-[#DDD6C8] pb-3">
            <div className="flex items-center space-x-2 text-sm font-sans-ui uppercase tracking-wider text-[#1A1715]">
              <Clock className="w-4 h-4 text-[#7A2322]" />
              <span>Available Sitting Times for {partySize} guests on {date}</span>
            </div>
            <button onClick={() => setStep(2)} className="text-xs text-[#6B635A] underline">
              Edit Party ({partySize})
            </button>
          </div>

          {loadingSlots ? (
            <div className="py-8 text-center text-xs font-mono-data text-[#6B635A] animate-pulse">
              Querying live hearth capacity...
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {slots.map((s) => (
                <button
                  key={s.time}
                  type="button"
                  disabled={!s.isAvailable}
                  onClick={() => {
                    setSelectedTime(s.time);
                    setErrorMsg(null);
                  }}
                  className={`p-3 text-left border transition-all ${
                    !s.isAvailable
                      ? 'bg-[#1A1715]/5 border-[#DDD6C8] text-[#8A827A] cursor-not-allowed opacity-50'
                      : selectedTime === s.time
                      ? 'bg-[#7A2322] border-[#7A2322] text-[#F7F4EE] shadow-sm'
                      : 'bg-[#EFE6D5] border-[#38322D]/30 text-[#1A1715] hover:border-[#1A1715]'
                  }`}
                >
                  <div className="font-mono-data text-base font-bold">{s.time}</div>
                  <div className="text-[10px] uppercase font-mono-data mt-1 opacity-90">
                    {s.isAvailable
                      ? `${s.availableCovers} covers open`
                      : s.reason || 'Committed'}
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="pt-4 flex justify-between items-center">
            <button
              onClick={() => setStep(2)}
              className="px-4 py-2 border border-[#38322D] text-xs font-sans-ui uppercase tracking-widest text-[#1A1715]"
            >
              ← Back
            </button>
            <button
              disabled={!selectedTime}
              onClick={() => setStep(4)}
              className={`px-6 py-2.5 text-xs font-sans-ui uppercase tracking-widest transition-colors ${
                selectedTime
                  ? 'bg-[#1A1715] text-[#F7F4EE] hover:bg-[#7A2322]'
                  : 'bg-[#DDD6C8] text-[#8A827A] cursor-not-allowed'
              }`}
            >
              Next: Guest Details →
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Details & Submit */}
      {step === 4 && (
        <form onSubmit={handleSubmit} className="space-y-6 bg-[#F7F4EE] p-6 border border-[#DDD6C8]">
          <div className="border-b border-[#DDD6C8] pb-4 flex justify-between items-center">
            <div>
              <span className="text-xs font-mono-data text-[#8C6E43] uppercase tracking-wider">
                Sitting Selected
              </span>
              <h3 className="font-display text-2xl text-[#1A1715]">
                {date} at {selectedTime} · {partySize} Guests
              </h3>
            </div>
            <button type="button" onClick={() => setStep(3)} className="text-xs text-[#6B635A] underline">
              Change Time
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono-data uppercase tracking-wider text-[#1A1715] mb-1">
                Full Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Eleanor Vance"
                className="w-full px-3 py-2 bg-[#EFE6D5] border border-[#38322D] font-sans-ui text-sm text-[#1A1715] focus:outline-none focus:ring-1 focus:ring-[#7A2322]"
              />
            </div>

            <div>
              <label className="block text-xs font-mono-data uppercase tracking-wider text-[#1A1715] mb-1">
                Email Address *
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="eleanor@vance.co"
                className="w-full px-3 py-2 bg-[#EFE6D5] border border-[#38322D] font-sans-ui text-sm text-[#1A1715] focus:outline-none focus:ring-1 focus:ring-[#7A2322]"
              />
            </div>

            <div>
              <label className="block text-xs font-mono-data uppercase tracking-wider text-[#1A1715] mb-1">
                Telephone Number *
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+44 7700 900077"
                className="w-full px-3 py-2 bg-[#EFE6D5] border border-[#38322D] font-sans-ui text-sm text-[#1A1715] focus:outline-none focus:ring-1 focus:ring-[#7A2322]"
              />
            </div>

            <div>
              <label className="block text-xs font-mono-data uppercase tracking-wider text-[#1A1715] mb-1">
                Special Cut or Dietary Notes
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Requesting 45-day Bone-in Ribeye"
                className="w-full px-3 py-2 bg-[#EFE6D5] border border-[#38322D] font-sans-ui text-sm text-[#1A1715] focus:outline-none focus:ring-1 focus:ring-[#7A2322]"
              />
            </div>
          </div>

          <div className="p-4 bg-[#1A1715]/5 border border-[#DDD6C8] text-xs font-serif-body text-[#6B635A] italic">
            Reservations are held for 15 minutes past sitting time. Sittings last 1 hour 45 minutes.
          </div>

          <div className="pt-4 flex justify-between items-center">
            <button
              type="button"
              onClick={() => setStep(3)}
              className="px-4 py-2 border border-[#38322D] text-xs font-sans-ui uppercase tracking-widest text-[#1A1715]"
            >
              ← Back
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-8 py-3.5 bg-[#7A2322] hover:bg-[#581413] text-[#F7F4EE] text-xs font-sans-ui uppercase tracking-widest transition-colors flex items-center space-x-2"
            >
              {submitting ? (
                <span>Confirming Sitting...</span>
              ) : (
                <span>Complete Reservation →</span>
              )}
            </button>
          </div>
        </form>
      )}

    </div>
  );
};
