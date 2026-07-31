import React, { useState } from 'react';
import { Plus, Trash2, Edit2 } from 'lucide-react';
import { MenuItem } from '../../types';
import { adminFetch } from '../../lib/session';
import { useStaffSession } from './StaffSessionContext';
import { MenuItemDialog } from './MenuItemDialog';

interface MenuManagerPanelProps {
  menuItems: MenuItem[];
  onMenuUpdated: () => void;
}

export const MenuManagerPanel: React.FC<MenuManagerPanelProps> = ({ menuItems, onMenuUpdated }) => {
  const { writeProps, writeClass, reportActionError } = useStaffSession();

  const [editingItem, setEditingItem] = useState<Partial<MenuItem> | null>(null);
  const [isNewItem, setIsNewItem] = useState(false);
  // Deleting a dish is destructive and irreversible, so the button asks once
  // before it does it — in the page, not through a native confirm().
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');

  const handleSaveMenuItem = async (item: Partial<MenuItem>) => {
    try {
      const res = await adminFetch('/api/admin/menu/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      });
      if (res.ok) {
        setAnnouncement(`${item.name} saved.`);
        setEditingItem(null);
        onMenuUpdated();
      }
    } catch (err) {
      reportActionError(err, 'Failed to save menu item.');
    }
  };

  const handleDeleteMenuItem = async (item: MenuItem) => {
    try {
      const res = await adminFetch(`/api/admin/menu/${item.id}`, { method: 'DELETE' });
      if (res.ok) {
        setAnnouncement(`${item.name} removed from the menu.`);
        setConfirmingDeleteId(null);
        onMenuUpdated();
      }
    } catch (err) {
      reportActionError(err, 'Failed to delete menu item.');
    }
  };

  const handleSetDishOfDay = async (item: MenuItem) => {
    try {
      const res = await adminFetch('/api/admin/dish-of-the-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menuItemId: item.id }),
      });
      if (res.ok) {
        setAnnouncement(`${item.name} is now the dish of the day.`);
        onMenuUpdated();
      }
    } catch (err) {
      reportActionError(err, 'Failed to set dish of the day.');
    }
  };

  return (
    <div className="space-y-8">

      <div className="flex justify-between items-center border-b border-[#DDD6C8] pb-4">
        <h2 className="font-display text-2xl text-[#1A1715]">Menu CRUD &amp; Dish of the Day</h2>
        <button
          type="button"
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
          {...writeProps}
          className={`px-4 py-2 bg-[#1A1715] text-[#F7F4EE] text-xs font-sans-ui uppercase tracking-widest flex items-center space-x-2${writeClass}`}
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>Add New Menu Cut</span>
        </button>
      </div>

      <p aria-live="polite" className="sr-only">{announcement}</p>

      {/* Menu Items CRUD List */}
      <ul className="space-y-4">
        {menuItems.map((item) => (
          <li
            key={item.id}
            className="p-4 bg-[#F7F4EE] border border-[#DDD6C8] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
          >
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <h3 className="font-display text-xl text-[#1A1715]">{item.name}</h3>
                {item.isDishOfDay && (
                  <span className="text-[10px] font-mono-data bg-[#8C6E43] text-[#F7F4EE] px-2 py-0.5 uppercase">
                    Current Dish of Day
                  </span>
                )}
              </div>
              <p className="text-xs font-mono-data text-[#8C6E43] uppercase">
                Cat: {item.category} · Price: £{item.price} ·{' '}
                {item.agingDays ? `${item.agingDays}d Aged` : 'Fresh'} ·{' '}
                {item.weightGrams ? `${item.weightGrams}g` : 'Standard'}
              </p>
            </div>

            <div className="flex items-center space-x-3 w-full sm:w-auto">
              {!item.isDishOfDay && (
                <button
                  type="button"
                  onClick={() => handleSetDishOfDay(item)}
                  {...writeProps}
                  className={`px-3 py-1.5 border border-[#8C6E43] text-[#8C6E43] hover:bg-[#8C6E43] hover:text-[#F7F4EE] text-xs font-mono-data uppercase${writeClass}`}
                >
                  Make Dish of Day
                  <span className="sr-only"> — {item.name}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setEditingItem(item);
                  setIsNewItem(false);
                }}
                {...writeProps}
                className={`p-2 border border-[#38322D] text-[#1A1715] hover:bg-[#1A1715] hover:text-[#F7F4EE]${writeClass}`}
              >
                <Edit2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="sr-only">Edit {item.name}</span>
              </button>

              {confirmingDeleteId === item.id ? (
                <span className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleDeleteMenuItem(item)}
                    className="px-3 py-1.5 bg-[#7A2322] text-[#F7F4EE] text-xs font-mono-data uppercase"
                  >
                    Confirm removal
                    <span className="sr-only"> of {item.name}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingDeleteId(null)}
                    className="px-3 py-1.5 border border-[#38322D] text-[#1A1715] text-xs font-mono-data uppercase"
                  >
                    Keep
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingDeleteId(item.id)}
                  {...writeProps}
                  className={`p-2 border border-[#7A2322] text-[#7A2322] hover:bg-[#7A2322] hover:text-[#F7F4EE]${writeClass}`}
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span className="sr-only">Remove {item.name} from the menu</span>
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {editingItem && (
        <MenuItemDialog
          item={editingItem}
          isNew={isNewItem}
          onChange={setEditingItem}
          onClose={() => setEditingItem(null)}
          onSave={handleSaveMenuItem}
        />
      )}

    </div>
  );
};
