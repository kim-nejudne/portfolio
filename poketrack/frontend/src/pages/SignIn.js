import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, setToken, setUser } from "@/lib/api";
import GameFrame from "@/components/game/GameFrame";
import GameButton from "@/components/game/GameButton";
import { pushToast } from "@/components/game/Toaster";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/sign-in", { email, password });
      setToken(data.token);
      setUser(data.user);
      nav("/teams");
    } catch (err) {
      pushToast(err.response?.data?.detail || "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-10">
      <GameFrame className="p-6">
        <p className="font-pixel text-[12px] tracking-widest text-white pixel-shadow" data-testid="sign-in-title">TRAINER SIGN-IN</p>
        <form onSubmit={submit} className="mt-5 space-y-3" data-testid="sign-in-form">
          <label className="block">
            <span className="font-pixel text-[9px] tracking-widest text-white/70">EMAIL</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              data-testid="sign-in-email"
              className="mt-1 w-full rounded-[10px] bg-black/40 text-white font-body px-3 py-2 ring-2 ring-black/70 border border-white/10" />
          </label>
          <label className="block">
            <span className="font-pixel text-[9px] tracking-widest text-white/70">PASSWORD</span>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
              data-testid="sign-in-password"
              className="mt-1 w-full rounded-[10px] bg-black/40 text-white font-body px-3 py-2 ring-2 ring-black/70 border border-white/10" />
          </label>
          <GameButton type="submit" tone="water" disabled={loading} testId="sign-in-submit">{loading ? "SIGNING IN…" : "BATTLE ON!"}</GameButton>
        </form>
        <p className="mt-4 font-body text-sm text-white/70">New here? <Link to="/sign-up" className="underline" data-testid="sign-in-goto-signup">Create a trainer account</Link></p>
      </GameFrame>
    </div>
  );
}
