import React, { useState } from 'react';
import { MenuItem } from '../../types';
import { adminFetch } from '../../lib/session';
import { useStaffSession } from './StaffSessionContext';

interface Board86PanelProps {
  menuItems: MenuItem[];
  onMenuUpdated: () => void;
}

export const Board86Panel: React.FC<Board86PanelProps> = ({ menuItems, onMenuUpdated }) => {
  const { writeProps, writeClass, reportActionError } = useStaffSession();
  // Named rather than boolean so the announcement can say which dish changed.
  const [lastChange, setLastChange] = useState<string>('');
  const [pendingId, setPendingId] = useState<string | null>(null);

  const handleToggle86 = async (item: MenuItem) => {
    setPendingId(item.id);
    try {
      const res = await adminFetch('/api/admin/86', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menuItemId: item.id, is86: !item.is86 }),
      });
      if (res.ok) {
        setLastChange(
          item.is86
            ? `${item.name} re-listed on the guest menu.`
            : `${item.name} struck from the guest menu.`
        );
        onMenuUpdated();
      }
    } catch (err) {
      reportActionError(err, 'Failed to toggle 86 status.');
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="sr-only">86 board</h2>

      <p className="p-4 bg-[#7A2322]/10 border border-[#7A2322] text-[#7A2322] text-xs font-mono-data leading-relaxed">
        <span className="font-bold block uppercase mb-1">Live Back-of-House 86 Board</span>
        Toggling a dish 86'd here immediately strikes the item on the public guest menu.
      </p>

      {/* The consequence of this control lands on a different screen entirely,
          so the confirmation has to be spoken here. */}
      <p aria-live="polite" className="sr-only">{lastChange}</p>

      <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {menuItems.map((item) => (
          <li
            key={item.id}
            className={`p-4 border transition-all ${
              item.is86 ? 'bg-[#1A1715]/10 border-[#7A2322]' : 'bg-[#F7F4EE] border-[#DDD6C8]'
            }`}
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <span className="text-[10px] font-mono-data uppercase text-[#8C6E43]">
                  {item.category}
                </span>
                <h3 className={`menu-line font-display text-xl ${item.is86 ? 'item-86 text-[#7A2322]' : 'text-[#1A1715]'}`}>
                  {item.name}
                </h3>
              </div>
              <span className="font-display text-lg text-[#7A2322]">£{item.price}</span>
            </div>

            <div className="mt-4 flex items-center justify-between pt-3 border-t border-[#DDD6C8]">
              <span className="text-xs font-mono-data uppercase">
                {item.is86 ? (
                  <span className="text-[#7A2322] font-bold">STRIKE (86'd)</span>
                ) : (
                  <span className="text-[#8C6E43]">AVAILABLE</span>
                )}
              </span>

              <button
                type="button"
                onClick={() => handleToggle86(item)}
                {...writeProps}
                disabled={writeProps.disabled || pendingId === item.id}
                className={`px-3 py-1.5 text-xs font-mono-data uppercase tracking-wider transition-colors ${
                  item.is86
                    ? 'bg-[#1A1715] text-[#F7F4EE] hover:bg-[#8C6E43]'
                    : 'bg-[#7A2322] text-[#F7F4EE] hover:bg-[#581413]'
                }${writeClass}`}
              >
                {item.is86 ? 'Re-List Dish' : '86 Dish Now'}
                {/* Ten identical "86 Dish Now" buttons need distinguishing when
                    they are read out of context in a controls list. */}
                <span className="sr-only"> — {item.name}</span>
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};
