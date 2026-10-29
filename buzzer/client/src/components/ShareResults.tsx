import { useState } from 'react';
import {
  RESULTS_FILE,
  renderResultsCard,
  shareOrDownload,
  type ResultsCardInput,
} from '../lib/resultsCard.js';

interface ShareResultsProps {
  /** The card's data, read at the tap, so the card shows the latest scores. */
  card: () => ResultsCardInput | null;
  /** `share` opens the share sheet where it can take files; `download` always saves the PNG. */
  mode: 'share' | 'download';
  className: string;
}

/** **Share results** (remote, phone) or **Download results** (Screen): the results card PNG (F78). */
export function ShareResults({ card, mode, className }: ShareResultsProps) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function onClick() {
    const input = card();
    if (!input) return;
    setBusy(true);
    setStatus(null);
    try {
      const outcome = await shareOrDownload(await renderResultsCard(input), mode);
      if (outcome === 'downloaded') setStatus(`Saved ${RESULTS_FILE}`);
    } catch {
      setStatus('Couldn’t make the image');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => void onClick()} disabled={busy} className={className}>
        {mode === 'share' ? 'Share results' : 'Download results'}
      </button>
      {status && (
        <p role="status" className="text-center text-muted">
          {status}
        </p>
      )}
    </>
  );
}
