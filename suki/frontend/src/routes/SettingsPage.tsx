import { useState } from 'react';
import { getSessionSync, updateSession } from '../lib/api/session';
import { parsePesoInput } from '../lib/money';
import { BigButton } from '../components/BigButton';
import { useUnlock } from '../lib/unlock';
import { useNavigate } from 'react-router-dom';

export function SettingsPage() {
  const s = getSessionSync();
  const [storeName, setStoreName] = useState(s.storeName);
  const [barangay, setBarangay] = useState(s.barangay);
  const [reorderRaw, setReorderRaw] = useState(String(s.defaultReorderPoint));
  const [saved, setSaved] = useState(false);
  const { lock } = useUnlock();
  const navigate = useNavigate();

  const reorder = parsePesoInput(reorderRaw);
  const invalid = reorder === null || reorder < 0;

  function save() {
    if (invalid) return;
    updateSession({
      storeName: storeName.trim() || s.storeName,
      barangay: barangay.trim() || s.barangay,
      defaultReorderPoint: reorder ?? s.defaultReorderPoint,
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1400);
  }

  return (
    <>
      <header className="rule px-4 pt-4 pb-3">
        <h1 className="text-[24px] leading-tight">Settings</h1>
        <p className="text-[13px] text-muted">The plain details of the shop.</p>
      </header>

      <section className="rule px-4 py-4">
        <label htmlFor="s-name" className="block mono uppercase text-[11px] text-muted mb-1">Store name</label>
        <input id="s-name" value={storeName} onChange={(e) => setStoreName(e.target.value)}
          className="w-full text-[16px]"
          style={{ minHeight: 'var(--tap-min)', borderBottom: '1px solid var(--color-rule)' }}
        />

        <label htmlFor="s-brgy" className="block mono uppercase text-[11px] text-muted mb-1 mt-4">Barangay</label>
        <input id="s-brgy" value={barangay} onChange={(e) => setBarangay(e.target.value)}
          className="w-full text-[16px]"
          style={{ minHeight: 'var(--tap-min)', borderBottom: '1px solid var(--color-rule)' }}
        />
      </section>

      <section className="rule px-4 py-4">
        <p className="mono uppercase text-[11px] text-muted">Paydays</p>
        <p className="text-[15px] mt-1">Kinsenas — the 15th of every month.</p>
        <p className="text-[15px]">Katapusan — the last day of every month.</p>
        <p className="mono text-[12px] text-muted mt-2">These are the paydays of Dumaguete and do not change.</p>
      </section>

      <section className="rule px-4 py-4">
        <label htmlFor="s-reorder" className="block mono uppercase text-[11px] text-muted mb-1">Default reorder point</label>
        <input id="s-reorder" inputMode="numeric" pattern="[0-9]*" value={reorderRaw}
          onChange={(e) => setReorderRaw(e.target.value)}
          className="amount text-[20px] w-24"
          style={{ minHeight: 'var(--tap-min)', borderBottom: '1px solid var(--color-rule)' }}
          aria-invalid={invalid}
        />
        <p className="text-[13px] text-muted mt-2">New items start flagged once they fall below this count.</p>
      </section>

      <div className="px-4 py-4">
        <BigButton variant="ink" onClick={save} disabled={invalid} style={{ width: '100%' }} data-testid="settings-save">
          {saved ? 'Saved' : 'Save'}
        </BigButton>
      </div>

      <div className="px-4 pb-8">
        <BigButton variant="outline" onClick={() => { lock(); navigate('/unlock', { replace: true }); }} style={{ width: '100%' }}>
          Lock the counter
        </BigButton>
      </div>
    </>
  );
}
