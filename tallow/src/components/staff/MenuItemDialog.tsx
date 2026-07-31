import React, { useCallback, useId, useRef, useState } from 'react';
import { MenuCategory, MenuItem } from '../../types';
import { useFocusTrap } from '../../lib/useFocusTrap';

interface MenuItemDialogProps {
  item: Partial<MenuItem>;
  isNew: boolean;
  onChange: (item: Partial<MenuItem>) => void;
  onClose: () => void;
  onSave: (item: Partial<MenuItem>) => Promise<void>;
}

const CATEGORIES: MenuCategory[] = ['cuts', 'starters', 'sides', 'sauces', 'desserts', 'drinks'];

/** Empty numeric fields must stay empty, not collapse to NaN or 0. */
function parseOptionalNumber(value: string): number | undefined {
  if (value.trim() === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export const MenuItemDialog: React.FC<MenuItemDialogProps> = ({
  item,
  isNew,
  onChange,
  onClose,
  onSave,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const fieldId = useId();
  const [saving, setSaving] = useState(false);

  const handleEscape = useCallback(() => onClose(), [onClose]);
  useFocusTrap(dialogRef, { active: true, onEscape: handleEscape });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(item);
    } finally {
      setSaving(false);
    }
  };

  const fieldClass = 'w-full p-2 bg-[#EFE6D5] border border-[#38322D]';
  const labelClass = 'block text-[#1A1715] mb-1';

  return (
    <div
      className="fixed inset-0 z-50 bg-[#1A1715]/70 flex items-center justify-center p-4"
      // Clicking the backdrop dismisses, but only the backdrop itself — a drag
      // that starts inside the form and ends outside must not close it.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${fieldId}-title`}
        className="bg-[#F7F4EE] border-2 border-[#1A1715] p-6 max-w-lg w-full space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <h2 id={`${fieldId}-title`} className="font-display text-2xl text-[#1A1715]">
          {isNew ? 'Create New Dish' : 'Edit Menu Selection'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-3 font-mono-data text-xs">
          <div>
            <label htmlFor={`${fieldId}-name`} className={labelClass}>
              Dish Name <span aria-hidden="true">*</span>
            </label>
            <input
              id={`${fieldId}-name`}
              type="text"
              required
              value={item.name || ''}
              onChange={(e) => onChange({ ...item, name: e.target.value })}
              className={fieldClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor={`${fieldId}-category`} className={labelClass}>
                Category <span aria-hidden="true">*</span>
              </label>
              <select
                id={`${fieldId}-category`}
                value={item.category || 'cuts'}
                onChange={(e) => onChange({ ...item, category: e.target.value as MenuCategory })}
                className={fieldClass}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor={`${fieldId}-price`} className={labelClass}>
                Price (£) <span aria-hidden="true">*</span>
              </label>
              <input
                id={`${fieldId}-price`}
                type="number"
                required
                min={0}
                step="0.01"
                value={item.price ?? ''}
                onChange={(e) => onChange({ ...item, price: parseOptionalNumber(e.target.value) as number })}
                className={fieldClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label htmlFor={`${fieldId}-cut`} className={labelClass}>Cut Spec</label>
              <input
                id={`${fieldId}-cut`}
                type="text"
                value={item.cutName || ''}
                onChange={(e) => onChange({ ...item, cutName: e.target.value })}
                placeholder="e.g. Flank"
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor={`${fieldId}-aging`} className={labelClass}>Aging (Days)</label>
              <input
                id={`${fieldId}-aging`}
                type="number"
                min={0}
                value={item.agingDays ?? ''}
                onChange={(e) => onChange({ ...item, agingDays: parseOptionalNumber(e.target.value) })}
                placeholder="e.g. 45"
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor={`${fieldId}-weight`} className={labelClass}>Weight (g)</label>
              <input
                id={`${fieldId}-weight`}
                type="number"
                min={0}
                value={item.weightGrams ?? ''}
                onChange={(e) => onChange({ ...item, weightGrams: parseOptionalNumber(e.target.value) })}
                placeholder="e.g. 800"
                className={fieldClass}
              />
            </div>
          </div>

          <div>
            <label htmlFor={`${fieldId}-photo`} className={labelClass}>Image URL</label>
            <input
              id={`${fieldId}-photo`}
              type="url"
              value={item.photoUrl || ''}
              onChange={(e) => onChange({ ...item, photoUrl: e.target.value })}
              placeholder="https://..."
              className={fieldClass}
            />
          </div>

          <div>
            <label htmlFor={`${fieldId}-description`} className={labelClass}>Description Prose</label>
            <textarea
              id={`${fieldId}-description`}
              rows={3}
              value={item.description || ''}
              onChange={(e) => onChange({ ...item, description: e.target.value })}
              className={`${fieldClass} font-serif-body`}
            />
          </div>

          <div className="pt-4 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-[#38322D] text-[#1A1715]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-[#7A2322] text-[#F7F4EE] hover:bg-[#581413] disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save Dish'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
