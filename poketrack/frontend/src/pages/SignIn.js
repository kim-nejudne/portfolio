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
        <span className="field-label">{label}</span>
        <button
          type="button"
          onClick={onCopy}
          aria-label={`Copy ${label.toLowerCase()} ${value}`}
          className="h-8 shrink-0 rounded-chip bg-surface-raised px-3 font-body text-[13px] font-extrabold text-fg shadow-hard
                     transition-transform duration-100 active:translate-y-[2px] motion-reduce:active:translate-y-0"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <code className="mt-1 block break-all font-mono text-[14px] leading-snug text-fg">
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
      <GameFrame className="p-6 sm:p-7">
        <h1 className="font-display text-[32px] font-bold leading-tight text-fg" data-testid="sign-in-title">Trainer sign-in</h1>
        <form onSubmit={submit} className="mt-5 space-y-4" data-testid="sign-in-form">
          <label className="block">
            <span className="field-label">Email</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              data-testid="sign-in-email"
              className="field" />
          </label>
          <label className="block">
            <span className="field-label">Password</span>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
              data-testid="sign-in-password"
              className="field" />
          </label>
          <GameButton type="submit" className="w-full" disabled={busy} testId="sign-in-submit">{loading ? "Signing in…" : "Battle on!"}</GameButton>
        </form>
        <p className="mt-5 font-body text-[15px] text-muted">New here? <Link to="/sign-up" className="font-bold text-label underline underline-offset-2" data-testid="sign-in-goto-signup">Create a trainer account</Link></p>
      </GameFrame>

      {demos.length > 0 && (
        <GameFrame className="mt-6 p-6 sm:p-7" testId="demo-accounts">
          <p className="font-body text-[13px] font-extrabold uppercase tracking-[0.07em] text-label">Just looking?</p>
          <h2 className="mt-1 font-display text-[24px] font-bold text-fg">Try a demo trainer</h2>
          <p className="mt-2 font-body text-[15px] text-muted">
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
                  className="rounded-card bg-surface-sunken p-4"
                >
                  <p className="font-display text-[18px] font-semibold text-fg">
                    {d.role_label || d.name}
                  </p>
                  <p className="mt-1 font-body text-[15px] font-bold text-fg">{d.name}</p>
                  {d.blurb && (
                    <p className="mt-1 font-body text-[14px] text-muted">{d.blurb}</p>
                  )}

                  <div className="mt-3 divide-y-2 divide-surface-sunken rounded-2xl bg-bg">
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
                    size="sm"
                    className="mt-3 w-full"
                    disabled={busy}
                    onClick={() => signInAsDemo(d)}
                    testId={`demo-signin-${d.email}`}
                    // The visible label is only a first name, which is thin on
                    // its own when three of these sit in a row.
                    aria-label={`Sign in as ${d.name}${d.role_label ? `, ${d.role_label.toLowerCase()}` : ""}`}
                  >
                    {pending ? "Signing in…" : `Sign in as ${firstName}`}
                  </GameButton>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 font-body text-[14px] text-muted">
            Shared accounts, wiped and rebuilt on a schedule. Play with them freely — finish
            tickets, evolve a partner, drag things back out of Done.
          </p>
        </GameFrame>
      )}
    </div>
  );
}
