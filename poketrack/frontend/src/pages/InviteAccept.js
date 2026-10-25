import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, getToken, setToken, setUser } from "@/lib/api";
import GameFrame from "@/components/game/GameFrame";
import GameButton from "@/components/game/GameButton";
import { pushToast } from "@/components/game/Toaster";

export default function InviteAccept() {
  const { token } = useParams();
  const [state, setState] = useState({ loading: true });
  const nav = useNavigate();

  useEffect(() => {
    api.get(`/invites/${token}`).then(({ data }) => setState({ loading: false, ...data }));
  }, [token]);

  const accept = async () => {
    if (!getToken()) {
      pushToast("Sign in to accept the invite.");
      nav(`/sign-in?next=/invite/${token}`);
      return;
    }
    try {
      const { data } = await api.post(`/invites/${token}/accept`);
      pushToast("Invite accepted! Welcome to the team.");
      nav(`/teams/${data.team_id}`);
    } catch (err) {
      pushToast(err.response?.data?.detail || "Could not accept invite");
    }
  };

  if (state.loading) return null;

  return (
    <div className="max-w-lg mx-auto">
      <GameFrame className="p-6 sm:p-7">
        <h1 className="font-display text-[32px] font-bold leading-tight text-fg" data-testid="invite-title">Team invitation</h1>
        {state.status === "invalid" && <p className="mt-3 font-body text-[15px] text-muted">This invite link is invalid.</p>}
        {state.status === "revoked" && <p className="mt-3 font-body text-[15px] text-muted">This invite has been revoked.</p>}
        {state.status === "expired" && <p className="mt-3 font-body text-[15px] text-muted">This invite has expired.</p>}
        {state.status === "accepted" && <p className="mt-3 font-body text-[15px] text-muted">This invite has already been accepted. <a className="font-bold text-label underline underline-offset-2" href={`/teams/${state.team_id}`}>Open team</a></p>}
        {state.status === "pending" && (
          <>
            <p className="mt-3 font-body text-[15px] text-muted">You've been invited to join <b className="font-display font-semibold text-fg">{state.team_name}</b> as <b className="text-fg">{state.email}</b>.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <GameButton variant="success" onClick={accept} testId="invite-accept-button">Accept invite</GameButton>
              <GameButton variant="secondary" onClick={() => nav("/")} testId="invite-decline">Not now</GameButton>
            </div>
          </>
        )}
      </GameFrame>
    </div>
  );
}
