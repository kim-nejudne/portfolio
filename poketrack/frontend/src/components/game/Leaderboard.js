import React from "react";
import { GameFrame } from "./GameFrame";
import { TypeChip } from "./TypeChip";

const MEDAL_GRADIENT = {
  1: "linear-gradient(135deg,#FFF2B0,#D6A400 55%,#FFF7C9)",
  2: "linear-gradient(135deg,#F2F5FF,#9AA3B2 55%,#FFFFFF)",
  3: "linear-gradient(135deg,#FFD2B0,#B86A2A 55%,#FFE7D6)",
};

export function Leaderboard({ rows = [], myUserId }) {
  if (rows.length === 0) {
    return (
      <GameFrame className="p-8 text-center">
        <p className="font-pixel text-[11px] tracking-widest text-white pixel-shadow">No trainers yet</p>
        <p className="mt-2 font-body text-sm text-white/70">Invite teammates and finish some tickets — the arena awaits.</p>
      </GameFrame>
    );
  }
  return (
    <GameFrame className="p-0 overflow-hidden">
      <div className="px-5 py-3 flex items-center justify-between">
        <p className="font-pixel text-[11px] tracking-widest text-white pixel-shadow">TOURNAMENT STANDINGS</p>
        <span className="font-pixel text-[9px] text-white/60">RANKED BY LIFETIME XP</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse" data-testid="leaderboard-table">
          <thead>
            <tr className="font-pixel text-[9px] tracking-widest text-white/70">
              <th scope="col" className="text-left px-4 py-2">Rank</th>
              <th scope="col" className="text-left px-4 py-2">Trainer</th>
              <th scope="col" className="text-left px-4 py-2">Partner</th>
              <th scope="col" className="text-right px-4 py-2">LV</th>
              <th scope="col" className="text-right px-4 py-2">Lifetime XP</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isMe = r.user_id === myUserId;
              const medal = MEDAL_GRADIENT[r.rank];
              return (
                <tr key={r.user_id} className={`border-t border-white/5 ${isMe ? "bg-white/5" : ""}`} data-testid={`leaderboard-row-${r.user_id}`}>
                  <th scope="row" className="px-4 py-3">
                    <span
                      className="inline-grid place-items-center h-8 w-8 rounded-full ring-2 ring-black/70 font-pixel text-[10px]"
                      style={medal ? { background: medal, color: "#0B0D10" } : { background: "rgba(255,255,255,0.10)", color: "#EAF0FF" }}
                    >{r.rank}</span>
                  </th>
                  <td className="px-4 py-3">
                    <div className="font-pixel text-[10px] tracking-widest text-white">{r.user_name} {isMe && <span className="text-type-electric">(YOU)</span>}</div>
                    <div className="font-body text-xs text-white/60">{r.user_email}</div>
                  </td>
                  <td className="px-4 py-3">
                    {r.sprite_url ? (
                      <div className="flex items-center gap-2">
                        <img src={r.sprite_url} alt={r.species_name || "partner"} className="sprite h-10 w-10 object-contain" />
                        <div>
                          <div className="font-pixel text-[10px] text-white capitalize">{r.species_name}{r.is_shiny && " ✨"}</div>
                          <div className="flex gap-1 mt-1">
                            {(r.types || []).map((t) => <TypeChip key={t} type={t} size="sm" />)}
                          </div>
                        </div>
                      </div>
                    ) : <span className="font-body text-xs text-white/50">Not started</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-pixel text-[12px] text-white">{r.level || 0}</td>
                  <td className="px-4 py-3 text-right font-pixel text-[10px] text-white">{(r.total_xp || 0).toLocaleString()}</td>
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
