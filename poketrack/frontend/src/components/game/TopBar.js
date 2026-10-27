import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, getToken, getUser, setToken, setUser } from "@/lib/api";
import GameButton from "./GameButton";
import PokeBall from "./PokeBall";

export function TopBar() {
  const user = getUser();
  const nav = useNavigate();
  const signOut = () => {
    // Lets the API drop a demo session's sandbox now rather than at expiry. The
    // header is explicit because the token is cleared before the request leaves.
    api.post("/auth/sign-out", null, { headers: { Authorization: `Bearer ${getToken()}` } }).catch(() => {});
    setToken(null); setUser(null); nav("/");
  };
  return (
    <header className="sticky top-0 z-40 bg-bg px-6 py-3 shadow-hard" data-testid="top-bar">
      <div className="mx-auto flex max-w-[1360px] items-center justify-between gap-3">
        <Link to={user ? "/teams" : "/"} className="flex items-center gap-2 rounded-chip" data-testid="top-bar-brand">
          <PokeBall size={26} />
          <span className="font-display text-[20px] font-bold text-fg">PokéTrack</span>
        </Link>
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <span className="hidden font-body text-[14px] font-semibold text-muted sm:inline" data-testid="top-bar-user">{user.name}</span>
              <GameButton size="sm" variant="secondary" onClick={signOut} testId="top-bar-sign-out">Sign out</GameButton>
            </>
          ) : (
            <>
              <GameButton size="sm" variant="secondary" as="a" href="/sign-in" testId="top-bar-sign-in">Sign in</GameButton>
              <GameButton size="sm" as="a" href="/sign-up" testId="top-bar-sign-up">Sign up</GameButton>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export default TopBar;
