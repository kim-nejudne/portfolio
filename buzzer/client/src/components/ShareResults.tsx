import { useState } from 'react';
import {
  RESULTS_FILE,
  renderResultsCard,
  shareOrDownload,
  type ResultsCardInput,
} from '../lib/resultsCard.js';
import { useCopy } from '../lib/copy.js';

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
  // English on the remote; the phone's and the Screen's language there (F91).
  const t = useCopy();

  async function onClick() {
    const input = card();
    if (!input) return;
    setBusy(true);
    setStatus(null);
    try {
      const outcome = await shareOrDownload(await renderResultsCard(input), mode);
      if (outcome === 'downloaded') setStatus(t('savedFile', { file: RESULTS_FILE }));
    } catch {
      setStatus(t('imageFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => void onClick()} disabled={busy} className={className}>
        {mode === 'share' ? t('shareResults') : t('downloadResults')}
      </button>
      {status && (
        <p role="status" className="text-center text-muted">
          {status}
        </p>
      )}
    </>
  );
}
