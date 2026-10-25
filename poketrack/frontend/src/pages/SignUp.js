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
      <GameFrame className="p-6 sm:p-7">
        <h1 className="font-display text-[32px] font-bold leading-tight text-fg" data-testid="sign-up-title">New trainer registration</h1>
        <form onSubmit={submit} className="mt-5 space-y-4" data-testid="sign-up-form">
          <label className="block">
            <span className="field-label">Trainer name</span>
            <input required value={name} onChange={(e) => setName(e.target.value)}
              data-testid="sign-up-name"
              className="field" />
          </label>
          <label className="block">
            <span className="field-label">Email</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              data-testid="sign-up-email"
              className="field" />
          </label>
          <label className="block">
            <span className="field-label">Password (6+ characters)</span>
            <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
              data-testid="sign-up-password"
              className="field" />
          </label>
          <GameButton type="submit" className="w-full" disabled={loading} testId="sign-up-submit">{loading ? "Creating trainer…" : "Start my journey"}</GameButton>
        </form>
        <p className="mt-5 font-body text-[15px] text-muted">Already registered? <Link to="/sign-in" className="font-bold text-label underline underline-offset-2" data-testid="sign-up-goto-signin">Sign in</Link></p>
      </GameFrame>
    </div>
  );
}
