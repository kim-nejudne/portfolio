import React, { useId, useRef, useState } from 'react';
import { MapPin, Clock, Send, CheckCircle } from 'lucide-react';

const HOURS = [
  { days: 'Wednesday – Friday', times: '17:00 – 23:00' },
  { days: 'Saturday', times: '12:00 – 15:30 · 17:00 – 23:30' },
  { days: 'Sunday', times: '12:00 – 21:00 (Feast)' },
] as const;

export const VisitView: React.FC = () => {
  const [inquirySubmitted, setInquirySubmitted] = useState(false);
  const [inquiryName, setInquiryName] = useState('');
  const [inquiryEmail, setInquiryEmail] = useState('');
  const [inquiryGuests, setInquiryGuests] = useState('12');
  const [inquiryMessage, setInquiryMessage] = useState('');

  const fieldId = useId();
  const confirmationRef = useRef<HTMLDivElement>(null);

  const handleInquirySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setInquirySubmitted(true);
    // The form is replaced by the confirmation, so focus has to follow it or it
    // falls back to the top of the document.
    requestAnimationFrame(() => confirmationRef.current?.focus());
  };

  const fieldClass =
    'px-3 py-2 bg-[#F7F4EE] border border-[#38322D] text-xs font-sans-ui text-[#1A1715]';
  const labelClass = 'block text-[10px] font-mono-data uppercase tracking-wider text-[#1A1715] mb-1';

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 sm:px-8 space-y-16">

      {/* Header */}
      <div className="text-center border-b-2 border-[#1A1715] pb-8">
        <span className="font-mono-data text-[10px] uppercase tracking-[0.3em] text-[#8C6E43] block mb-2">
          Location & Operating Hours
        </span>
        <h1 className="font-display text-4xl sm:text-6xl text-[#1A1715] tracking-tight">
          VISIT TALLOW
        </h1>
        <p className="font-serif-body text-base text-[#6B635A] max-w-xl mx-auto mt-2 italic">
          Soho, London. Four minutes walk from Piccadilly Circus Station.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">

        {/* Left Column: Hours & Address */}
        <div className="md:col-span-6 space-y-8 bg-[#F7F4EE] p-6 border border-[#DDD6C8]">

          <section aria-labelledby={`${fieldId}-hours`}>
            <h2 id={`${fieldId}-hours`} className="flex items-center space-x-2 text-xs font-mono-data text-[#8C6E43] uppercase tracking-widest mb-3">
              <Clock className="w-4 h-4 text-[#7A2322]" aria-hidden="true" />
              <span>Service Sittings</span>
            </h2>
            <dl className="space-y-2 text-xs font-mono-data">
              {HOURS.map(({ days, times }) => (
                <div key={days} className="flex justify-between border-b border-[#DDD6C8] pb-1">
                  <dt className="font-bold text-[#1A1715]">{days}</dt>
                  <dd className="text-[#6B635A]">{times}</dd>
                </div>
              ))}
              <div className="flex justify-between text-[#7A2322]">
                <dt className="font-bold">Monday &amp; Tuesday</dt>
                <dd>Closed for Dry-Ageing &amp; Butchery</dd>
              </div>
            </dl>
          </section>

          <section aria-labelledby={`${fieldId}-address`}>
            <h2 id={`${fieldId}-address`} className="flex items-center space-x-2 text-xs font-mono-data text-[#8C6E43] uppercase tracking-widest mb-3">
              <MapPin className="w-4 h-4 text-[#7A2322]" aria-hidden="true" />
              <span>Address &amp; Direct Contacts</span>
            </h2>
            <address className="not-italic space-y-2 text-xs font-mono-data text-[#1A1715]">
              <p className="font-bold text-sm">TALLOW Soho</p>
              <p>14 Beak Street, Soho</p>
              <p>London W1F 9RD, United Kingdom</p>
              <p className="pt-2">
                <a href="tel:+442079460912" className="text-[#7A2322] underline underline-offset-2">
                  Tel: +44 (0)20 7946 0912
                </a>
              </p>
              <p>
                <a href="mailto:hearth@tallow-soho.co.uk" className="text-[#6B635A] underline underline-offset-2">
                  Reservations: hearth@tallow-soho.co.uk
                </a>
              </p>
            </address>
          </section>

        </div>

        {/* Right Column: Custom Map Representation Card */}
        <div className="md:col-span-6 bg-[#EFE6D5] p-6 border border-[#38322D]/20 space-y-4">
          <div className="flex items-center justify-between border-b border-[#38322D]/20 pb-3">
            <h2 className="font-mono-data text-xs uppercase tracking-wider text-[#1A1715] font-bold">
              Soho Map Location
            </h2>
            <span className="font-mono-data text-[10px] text-[#8C6E43] uppercase">
              Beak St &amp; Regent St Corner
            </span>
          </div>

          <div className="relative aspect-[4/3] bg-[#1A1715] text-[#F7F4EE] p-6 flex flex-col justify-between overflow-hidden">
            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#F7F4EE_1px,transparent_1px)] [background-size:16px_16px]" aria-hidden="true"></div>

            <div className="relative z-10">
              <span className="text-[10px] font-mono-data text-[#8C6E43] uppercase tracking-widest">
                LONDON W1F 9RD
              </span>
              <p className="font-display text-2xl text-[#F7F4EE] mt-1">14 BEAK STREET</p>
            </div>

            <div className="relative z-10 p-3 bg-[#F7F4EE] text-[#1A1715] border-l-4 border-[#7A2322]">
              <p className="font-mono-data text-xs font-bold uppercase">TALLOW HEARTH</p>
              <p className="font-serif-body text-xs text-[#6B635A]">4 min walk from Piccadilly Circus Station (Bakerloo / Piccadilly lines)</p>
            </div>
          </div>

          <a
            href="https://maps.google.com/?q=14+Beak+Street+Soho+London"
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center py-2 bg-[#1A1715] text-[#F7F4EE] text-xs font-sans-ui uppercase tracking-widest hover:bg-[#7A2322] transition-colors"
          >
            Open in Google Maps
            <span className="sr-only"> (opens in a new tab)</span>
            <span aria-hidden="true"> →</span>
          </a>
        </div>

      </div>

      {/* Private Dining Inquiry Block */}
      <section aria-labelledby={`${fieldId}-private`} className="insert-stock p-8 border border-[#38322D]/20 max-w-3xl mx-auto">
        <div className="text-center mb-6">
          <span className="font-mono-data text-[10px] uppercase tracking-[0.25em] text-[#8C6E43]">
            Exclusive Sittings
          </span>
          <h2 id={`${fieldId}-private`} className="font-display text-3xl text-[#1A1715] mt-1">
            PRIVATE DINING ROOM & FULL HEARTH HIRE
          </h2>
          <p className="font-serif-body text-sm text-[#6B635A] max-w-lg mx-auto mt-1">
            Our private dining room accommodates up to 14 guests around a single oak table overlooking the dry-ageing chamber.
          </p>
        </div>

        {inquirySubmitted ? (
          <div
            ref={confirmationRef}
            tabIndex={-1}
            role="status"
            className="p-6 bg-[#1A1715]/5 border border-[#8C6E43] text-center space-y-2"
          >
            <CheckCircle className="w-6 h-6 text-[#7A2322] mx-auto" aria-hidden="true" />
            <h3 className="font-display text-xl text-[#1A1715]">Private Sitting Enquiry Noted</h3>
            <p className="font-serif-body text-xs text-[#6B635A]">
              Private hire for {inquiryGuests === 'full' ? 'the full restaurant' : `${inquiryGuests} guests`} is
              arranged by hand rather than through the booking engine. Write to{' '}
              <a href="mailto:hearth@tallow-soho.co.uk" className="text-[#7A2322] underline underline-offset-2">
                hearth@tallow-soho.co.uk
              </a>{' '}
              or call +44 (0)20 7946 0912 and the maître d' will confirm availability within 24 hours.
            </p>
          </div>
        ) : (
          <form onSubmit={handleInquirySubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor={`${fieldId}-inq-name`} className={labelClass}>
                  Full Name <span aria-hidden="true">*</span>
                </label>
                <input
                  id={`${fieldId}-inq-name`}
                  type="text"
                  required
                  autoComplete="name"
                  value={inquiryName}
                  onChange={(e) => setInquiryName(e.target.value)}
                  className={`w-full ${fieldClass}`}
                />
              </div>

              <div>
                <label htmlFor={`${fieldId}-inq-email`} className={labelClass}>
                  Email Address <span aria-hidden="true">*</span>
                </label>
                <input
                  id={`${fieldId}-inq-email`}
                  type="email"
                  required
                  autoComplete="email"
                  value={inquiryEmail}
                  onChange={(e) => setInquiryEmail(e.target.value)}
                  className={`w-full ${fieldClass}`}
                />
              </div>

              <div>
                <label htmlFor={`${fieldId}-inq-guests`} className={labelClass}>
                  Party Size
                </label>
                <select
                  id={`${fieldId}-inq-guests`}
                  value={inquiryGuests}
                  onChange={(e) => setInquiryGuests(e.target.value)}
                  className={`w-full ${fieldClass} font-mono-data`}
                >
                  <option value="8">8 Guests</option>
                  <option value="10">10 Guests</option>
                  <option value="12">12 Guests</option>
                  <option value="14">14 Guests (Max)</option>
                  <option value="full">Full Restaurant Hire</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor={`${fieldId}-inq-message`} className={labelClass}>
                Preferred Date &amp; Bespoke Menu Requirements
              </label>
              <textarea
                id={`${fieldId}-inq-message`}
                rows={3}
                value={inquiryMessage}
                onChange={(e) => setInquiryMessage(e.target.value)}
                className={`w-full p-3 bg-[#F7F4EE] border border-[#38322D] text-xs font-serif-body text-[#1A1715]`}
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-[#1A1715] hover:bg-[#7A2322] text-[#F7F4EE] text-xs font-sans-ui uppercase tracking-widest transition-colors flex items-center justify-center space-x-2"
            >
              <Send className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Submit Private Sitting Inquiry</span>
            </button>
          </form>
        )}
      </section>

    </div>
  );
};
