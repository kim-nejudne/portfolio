import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, setToken, setUser } from "@/lib/api";
import GameFrame from "@/components/game/GameFrame";
import GameButton from "@/components/game/GameButton";
import { pushToast } from "@/components/game/Toaster";

// One credential, shown rather than hinted at. The value sits on its own line
// so a long email never has to fight the label for width on a phone, and it is
// real selectable text — the whole card used to be a <button>, inside which
// nothing can be selected.
function Credential({ label, value, copied, onCopy }) {
  return (
    <div className="px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-pixel text-[9px] tracking-hud text-white/60">{label}</span>
        <button
          type="button"
          onClick={onCopy}
          aria-label={`Copy ${label.toLowerCase()} ${value}`}
          className="font-pixel text-[8px] tracking-hud px-2 py-1 rounded-[6px] shrink-0
                     bg-white/10 text-white/80 ring-1 ring-white/15
                     hover:bg-white/20 hover:text-white
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70
                     transition-colors duration-150 motion-reduce:transition-none"
        >
          {copied ? "COPIED" : "COPY"}
        </button>
      </div>
      <code className="mt-1 block font-mono text-[13px] leading-snug text-white break-all">
        {value}
      </code>
    </div>
  );
}

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [demos, setDemos] = useState([]);
  // Which demo card is mid-flight, so only that one shows a busy label.
  const [demoBusy, setDemoBusy] = useState(null);
  // Which credential most recently went to the clipboard, as "<email>:<field>".
  const [copied, setCopied] = useState(null);
  const copyTimer = useRef(null);
  const nav = useNavigate();

  useEffect(() => () => clearTimeout(copyTimer.current), []);

  const copy = async (key, value) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(null), 1600);
    } catch {
      // Clipboard access needs a secure context and can be refused outright.
      // The value is on screen as selectable text, so say so and move on.
      pushToast("Couldn't reach the clipboard — select the text and copy it.");
    }
  };

  // An unseeded instance returns [] and the panel never renders, so this page
  // is unchanged for anyone running the app without the demo world.
  useEffect(() => {
    let live = true;
    api.get("/auth/demo-accounts")
      .then(({ data }) => { if (live) setDemos(Array.isArray(data) ? data : []); })
      .catch(() => { /* the ordinary form still works without it */ });
    return () => { live = false; };
  }, []);

  const signIn = async (creds) => {
    const { data } = await api.post("/auth/sign-in", creds);
    setToken(data.token);
    setUser(data.user);
    nav("/teams");
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn({ email, password });
    } catch (err) {
      pushToast(err.response?.data?.detail || "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  const signInAsDemo = async (account) => {
    setDemoBusy(account.email);
    try {
      await signIn({ email: account.email, password: account.password });
    } catch (err) {
      pushToast(err.response?.data?.detail || "Demo sign in failed");
    } finally {
      setDemoBusy(null);
    }
  };

  const busy = loading || demoBusy !== null;

  return (
    <div className="max-w-md mx-auto py-10">
      <GameFrame className="p-6">
        <p className="font-pixel text-[12px] tracking-display text-white pixel-shadow" data-testid="sign-in-title">TRAINER SIGN-IN</p>
        <form onSubmit={submit} className="mt-5 space-y-3" data-testid="sign-in-form">
          <label className="block">
            <span className="font-pixel text-[9px] tracking-hud text-white/70">EMAIL</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              data-testid="sign-in-email"
              className="mt-1 w-full rounded-[10px] bg-black/40 text-white font-body px-3 py-2 ring-2 ring-black/70 border border-white/10" />
          </label>
          <label className="block">
            <span className="font-pixel text-[9px] tracking-hud text-white/70">PASSWORD</span>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
              data-testid="sign-in-password"
              className="mt-1 w-full rounded-[10px] bg-black/40 text-white font-body px-3 py-2 ring-2 ring-black/70 border border-white/10" />
          </label>
          <GameButton type="submit" tone="water" disabled={busy} testId="sign-in-submit">{loading ? "SIGNING IN…" : "BATTLE ON!"}</GameButton>
        </form>
        <p className="mt-4 font-body text-sm text-white/70">New here? <Link to="/sign-up" className="underline" data-testid="sign-in-goto-signup">Create a trainer account</Link></p>
      </GameFrame>

      {demos.length > 0 && (
        <GameFrame className="mt-5 p-6" tone="panel2" testId="demo-accounts">
          <p className="font-pixel text-[11px] tracking-display text-type-electric">JUST LOOKING?</p>
          <p className="mt-2 font-body text-sm text-white/75">
            Use one of these accounts — no sign-up needed. Sign in with a single button,
            or type the credentials into the form above. Each trainer drops you at a
            different point in the progression.
          </p>
          <ul className="mt-4 space-y-4">
            {demos.map((d) => {
              const pending = demoBusy === d.email;
              const firstName = (d.name || "").split(" ")[0] || "this trainer";
              return (
                <li
                  key={d.email}
                  data-testid={`demo-account-${d.email}`}
                  className="rounded-[12px] bg-black/40 px-4 py-4 ring-2 ring-black/70 border border-white/10"
                >
                  <p className="font-pixel text-[10px] tracking-hud text-white pixel-shadow">
                    {d.role_label || d.name}
                  </p>
                  <p className="mt-2 font-body text-sm text-white/90">{d.name}</p>
                  {d.blurb && (
                    <p className="mt-1 font-body text-xs text-white/65">{d.blurb}</p>
                  )}

                  <div className="mt-3 rounded-[8px] bg-black/60 ring-1 ring-white/15 divide-y divide-white/10">
                    <Credential
                      label="EMAIL"
                      value={d.email}
                      copied={copied === `${d.email}:email`}
                      onCopy={() => copy(`${d.email}:email`, d.email)}
                    />
                    <Credential
                      label="PASSWORD"
                      value={d.password}
                      copied={copied === `${d.email}:password`}
                      onCopy={() => copy(`${d.email}:password`, d.password)}
                    />
                  </div>

                  <GameButton
                    tone="electric"
                    size="sm"
                    className="mt-3 w-full"
                    disabled={busy}
                    onClick={() => signInAsDemo(d)}
                    testId={`demo-signin-${d.email}`}
                    // The visible label is only a first name, which is thin on
                    // its own when three of these sit in a row.
                    aria-label={`Sign in as ${d.name}${d.role_label ? `, ${d.role_label.toLowerCase()}` : ""}`}
                  >
                    {pending ? "SIGNING IN…" : `SIGN IN AS ${firstName.toUpperCase()} ▶`}
                  </GameButton>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 font-body text-xs text-white/55">
            Shared accounts, wiped and rebuilt on a schedule. Play with them freely — finish
            tickets, evolve a partner, drag things back out of Done.
          </p>
        </GameFrame>
      )}
    </div>
  );
}
