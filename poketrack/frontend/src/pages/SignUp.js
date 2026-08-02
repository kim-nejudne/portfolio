import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, setToken, setUser } from "@/lib/api";
import GameFrame from "@/components/game/GameFrame";
import GameButton from "@/components/game/GameButton";
import { pushToast } from "@/components/game/Toaster";

export default function SignUp() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/sign-up", { email, name, password });
      setToken(data.token);
      setUser(data.user);
      nav("/teams");
    } catch (err) {
      pushToast(err.response?.data?.detail || "Sign up failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-10">
      <GameFrame className="p-6">
        <p className="font-pixel text-[12px] tracking-widest text-white pixel-shadow" data-testid="sign-up-title">NEW TRAINER REGISTRATION</p>
        <form onSubmit={submit} className="mt-5 space-y-3" data-testid="sign-up-form">
          <label className="block">
            <span className="font-pixel text-[9px] tracking-widest text-white/70">TRAINER NAME</span>
            <input required value={name} onChange={(e) => setName(e.target.value)}
              data-testid="sign-up-name"
              className="mt-1 w-full rounded-[10px] bg-black/40 text-white font-body px-3 py-2 ring-2 ring-black/70 border border-white/10" />
          </label>
          <label className="block">
            <span className="font-pixel text-[9px] tracking-widest text-white/70">EMAIL</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              data-testid="sign-up-email"
              className="mt-1 w-full rounded-[10px] bg-black/40 text-white font-body px-3 py-2 ring-2 ring-black/70 border border-white/10" />
          </label>
          <label className="block">
            <span className="font-pixel text-[9px] tracking-widest text-white/70">PASSWORD (6+ chars)</span>
            <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
              data-testid="sign-up-password"
              className="mt-1 w-full rounded-[10px] bg-black/40 text-white font-body px-3 py-2 ring-2 ring-black/70 border border-white/10" />
          </label>
          <GameButton type="submit" tone="grass" disabled={loading} testId="sign-up-submit">{loading ? "CREATING TRAINER…" : "START MY JOURNEY"}</GameButton>
        </form>
        <p className="mt-4 font-body text-sm text-white/70">Already registered? <Link to="/sign-in" className="underline" data-testid="sign-up-goto-signin">Sign in</Link></p>
      </GameFrame>
    </div>
  );
}
