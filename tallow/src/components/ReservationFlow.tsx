import React, { useEffect, useId, useRef, useState } from 'react';
import { TimeSlotAvailability, Reservation } from '../types';
import { RadioGrid } from './RadioGrid';
import { Calendar, Users, Clock, AlertCircle } from 'lucide-react';

interface ReservationFlowProps {
  onBookingComplete: (reservation: Reservation) => void;
  initialDishPreference?: string;
}

const STEPS = [
  { n: 1, label: 'Date' },
  { n: 2, label: 'Party' },
  { n: 3, label: 'Time' },
  { n: 4, label: 'Confirm' },
] as const;

const PARTY_SIZES = [1, 2, 3, 4, 5, 6, 8, 10, 12];

/** The booking window the printed copy promises, in days. */
const BOOKING_WINDOW_DAYS = 30;

function isoDay(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

export const ReservationFlow: React.FC<ReservationFlowProps> = ({
  onBookingComplete,
  initialDishPreference = '',
}) => {
  // 4 steps on ONE page: 1: Date, 2: Party, 3: Time, 4: Details
  const [step, setStep] = useState<number>(1);

  // Form State
  const [date, setDate] = useState<string>(() => isoDay());
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

  const fieldId = useId();
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const isFirstRender = useRef(true);
  // Read inside the availability effect without making it a dependency, which
  // would refetch every time a guest picks a time.
  const selectedTimeRef = useRef(selectedTime);
  selectedTimeRef.current = selectedTime;

  const errorId = `${fieldId}-error`;

  // Fetch real-time sittings availability whenever Date or Party Size changes
  useEffect(() => {
    const controller = new AbortController();

    async function fetchAvailability() {
      setLoadingSlots(true);
      setErrorMsg(null);
      try {
        const res = await fetch(
          `/api/reservations/availability?date=${date}&partySize=${partySize}`,
          { signal: controller.signal }
        );
        const data = await res.json();
        if (!data.slots) return;

        setSlots(data.slots);

        // A held time that the new date or party size has invalidated must not
        // survive into step 4, where it would be submitted and rejected.
        const held = selectedTimeRef.current;
        if (held) {
          const slot = data.slots.find((s: TimeSlotAvailability) => s.time === held);
          if (!slot || !slot.isAvailable) setSelectedTime('');
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        console.error('Failed to query availability:', err);
        setErrorMsg('Live availability could not be loaded. Please try again in a moment.');
      } finally {
        if (!controller.signal.aborted) setLoadingSlots(false);
      }
    }

    fetchAvailability();
    return () => controller.abort();
  }, [date, partySize]);

  // Changing step swaps the whole panel. Without moving focus, a keyboard or
  // screen-reader user is left on a button that no longer relates to what is
  // now on screen.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    stepHeadingRef.current?.focus();
  }, [step]);

  const goToStep = (n: number) => {
    setErrorMsg(null);
    setStep(n);
  };

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
        body: JSON.stringify({ date, time: selectedTime, partySize, name, email, phone, notes }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Honest specific capacity error returned from the DB atomic check.
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

  const stepHeadingClass = 'flex items-center space-x-2 text-sm font-sans-ui uppercase tracking-wider text-[#1A1715]';
  const panelClass = 'space-y-6 bg-[#F7F4EE] p-6 border border-[#DDD6C8]';
  const fieldClass =
    'w-full px-3 py-2 bg-[#EFE6D5] border border-[#38322D] font-sans-ui text-sm text-[#1A1715]';
  const labelClass = 'block text-xs font-mono-data uppercase tracking-wider text-[#1A1715] mb-1';
  const backButtonClass =
    'px-4 py-2 border border-[#38322D] text-xs font-sans-ui uppercase tracking-widest text-[#1A1715]';
  const nextButtonClass =
    'px-6 py-2.5 bg-[#1A1715] text-[#F7F4EE] text-xs font-sans-ui uppercase tracking-widest hover:bg-[#7A2322] transition-colors';

  const availableSlotCount = slots.filter((s) => s.isAvailable).length;

  return (
    <div className="max-w-3xl mx-auto py-10 px-4 sm:px-8">

      {/* Header */}
      <div className="text-center mb-8 border-b border-[#DDD6C8] pb-6">
        <span className="font-mono-data text-[10px] uppercase tracking-[0.25em] text-[#8C6E43] block mb-1">
          Direct Table Sittings · TALLOW Soho
        </span>
        <h1 className="font-display text-3xl sm:text-4xl text-[#1A1715]">
          RESERVE A SITTING
        </h1>
        <p className="font-serif-body text-sm text-[#6B635A] italic mt-1">
          Guaranteed real-time availability. 16 covers maximum per sitting window.
        </p>
      </div>

      {/* Inline 4-Step Indicator Bar */}
      <nav aria-label="Reservation steps" className="mb-8 border-b border-[#38322D] pb-3">
        <ol className="grid grid-cols-4 gap-2 text-xs font-mono-data uppercase tracking-wider">
          {STEPS.map(({ n, label }) => {
            const isCurrent = step === n;
            // Step 4 summarises a chosen sitting, so it cannot be reached until
            // there is one to summarise.
            const locked = n === 4 && !selectedTime;
            const detail =
              n === 2 ? ` (${partySize})` : n === 3 ? ` (${selectedTime || 'Select'})` : '';

            return (
              <li key={n}>
                <button
                  type="button"
                  onClick={() => goToStep(n)}
                  disabled={locked}
                  aria-current={isCurrent ? 'step' : undefined}
                  className={`w-full text-left pb-1 transition-colors ${
                    isCurrent
                      ? 'border-b-2 border-[#7A2322] text-[#7A2322] font-bold'
                      : `text-[#6B635A]${locked ? ' opacity-50 cursor-not-allowed' : ''}`
                  }`}
                >
                  {n}. {label}
                  <span aria-hidden="true">{detail}</span>
                  {n === 2 && <span className="sr-only">, {partySize} guests</span>}
                  {n === 3 && (
                    <span className="sr-only">
                      , {selectedTime ? selectedTime : 'no time selected'}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Error Alert Banner */}
      {errorMsg && (
        <div
          id={errorId}
          role="alert"
          className="mb-6 p-4 bg-[#7A2322]/10 border border-[#7A2322] text-[#7A2322] text-xs font-mono-data leading-relaxed flex items-start space-x-3"
        >
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <span className="font-bold uppercase block mb-1">Availability Conflict</span>
            <p>{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Availability is fetched in the background and changes what step 3 can
          offer; this is what reports that to anyone not watching the grid. */}
      <p aria-live="polite" className="sr-only">
        {loadingSlots
          ? 'Checking availability'
          : `${availableSlotCount} of ${slots.length} sittings available for ${partySize} guests on ${date}`}
      </p>

      {/* Step 1: Date Selection */}
      {step === 1 && (
        <div className={panelClass} role="group" aria-labelledby={`${fieldId}-step1`}>
          <h2 id={`${fieldId}-step1`} ref={stepHeadingRef} tabIndex={-1} className={stepHeadingClass}>
            <Calendar className="w-4 h-4 text-[#7A2322]" aria-hidden="true" />
            <span>Select Sitting Date</span>
          </h2>

          <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
            <div>
              <label htmlFor={`${fieldId}-date`} className="sr-only">
                Sitting date
              </label>
              <input
                id={`${fieldId}-date`}
                type="date"
                value={date}
                min={isoDay()}
                max={isoDay(BOOKING_WINDOW_DAYS)}
                onChange={(e) => setDate(e.target.value)}
                aria-describedby={`${fieldId}-date-hint`}
                className="w-full sm:w-auto px-4 py-3 bg-[#EFE6D5] border border-[#38322D] font-mono-data text-sm text-[#1A1715]"
              />
            </div>
            <span id={`${fieldId}-date-hint`} className="text-xs font-serif-body text-[#6B635A] italic">
              Reservations open {BOOKING_WINDOW_DAYS} days in advance.
            </span>
          </div>

          <div className="pt-4 flex justify-end">
            <button type="button" onClick={() => goToStep(2)} className={nextButtonClass}>
              Next: Select Party Size <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Party Size Selection */}
      {step === 2 && (
        <div className={panelClass} role="group" aria-labelledby={`${fieldId}-step2`}>
          <div className="flex items-center justify-between">
            <h2 id={`${fieldId}-step2`} ref={stepHeadingRef} tabIndex={-1} className={stepHeadingClass}>
              <Users className="w-4 h-4 text-[#7A2322]" aria-hidden="true" />
              <span>Select Guest Count ({date})</span>
            </h2>
            <button type="button" onClick={() => goToStep(1)} className="text-xs text-[#6B635A] underline">
              Change Date
            </button>
          </div>

          <RadioGrid
            legend={`Number of guests for ${date}`}
            name={`${fieldId}-party`}
            value={partySize}
            onChange={setPartySize}
            gridClassName="grid grid-cols-3 sm:grid-cols-6 gap-3"
            cellClassName={({ checked }) =>
              `py-3 text-center border font-mono-data text-sm transition-all ${
                checked
                  ? 'bg-[#7A2322] border-[#7A2322] text-[#F7F4EE] font-bold'
                  : 'bg-[#EFE6D5] border-[#38322D]/30 text-[#1A1715] hover:border-[#1A1715]'
              }`
            }
            options={PARTY_SIZES.map((num) => ({
              value: num,
              label: `${num} ${num === 1 ? 'guest' : 'guests'}`,
              content: (
                <>
                  {num} {num === 1 ? 'Guest' : 'Guests'}
                </>
              ),
            }))}
          />

          <div className="pt-4 flex justify-between">
            <button type="button" onClick={() => goToStep(1)} className={backButtonClass}>
              <span aria-hidden="true">←</span> Back
            </button>
            <button type="button" onClick={() => goToStep(3)} className={nextButtonClass}>
              Next: Choose Sitting Time <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Time Slot Selection (Queried Real Availability) */}
      {step === 3 && (
        <div className={panelClass} role="group" aria-labelledby={`${fieldId}-step3`}>
          <div className="flex items-center justify-between border-b border-[#DDD6C8] pb-3">
            <h2 id={`${fieldId}-step3`} ref={stepHeadingRef} tabIndex={-1} className={stepHeadingClass}>
              <Clock className="w-4 h-4 text-[#7A2322]" aria-hidden="true" />
              <span>Available Sitting Times for {partySize} guests on {date}</span>
            </h2>
            <button type="button" onClick={() => goToStep(2)} className="text-xs text-[#6B635A] underline">
              Edit Party ({partySize})
            </button>
          </div>

          {loadingSlots ? (
            <p className="py-8 text-center text-xs font-mono-data text-[#6B635A] animate-pulse">
              Querying live hearth capacity...
            </p>
          ) : (
            <RadioGrid
              legend={`Sitting time for ${partySize} guests on ${date}`}
              name={`${fieldId}-time`}
              value={selectedTime || null}
              onChange={(time) => {
                setSelectedTime(time);
                setErrorMsg(null);
              }}
              gridClassName="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3"
              cellClassName={({ checked, disabled }) =>
                `block p-3 text-left border transition-all ${
                  disabled
                    ? 'bg-[#1A1715]/5 border-[#DDD6C8] text-[#8A827A] opacity-50'
                    : checked
                    ? 'bg-[#7A2322] border-[#7A2322] text-[#F7F4EE] shadow-sm'
                    : 'bg-[#EFE6D5] border-[#38322D]/30 text-[#1A1715] hover:border-[#1A1715]'
                }`
              }
              options={slots.map((s) => ({
                value: s.time,
                disabled: !s.isAvailable,
                label: s.isAvailable
                  ? `${s.time}, ${s.availableCovers} covers open`
                  : `${s.time}, unavailable — ${s.reason || 'committed'}`,
                content: (
                  <>
                    <span className="block font-mono-data text-base font-bold">{s.time}</span>
                    <span className="block text-[10px] uppercase font-mono-data mt-1 opacity-90">
                      {s.isAvailable ? `${s.availableCovers} covers open` : s.reason || 'Committed'}
                    </span>
                  </>
                ),
              }))}
            />
          )}

          <div className="pt-4 flex justify-between items-center">
            <button type="button" onClick={() => goToStep(2)} className={backButtonClass}>
              <span aria-hidden="true">←</span> Back
            </button>
            <button
              type="button"
              disabled={!selectedTime}
              onClick={() => goToStep(4)}
              className={`px-6 py-2.5 text-xs font-sans-ui uppercase tracking-widest transition-colors ${
                selectedTime
                  ? 'bg-[#1A1715] text-[#F7F4EE] hover:bg-[#7A2322]'
                  : 'bg-[#DDD6C8] text-[#8A827A] cursor-not-allowed'
              }`}
            >
              Next: Guest Details <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Details & Submit */}
      {step === 4 && (
        <form onSubmit={handleSubmit} className={panelClass} aria-describedby={errorMsg ? errorId : undefined}>
          <div className="border-b border-[#DDD6C8] pb-4 flex justify-between items-center">
            <div>
              <span className="text-xs font-mono-data text-[#8C6E43] uppercase tracking-wider">
                Sitting Selected
              </span>
              <h2 id={`${fieldId}-step4`} ref={stepHeadingRef} tabIndex={-1} className="font-display text-2xl text-[#1A1715]">
                {date} at {selectedTime} · {partySize} Guests
              </h2>
            </div>
            <button type="button" onClick={() => goToStep(3)} className="text-xs text-[#6B635A] underline">
              Change Time
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor={`${fieldId}-name`} className={labelClass}>
                Full Name <span aria-hidden="true">*</span>
              </label>
              <input
                id={`${fieldId}-name`}
                type="text"
                required
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Eleanor Vance"
                className={fieldClass}
              />
            </div>

            <div>
              <label htmlFor={`${fieldId}-email`} className={labelClass}>
                Email Address <span aria-hidden="true">*</span>
              </label>
              <input
                id={`${fieldId}-email`}
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="eleanor@vance.co"
                className={fieldClass}
              />
            </div>

            <div>
              <label htmlFor={`${fieldId}-phone`} className={labelClass}>
                Telephone Number <span aria-hidden="true">*</span>
              </label>
              <input
                id={`${fieldId}-phone`}
                type="tel"
                required
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+44 7700 900077"
                className={fieldClass}
              />
            </div>

            <div>
              <label htmlFor={`${fieldId}-notes`} className={labelClass}>
                Special Cut or Dietary Notes
              </label>
              <input
                id={`${fieldId}-notes`}
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Requesting 45-day Bone-in Ribeye"
                className={fieldClass}
              />
            </div>
          </div>

          <p className="p-4 bg-[#1A1715]/5 border border-[#DDD6C8] text-xs font-serif-body text-[#6B635A] italic">
            Reservations are held for 15 minutes past sitting time. Sittings last 1 hour 45 minutes.
          </p>

          <div className="pt-4 flex justify-between items-center">
            <button type="button" onClick={() => goToStep(3)} className={backButtonClass}>
              <span aria-hidden="true">←</span> Back
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-8 py-3.5 bg-[#7A2322] hover:bg-[#581413] text-[#F7F4EE] text-xs font-sans-ui uppercase tracking-widest transition-colors flex items-center space-x-2 disabled:opacity-60"
            >
              {submitting ? (
                <span>Confirming Sitting...</span>
              ) : (
                <span>
                  Complete Reservation <span aria-hidden="true">→</span>
                </span>
              )}
            </button>
          </div>
        </form>
      )}

    </div>
  );
};
