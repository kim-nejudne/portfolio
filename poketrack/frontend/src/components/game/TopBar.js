import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { getUser, setToken, setUser } from "@/lib/api";
import GameButton from "./GameButton";

export function TopBar() {
  const user = getUser();
  const nav = useNavigate();
  const signOut = () => { setToken(null); setUser(null); nav("/"); };
  return (
    <header className="sticky top-0 z-40 px-4 sm:px-6 py-3 backdrop-blur-md bg-black/40 border-b border-white/10" data-testid="top-bar">
      <div className="flex items-center justify-between">
        <Link to={user ? "/teams" : "/"} className="flex items-center gap-2" data-testid="top-bar-brand">
          <div className="h-6 w-6 rounded-full ring-2 ring-black bg-[linear-gradient(to_bottom,#E53935_0_50%,#F7F7FB_50%_100%)]">
            <div className="h-full w-full grid place-items-center">
              <span className="h-2 w-2 rounded-full bg-white ring-2 ring-black" />
            </div>
          </div>
          <span className="font-pixel text-[11px] tracking-widest text-white pixel-shadow">POKÉTRACK</span>
        </Link>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <span className="font-pixel text-[9px] text-white/70 hidden sm:inline" data-testid="top-bar-user">{user.name}</span>
              <GameButton size="sm" variant="secondary" onClick={signOut} testId="top-bar-sign-out">SIGN OUT</GameButton>
            </>
          ) : (
            <>
              <GameButton size="sm" variant="secondary" as="a" href="/sign-in" testId="top-bar-sign-in">SIGN IN</GameButton>
              <GameButton size="sm" tone="electric" as="a" href="/sign-up" testId="top-bar-sign-up">SIGN UP</GameButton>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export default TopBar;
