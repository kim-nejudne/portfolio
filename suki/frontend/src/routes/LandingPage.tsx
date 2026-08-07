/**
 * The front door.
 *
 * Until this page existed, `suki.kimnejudne.dev` opened on a keypad: four dots,
 * a numeric pad, and a line about the counter being open. Someone arriving cold
 * had no way to know what was behind it, and the concept the whole spoke is
 * about — selling by the piece, a credit book that cannot be rewritten, a month
 * with two paydays in it — lived only in a case study on another domain.
 *
 * It is deliberately not a SaaS landing page. The art direction is a ruled
 * notebook: rows and hairlines, never cards; radius 0 except on tap targets; no
 * shadows and no elevation; five colours. The shop itself is visually loud, so
 * the tool is quiet and the numbers do the work.
 *
 * Which is why the specimen below is the centre of the page rather than a
 * decoration. Explaining tingi in a paragraph is a claim; showing a ream of 12
 * broken into ten-peso sachets, and a page of Aling Bebang's book with the
 * running balance down the right-hand side, is the thing itself.
 *
 * The numbers are not mocked up. Every figure on this page comes out of
 * `@suki/domain` — `costPerPiece`, `marginPerPack`, `withRunningBalance`,
 * `formatPeso` — the same functions the till uses and the same ones the server
 * derives balances with. If the tingi arithmetic ever changed, this page would
 * change with it.
 *
 * The entries themselves are a literal here rather than a read through
 * `src/lib/api/`. That seam is real and worth keeping — nothing outside it may
 * touch a fixture — but it is asynchronous and it wakes IndexedDB, and a public
 * page that anyone can load should not need a database to render a worked
 * example. They are this page's own specimen, and they are copied from the demo
 * shop so the two agree.
 */
import { Link } from 'react-router-dom';
import type { Item, LedgerEntry } from '@suki/domain';
import {
  costPerPiece,
  formatPeso,
  marginPerPack,
  marginPerPiece,
  shortDate,
  withRunningBalance,
} from '@suki/domain';
import { UNLOCK_PIN } from '../lib/unlock';

/** Item i01 from the demo shop — the canonical tingi case. */
const SPECIMEN_ITEM: Item = {
  id: 'i01',
  name: 'Palmolive Shampoo Sachet',
  category: 'sachet',
  buyUnit: 'ream',
  sellUnit: 'sachet',
  perPack: 12,
  buyPrice: 96,
  sellPrice: 10,
  stock: 34,
  reorderAt: 12,
};

const SPECIMEN_CUSTOMER = { name: 'Aling Bebang Ramirez', purok: 'Purok Mabini' };

/**
 * Aling Bebang's whole book, oldest first. The running balance is derived
 * across all of it; the page prints only the last four rows and carries the
 * rest forward, the way a notebook page does.
 */
const SPECIMEN_LEDGER: LedgerEntry[] = [
  { id: 'l001', customerId: 'c01', kind: 'purchase', amount: 94, createdAt: '2025-07-02T10:15:00.000Z' },
  { id: 'l002', customerId: 'c01', kind: 'purchase', amount: 65, createdAt: '2025-07-05T17:20:00.000Z' },
  { id: 'l003', customerId: 'c01', kind: 'payment', amount: 159, createdAt: '2025-07-15T08:00:00.000Z', note: 'Kinsenas' },
  { id: 'l010', customerId: 'c01', kind: 'purchase', amount: 100, createdAt: '2025-08-02T09:20:00.000Z' },
  { id: 'l011', customerId: 'c01', kind: 'purchase', amount: 91, createdAt: '2025-08-09T16:00:00.000Z' },
  { id: 'l012', customerId: 'c01', kind: 'payment', amount: 100, createdAt: '2025-08-15T08:15:00.000Z', note: 'Kinsenas' },
  { id: 'l021', customerId: 'c01', kind: 'purchase', amount: 120, createdAt: '2025-09-02T08:45:00.000Z' },
  { id: 'l022', customerId: 'c01', kind: 'purchase', amount: 79, createdAt: '2025-09-05T17:10:00.000Z' },
  { id: 'l023', customerId: 'c01', kind: 'purchase', amount: 42, createdAt: '2025-09-09T18:30:00.000Z' },
];

const ROWS_SHOWN = 4;

const DEFINITIONS = [
  {
    term: 'Tingi',
    gloss: 'sold by the piece',
    body:
      'Stock arrives in packs and leaves one sachet at a time. Every item carries a buy unit, a sell unit and the conversion between them. No Western till models this, and getting it right is most of what makes the app true.',
  },
  {
    term: 'Lista',
    gloss: 'the credit book',
    body:
      'Utang is normal here, not an exception. The book is append-only: nothing is edited and nothing is deleted, because a record you can quietly rewrite is not one anybody would trust. The balance is the sum.',
  },
  {
    term: 'Kinsenas',
    gloss: 'the 15th, and the last day',
    body:
      'Wages land twice a month, so the book empties twice a month. On a payday the Lista reorders itself around whoever is being paid that day — the app’s most opinionated moment, and the one that decides whether it feels local.',
  },
];

export function LandingPage() {
  const ledger = withRunningBalance(SPECIMEN_LEDGER);
  const shown = ledger.slice(-ROWS_SHOWN);
  const broughtForward = ledger[ledger.length - ROWS_SHOWN - 1]?.runningBalance ?? 0;
  const balance = ledger[ledger.length - 1]?.runningBalance ?? 0;

  const perPiece = costPerPiece(SPECIMEN_ITEM.buyPrice, SPECIMEN_ITEM.perPack);

  return (
    <main className="landing">
      <a href="#specimen" className="skip-link">Skip to the ledger</a>

      <header className="landing-masthead rule">
        <p className="mono uppercase landing-wordmark">Suki</p>
        <p className="mono landing-standfirst-small">
          Rosa Sari-Sari Store <span aria-hidden="true">·</span> Barangay Daro, Dumaguete
        </p>
      </header>

      <div className="landing-body">
        <section className="landing-pitch">
          <h1 className="landing-headline">The lista is the record of trust.</h1>

          <p className="landing-lede">
            A ledger and stock app for a sari-sari store in Barangay Daro, Dumaguete. One
            shopkeeper, forty-odd neighbours, run from a counter at the front of a house.
          </p>
          <p className="landing-lede">
            Offline-first, because in a Philippine barangay that is not an architectural
            preference. The power goes out, the signal drops to one bar, and the shop still
            has to sell a sachet of shampoo and write down who owes what.
          </p>

          <div className="landing-way-in">
            <Link to="/till" className="landing-cta mono">
              Open the demo shop <span aria-hidden="true">→</span>
            </Link>
            <p className="mono landing-pin">
              Demo shop — the PIN is {UNLOCK_PIN}
            </p>
          </div>
        </section>

        <section className="landing-specimen" id="specimen" aria-labelledby="specimen-h">
          <h2 className="mono uppercase landing-kicker" id="specimen-h">
            A page of the book
          </h2>

          {/* Tingi, as arithmetic rather than as a claim. */}
          <div className="landing-tingi rule">
            <p className="landing-tingi-line">
              <span className="landing-tingi-name">{SPECIMEN_ITEM.name}</span>
            </p>
            <dl className="landing-tingi-grid mono">
              <div>
                <dt>Buy</dt>
                <dd className="amount">
                  {formatPeso(SPECIMEN_ITEM.buyPrice)} <span className="landing-unit">/ {SPECIMEN_ITEM.buyUnit} of {SPECIMEN_ITEM.perPack}</span>
                </dd>
              </div>
              <div>
                <dt>Cost</dt>
                <dd className="amount">
                  {formatPeso(perPiece)} <span className="landing-unit">/ {SPECIMEN_ITEM.sellUnit}</span>
                </dd>
              </div>
              <div>
                <dt>Sell</dt>
                <dd className="amount">
                  {formatPeso(SPECIMEN_ITEM.sellPrice)} <span className="landing-unit">/ {SPECIMEN_ITEM.sellUnit}</span>
                </dd>
              </div>
              <div>
                <dt>Margin</dt>
                <dd className="amount" style={{ color: 'var(--color-bayad)' }}>
                  {formatPeso(marginPerPiece(SPECIMEN_ITEM))}{' '}
                  <span className="landing-unit">
                    / {SPECIMEN_ITEM.sellUnit} · {formatPeso(marginPerPack(SPECIMEN_ITEM))} the {SPECIMEN_ITEM.buyUnit}
                  </span>
                </dd>
              </div>
            </dl>
          </div>

          {/* The lista, with the running balance down the right-hand side. */}
          <table className="landing-ledger">
            <caption className="landing-ledger-caption">
              <span className="landing-ledger-name">{SPECIMEN_CUSTOMER.name}</span>
              <span className="mono landing-ledger-purok">{SPECIMEN_CUSTOMER.purok}</span>
            </caption>
            <thead>
              <tr className="mono">
                <th scope="col">Date</th>
                <th scope="col">Entry</th>
                <th scope="col" className="landing-num">Amount</th>
                <th scope="col" className="landing-num">Balance</th>
              </tr>
            </thead>
            <tbody>
              <tr className="landing-brought-forward mono">
                <td colSpan={3}>Brought forward</td>
                <td className="amount">{formatPeso(broughtForward)}</td>
              </tr>
              {shown.map((entry) => {
                const isPayment = entry.kind === 'payment';
                return (
                  <tr key={entry.id}>
                    <td className="mono landing-date">{shortDate(entry.createdAt)}</td>
                    <td className="landing-kind">
                      {isPayment ? 'Bayad' : 'Utang'}
                      {entry.note ? <span className="landing-note mono"> {entry.note}</span> : null}
                    </td>
                    <td
                      className="amount"
                      style={{ color: isPayment ? 'var(--color-bayad)' : 'var(--color-utang)' }}
                    >
                      {isPayment ? '−' : '+'}
                      {formatPeso(entry.amount)}
                    </td>
                    <td className="amount landing-running">{formatPeso(entry.runningBalance)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <p className="landing-balance">
            <span className="mono uppercase landing-balance-label">Utang as of 15 Sep</span>
            <span className="amount landing-balance-figure" style={{ color: 'var(--color-utang)' }}>
              {formatPeso(balance)}
            </span>
          </p>

          <p className="landing-caption mono">
            The balance is never stored. It is the sum of the entries, recomputed on every
            read — which is what makes an unreliable connection survivable, because addition
            does not care what order things arrive in.
          </p>
        </section>
      </div>

      <section className="landing-definitions" aria-label="The three ideas">
        <dl>
          {DEFINITIONS.map((d) => (
            <div className="landing-definition rule" key={d.term}>
              <dt>
                <span className="mono uppercase landing-term">{d.term}</span>
                <span className="landing-gloss">{d.gloss}</span>
              </dt>
              <dd>{d.body}</dd>
            </div>
          ))}
        </dl>
      </section>

      <footer className="landing-footer rule">
        <p className="mono">
          Works with no signal. Writes land in IndexedDB before the screen confirms them, and
          the queue drains when it can.
        </p>
        <p className="mono">
          <a href="https://kimnejudne.dev/work/suki/" className="landing-link">
            Read the case study
          </a>
          <span aria-hidden="true"> · </span>
          <a href="https://kimnejudne.dev/" className="landing-link">
            More work
          </a>
        </p>
      </footer>
    </main>
  );
}
