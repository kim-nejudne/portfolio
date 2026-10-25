import React from "react";
import { GameFrame } from "./GameFrame";
import { TypeChip } from "./TypeChip";
import { Sparkle } from "./Icons";

const MEDAL = {
  1: { background: "var(--medal-1-bg)", color: "var(--medal-1-ink)" },
  2: { background: "var(--medal-2-bg)", color: "var(--medal-2-ink)" },
  3: { background: "var(--medal-3-bg)", color: "var(--medal-3-ink)" },
};
const NO_MEDAL = { background: "var(--surface-sunken)", color: "var(--text)" };

export function Leaderboard({ rows = [], myUserId }) {
  if (rows.length === 0) {
    return (
      <GameFrame className="p-8 text-center">
        <h2 className="font-display text-[24px] font-bold text-fg">No trainers yet</h2>
        <p className="mt-2 font-body text-[15px] text-muted">Invite teammates and finish some tickets — the arena awaits.</p>
      </GameFrame>
    );
  }
  return (
    <GameFrame className="overflow-hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-5">
        <h2 className="font-display text-[24px] font-bold text-fg">Tournament standings</h2>
        <span className="font-body text-[13px] font-extrabold uppercase tracking-[0.07em] text-label">Ranked by lifetime XP</span>
      </div>
      <div className="overflow-x-auto pb-2">
        <table className="w-full min-w-[600px] border-collapse" data-testid="leaderboard-table">
          <thead>
            <tr className="font-body text-[13px] font-extrabold uppercase tracking-[0.07em] text-label">
              <th scope="col" className="px-5 pb-2 pt-4 text-left">Rank</th>
              <th scope="col" className="px-4 pb-2 pt-4 text-left">Trainer</th>
              <th scope="col" className="px-4 pb-2 pt-4 text-left">Partner</th>
              <th scope="col" className="px-4 pb-2 pt-4 text-right">Lv</th>
              <th scope="col" className="px-5 pb-2 pt-4 text-right">Lifetime XP</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isMe = r.user_id === myUserId;
              return (
                <tr key={r.user_id} className={`border-t-2 border-bg ${isMe ? "bg-surface-raised" : ""}`} data-testid={`leaderboard-row-${r.user_id}`}>
                  <th scope="row" className="px-5 py-3 text-left">
                    <span
                      className="inline-grid h-9 w-9 place-items-center rounded-full font-display text-[16px] font-bold"
                      style={MEDAL[r.rank] || NO_MEDAL}
                    >{r.rank}</span>
                  </th>
                  <td className="px-4 py-3">
                    <div className="font-body text-[15px] font-bold text-fg">
                      {r.user_name}{" "}
                      {isMe && <span className="ml-1 rounded-chip bg-accent px-2 py-0.5 text-[12px] font-extrabold text-accent-ink">You</span>}
                    </div>
                    <div className="font-body text-[13px] text-muted">{r.user_email}</div>
                  </td>
                  <td className="px-4 py-3">
                    {r.sprite_url ? (
                      <div className="flex items-center gap-2">
                        <img src={r.sprite_url} alt="" className="sprite h-10 w-10 object-contain" />
                        <div>
                          <div className="flex items-center gap-1 font-display text-[16px] font-semibold capitalize text-fg">
                            {r.species_name}
                            {r.is_shiny && <><Sparkle className="h-4 w-4 text-[var(--pts-5-bg)]" /><span className="sr-only">(shiny)</span></>}
                          </div>
                          <div className="mt-1 flex gap-1">
                            {(r.types || []).map((t) => <TypeChip key={t} type={t} size="sm" />)}
                          </div>
                        </div>
                      </div>
                    ) : <span className="font-body text-[14px] text-muted">Not started</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-display text-[20px] font-bold text-fg">{r.level || 0}</td>
                  <td className="px-5 py-3 text-right font-body text-[15px] font-bold text-fg">{(r.total_xp || 0).toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </GameFrame>
  );
}

export default Leaderboard;
