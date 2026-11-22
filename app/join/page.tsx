"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

// Open door to the node: anyone can create a handle and mine.
// Voluntary — nobody is charged, nobody is forced to send anything.
// ?ref=<user_id> names who invited you — they earn 0.5 $PHY on your first win.

function JoinInner() {
  const searchParams = useSearchParams();
  const ref = searchParams.get("ref") || "";
  const [inviter, setInviter] = useState<string | null>(null);
  const [inviterId, setInviterId] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
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

  async function start() {
    setBusy(true);
    setMsg("Creating handle…");
    try {
      const c = await fetch("/api/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ full_name: nickname, nickname, programme: "PHYS", level: "100L", invited_by: ref || null }),
      }).then((r) => r.json());
      if (!c.ok) {
        setMsg(c.message || "Handle failed — try another.");
        setBusy(false);
        return;
      }
      if (!password || password.length < 8) {
        setMsg("Pick a password (8+ chars) to lock the wallet.");
        setBusy(false);
        return;
      }
      localStorage.setItem("physi_profile", JSON.stringify(c.user));
      const sess = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ user_id: c.user.id, password, enroll: true }),
      }).then((r) => r.json());
      if (!sess.ok || !sess.token) {
        setMsg(sess.message || "Wallet created — lock it on Profile, then mine.");
        setBusy(false);
        return;
      }
      localStorage.setItem("physi_session", sess.token);
      setMsg("Entering you in the current mining round…");
      const m = await fetch("/api/mining", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${sess.token}` },
        body: JSON.stringify({ user_id: c.user.id }),
      }).then((r) => r.json());
      if (m.ok) {
        setMsg(`Welcome, @${c.user.nickname} — your first proof is in round ${m.round}. Lowest score wins the coin.`);
        setDone(true);
      } else {
        setMsg(m.message || "Mining failed.");
      }
    } catch {
      setMsg("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-5 py-14 pb-24">
      <p className="kicker text-coral text-center">open door</p>
      <h1 className="mt-3 text-center text-4xl sm:text-5xl">RACE FOR THE NEXT COIN.</h1>
      <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">
        no charge · no lock-in · you keep what you mine
      </p>

      {inviterId && (
        <div className="brutal-card brutal-card--lime mt-6 p-4">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink/60">Invite credit</p>
          {inviter ? (
            <>
              <p className="font-display mt-1 text-base">INVITED BY @{inviter}</p>
              <p className="mt-1 text-sm leading-6 text-ink/70">
                They&apos;ll earn <span className="font-bold">0.5 $PHY</span> when you win your first round — no cost to you, once per invitee, forever.
              </p>
            </>
          ) : (
            <>
              <p className="font-display mt-1 text-base">INVITE LINK DETECTED</p>
              <p className="mt-1 font-mono text-xs text-ink/60">Inviter {inviterId.slice(0, 8)}… will be credited 0.5 $PHY on your first win.</p>
            </>
          )}
        </div>
      )}

      <p className="mt-5 text-sm leading-6 text-ink/70">
        Pick a handle, tap once, and the node grinds a real puzzle proof for your first $PHY. Contributing is voluntary — you keep what you mine, and sending to others is always your choice.
      </p>

      {!done ? (
        <div className="mt-6 space-y-3">
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value.toLowerCase())}
            placeholder="your handle e.g. sam_07"
            className="w-full px-4 py-3 text-center text-sm"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="password (8+ chars, locks the wallet)"
            type="password"
            className="w-full px-4 py-3 text-center text-sm"
          />
          <button
            onClick={start}
            disabled={busy || !nickname}
            className="brutal-btn w-full"
          >
            {busy ? "Working…" : "Start mining →"}
          </button>
          {msg && <p className="text-center font-mono text-[11px] text-ink/60">{msg}</p>}
          <p className="text-center font-mono text-[10px] uppercase tracking-[0.1em] text-ink/40">lowercase, _ and a digit — e.g. alex_02</p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          <div className="brutal-card p-4">
            <p className="font-mono text-xs leading-6 text-ink/70">{msg}</p>
          </div>
          {inviter && (
            <p className="border-[3px] border-ink bg-white px-4 py-3 font-mono text-xs font-bold text-forest shadow-brutal-sm">
              +0.5 $PHY queued for @{inviter} on your first win.
            </p>
          )}
          <a href="/app/roadmap" className="brutal-btn brutal-btn--coral w-full">
            Open the Road →
          </a>
        </div>
      )}
    </main>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-md px-6 py-16 text-center"><p className="font-mono text-xs text-ink/40">Loading…</p></main>}>
      <JoinInner />
    </Suspense>
  );
}
