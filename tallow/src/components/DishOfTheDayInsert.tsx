import React from 'react';
import { MenuItem } from '../types';
import { formatPrice } from '../lib/money';
import { Flame, AlertTriangle } from 'lucide-react';

interface DishOfTheDayInsertProps {
  dish: MenuItem | null;
  onReserveClick: () => void;
}

export const DishOfTheDayInsert: React.FC<DishOfTheDayInsertProps> = ({ dish, onReserveClick }) => {
  if (!dish) return null;

  return (
    <div className="relative my-8 max-w-xl mx-auto px-4">
      {/* Tipped-In Editorial Card with paper shadow and rotation.
          The tilt is the printed artefact and stays; only the straightening on
          hover is motion, so that is what motion-safe gates. */}
      <div
        className={`relative insert-stock p-6 sm:p-8 border border-[#38322D]/20 transform -rotate-1 sm:-rotate-1.5 transition-transform motion-safe:hover:rotate-0 duration-300 ${
          dish.is86 ? 'opacity-70' : ''
        }`}
        style={{
          boxShadow: '4px 8px 24px rgba(26, 23, 21, 0.08)',
        }}
      >
        {/* Paper Corner Pin Accent */}
        <div className="absolute -top-3 left-6 bg-[#7A2322] text-[#F7F4EE] px-3 py-0.5 text-[10px] tracking-[0.2em] uppercase font-mono-data">
          Tipped-In Insert · Today's Cut
        </div>

        <div className="flex justify-between items-start pt-2 mb-4 border-b border-[#38322D]/15 pb-3">
          <div>
            <span className="text-xs uppercase tracking-widest font-mono-data text-[#755C38]">
              Hearth Feature No. {dish.agingDays || 45}
            </span>
            <h2 className="font-display text-2xl sm:text-3xl text-[#1A1715] mt-1 leading-tight">
              {dish.name}
            </h2>
            {dish.cutName && (
              <p className="text-xs italic font-serif-body text-[#665E56]">
                {dish.cutName}
              </p>
            )}
          </div>

          <div className="text-right">
            <span className="font-display text-2xl sm:text-3xl text-[#7A2322]">
              {formatPrice(dish.price)}
            </span>
            <p className="text-[10px] font-mono-data uppercase tracking-wider text-[#665E56]">
              per portion
            </p>
          </div>
        </div>

        {/* Structured Spec Grid */}
        <dl className="grid grid-cols-3 gap-2 py-2 mb-3 bg-[#1A1715]/5 px-3 text-center text-xs font-mono-data border border-[#38322D]/10">
          <div>
            <dt className="block text-[9px] uppercase text-[#665E56]">Cut Spec</dt>
            <dd className="font-medium text-[#1A1715]">{dish.cutName || 'Primal Cut'}</dd>
          </div>
          <div>
            <dt className="block text-[9px] uppercase text-[#665E56]">Dry Aging</dt>
            <dd className="font-medium text-[#1A1715]">{dish.agingDays ? `${dish.agingDays} Days` : 'Fresh Cut'}</dd>
          </div>
          <div>
            <dt className="block text-[9px] uppercase text-[#665E56]">Portion Weight</dt>
            <dd className="font-medium text-[#1A1715]">{dish.weightGrams ? `${dish.weightGrams}g` : 'Shared'}</dd>
          </div>
        </dl>

        <p className="text-sm font-serif-body leading-relaxed text-[#1A1715] mb-6">
          {dish.description}
        </p>

        <div className="flex items-center justify-between pt-2 border-t border-[#38322D]/15">
          {dish.is86 ? (
            <p className="flex items-center space-x-2 text-[#7A2322] text-xs font-mono-data uppercase tracking-wider">
              <AlertTriangle className="w-4 h-4" aria-hidden="true" />
              <span className="line-through font-bold">86'd — Sold Out for Today's Service</span>
            </p>
          ) : (
            <p className="flex items-center space-x-2 text-xs font-mono-data text-[#755C38] uppercase tracking-wider">
              <Flame className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Oak Ember Seared · Limited Sittings</span>
            </p>
          )}

          {!dish.is86 && (
            <button
              type="button"
              onClick={onReserveClick}
              className="px-4 py-2 bg-[#1A1715] hover:bg-[#7A2322] text-[#F7F4EE] text-xs font-sans-ui uppercase tracking-widest transition-colors"
            >
              Request Cut
              <span className="sr-only"> — {dish.name}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
