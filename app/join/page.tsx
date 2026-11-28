"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

// Open door to the node: anyone can create a handle and vote.
// Voluntary — nobody is charged, nobody is forced to send anything.
// ?ref=<user_id> names who invited you — they earn 0.5 $PHY on your first win.

const PROGRAMMES = [
  "PHYS",
  "CHEM",
  "BIOCHEM",
  "MICRO",
  "ANAT",
  "PHYSIO",
  "NURS",
  "MED",
  "PHARM",
  "LAW",
  "ECON",
  "ACCT",
  "COMP",
  "OTHER",
];
const LEVELS = ["100L", "200L", "300L", "400L", "500L", "600L"];

function handleProblem(h: string): string | null {
  if (!h) return "Pick a handle.";
  if (h.length < 3) return "At least 3 characters.";
  if (h.length > 24) return "Keep it under 24 characters.";
  if (!/^[a-z0-9_]+$/.test(h)) return "Lowercase letters, numbers and _ only.";
  if (!h.includes("_")) return "Include an underscore — e.g. sam_07.";
  if (!/[0-9]/.test(h)) return "Include a digit — e.g. sam_07.";
  return null;
}

function JoinInner() {
  const searchParams = useSearchParams();
  const ref = searchParams.get("ref") || "";
  const [inviter, setInviter] = useState<string | null>(null);
  const [inviterId, setInviterId] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [programme, setProgramme] = useState("PHYS");
  const [level, setLevel] = useState("100L");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!ref) return;
    setInviterId(ref);
    fetch(`/api/profile?id=${encodeURIComponent(ref)}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setInviter(j.user.nickname);
        else setInviter(null);
      })
      .catch(() => {});
  }, [ref]);

  const handleIssue = useMemo(() => (nickname ? handleProblem(nickname) : null), [nickname]);
  const passwordIssue =
    password.length === 0 ? null : password.length < 8 ? "At least 8 characters." : null;
  const ready = !handleIssue && nickname.length > 0 && password.length >= 8;

  async function start() {
    // Validate BEFORE the account exists. A handle created without a password
    // is unreachable: retrying the same name returns "taken".
    const hErr = handleProblem(nickname);
    if (hErr) {
      setMsg(hErr);
      return;
    }
    if (password.length < 8) {
      setMsg("Pick a password of at least 8 characters.");
      return;
    }
    setBusy(true);
    setMsg("Creating your handle…");
    try {
      const c = await fetch("/api/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          full_name: nickname,
          nickname,
          programme,
          level,
          invited_by: ref || null,
        }),
      }).then((r) => r.json());
      if (!c.ok) {
        setMsg(c.message || "Handle failed — try another.");
        return;
      }
      localStorage.setItem("physi_profile", JSON.stringify(c.user));
      const sess = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ user_id: c.user.id, password, enroll: true }),
      }).then((r) => r.json());
      if (!sess.ok || !sess.token) {
        setMsg(sess.message || "Handle created — unlock the wallet on Profile.");
        return;
      }
      localStorage.setItem("physi_session", sess.token);
      setMsg(`Welcome, @${c.user.nickname}. You are in — vote on what moved.`);
      setDone(true);
    } catch {
      setMsg("Network error — check your data and tap again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-5 py-12 pb-24">
      <p className="kicker text-brick text-center">open door</p>
      <h1 className="mt-3 text-center text-4xl sm:text-5xl">GET IN.</h1>
      <p className="mt-3 text-center font-mono text-[11px] uppercase tracking-[0.14em] text-ink/65">
        free · no email · you keep what you mine
      </p>

      {inviterId && (
        <div className="brutal-card brutal-card--lime mt-6 p-4">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink/70">Invite credit</p>
          {inviter ? (
            <>
              <p className="font-display mt-1 text-base">INVITED BY @{inviter}</p>
              <p className="mt-1 text-sm leading-6 text-ink/70">
                They earn <span className="font-bold">0.5 $PHY</span> when you win your first round — no cost to you.
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm leading-6 text-ink/70">An invite link was used — your inviter gets credited on your first win.</p>
          )}
        </div>
      )}

      {!done ? (
        <div className="mt-6 space-y-3">
          <label className="block">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink/70">Handle</span>
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value.toLowerCase().replace(/\s/g, ""))}
              placeholder="sam_07"
              autoCapitalize="none"
              autoComplete="username"
              className="mt-1 w-full px-4 py-3 text-sm"
            />
          </label>
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink/65">
            {handleIssue ? <span className="text-brick">{handleIssue}</span> : "lowercase · include _ and a digit · no real name needed"}
          </p>

          <label className="block">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink/70">Password</span>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="8+ characters"
              type="password"
              autoComplete="new-password"
              className="mt-1 w-full px-4 py-3 text-sm"
            />
          </label>
          {passwordIssue && <p className="font-mono text-[10px] text-brick">{passwordIssue}</p>}

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink/70">Programme</span>
              <select
                value={programme}
                onChange={(e) => setProgramme(e.target.value)}
                className="mt-1 w-full px-3 py-3 text-sm"
              >
                {PROGRAMMES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink/70">Level</span>
              <select value={level} onChange={(e) => setLevel(e.target.value)} className="mt-1 w-full px-3 py-3 text-sm">
                {LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="font-mono text-[10px] leading-relaxed text-ink/65">
            Your programme and level decide which notices you see. You can change them later.
          </p>

          <button onClick={start} disabled={busy || !ready} className="brutal-btn w-full">
            {busy ? "Creating…" : "Create my handle →"}
          </button>
          {msg && (
            <p className="text-center font-mono text-[11px] text-ink/70" role="status">
              {msg}
            </p>
          )}
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          <div className="brutal-card p-4">
            <p className="font-mono text-xs leading-6 text-ink/70">{msg}</p>
          </div>
          {inviter && (
            <p className="border-[3px] border-ink bg-white px-4 py-3 font-mono text-xs font-bold text-green shadow-brutal-sm">
              +0.5 $PHY queued for @{inviter} on your first win.
            </p>
          )}
          <a href="/app/mining" className="brutal-btn brutal-btn--coral w-full">
            Seal your first block →
          </a>
          <a href="/app" className="brutal-btn brutal-btn--white w-full">
            See what moved
          </a>
        </div>
      )}
    </main>
  );
}

export default function JoinPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-md px-6 py-16 text-center">
          <p className="font-mono text-xs text-ink/65">Loading…</p>
        </main>
      }
    >
      <JoinInner />
    </Suspense>
  );
}
