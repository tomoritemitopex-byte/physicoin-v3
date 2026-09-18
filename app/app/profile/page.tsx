"use client";
import { useEffect, useState } from "react";

type Profile = {
  id: string;
  nickname: string;
  programme: string;
  level: string;
  mining_balance: string;
};

type InviteStats = {
  invite_count: number;
  rewarded_count: number;
  earned: string;
  invites: { id: string; nickname: string; created_at: string; rewarded: boolean }[];
};

export default function ProfilePage() {
  const [me, setMe] = useState<Profile | null>(null);
  const [genesis, setGenesis] = useState(false);
  const [form, setForm] = useState({ full_name: "", nickname: "", programme: "PHYS", level: "100L" });
  const [msg, setMsg] = useState("");

  const [invites, setInvites] = useState<InviteStats | null>(null);
  const [copied, setCopied] = useState(false);

  // Faucet weekly drip status (3 votes + 24h rule, visibly linked)
  const [faucet, setFaucet] = useState<null | { votes: number; hoursLeft: number; eligible: boolean; drippedThisWeek: boolean; week: string }>(null);
  const [faucetLoading, setFaucetLoading] = useState(false);

  async function loadFaucet(id: string) {
    setFaucetLoading(true);
    try {
      const r = await fetch(`/api/faucet?user_id=${encodeURIComponent(id)}`, { cache: "no-store" }).then((x) => x.json());
      if (r.ok) setFaucet({ votes: r.votes, hoursLeft: r.hoursLeft, eligible: r.eligible, drippedThisWeek: r.drippedThisWeek, week: r.week });
      else setFaucet(null);
    } catch {
      setFaucet(null);
    } finally {
      setFaucetLoading(false);
    }
  }

  async function refresh(id: string) {
    try {
      const r = await fetch(`/api/profile?id=${encodeURIComponent(id)}`);
      const j = await r.json();
      if (j.ok) {
        setMe(j.user);
        setGenesis(j.rank === 1);
        if (j.invites) setInvites(j.invites);
        localStorage.setItem("physi_profile", JSON.stringify(j.user));
        loadFaucet(j.user.id);
      }
    } catch {}
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem("physi_profile");
      if (raw) {
        const p = JSON.parse(raw);
        setMe(p);
        refresh(p.id);
        loadHistory(p.id);
        loadFaucet(p.id);
      }
    } catch {}
  }, []);

  async function create() {
    setMsg("Creating…");
    try {
      const r = await fetch("/api/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = await r.json();
      if (j.ok) {
        setMe(j.user);
        localStorage.setItem("physi_profile", JSON.stringify(j.user));
        setMsg("Handle created!");
      } else {
        setMsg(j.message || "Failed.");
      }
    } catch {
      setMsg("Network error.");
    }
  }

  function signOut() {
    localStorage.removeItem("physi_profile");
    setMe(null);
  }

  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [sendMsg, setSendMsg] = useState("");
  const [history, setHistory] = useState<any[]>([]);
  const [password, setPassword] = useState("");
  const [loginMsg, setLoginMsg] = useState("");

  async function login() {
    if (!me || !password) return;
    setLoginMsg("Signing in…");
    try {
      const r = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ user_id: me.id, password }),
      }).then((x) => x.json());
      if (r.ok && r.token) {
        localStorage.setItem("physi_session", r.token);
        setLoginMsg("Signed in — wallet unlocked.");
        setPassword("");
      } else if (r.code === "NOT_ENROLLED") {
        setLoginMsg("No password yet — set one below to lock this wallet.");
      } else {
        setLoginMsg(r.message || "Sign-in failed.");
      }
    } catch {
      setLoginMsg("Network error.");
    }
  }

  async function enrollPw() {
    if (!me || !password) return;
    setLoginMsg("Locking wallet…");
    try {
      const r = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ user_id: me.id, password, enroll: true }),
      }).then((x) => x.json());
      if (r.ok && r.token) {
        localStorage.setItem("physi_session", r.token);
        setLoginMsg("Locked — only this password opens the wallet now.");
        setPassword("");
      } else {
        setLoginMsg(r.message || "Failed.");
      }
    } catch {
      setLoginMsg("Network error.");
    }
  }

  async function loadHistory(id: string) {
    try {
      const sess = localStorage.getItem("physi_session") || "";
      const r = await fetch(`/api/wallet/send?user_id=${encodeURIComponent(id)}`, {
        headers: sess ? { authorization: `Bearer ${sess}` } : {},
      }).then((x) => x.json());
      if (r.ok) setHistory(r.transfers.slice(0, 10));
    } catch {}
  }

  async function sendCoins() {
    setSendMsg("Sending…");
    try {
      const meRaw = localStorage.getItem("physi_profile");
      const myId = meRaw ? JSON.parse(meRaw)?.id : null;
      if (!myId) {
        setSendMsg("No wallet loaded.");
        return;
      }
      const target = await fetch(`/api/profile?nickname=${encodeURIComponent(to.trim().toLowerCase())}`).then((r) => r.json());
      if (!target.ok) {
        setSendMsg("Recipient not found — check the handle.");
        return;
      }
      const sess = localStorage.getItem("physi_session") || "";
      if (!sess) {
        setSendMsg("Locked — unlock your wallet above first.");
        return;
      }
      const r = await fetch("/api/wallet/send", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${sess}` },
        body: JSON.stringify({ from_user_id: myId, to_user_id: target.user.id, amount: Number(amount) }),
      });
      const j = await r.json();
      if (j.ok) {
        setSendMsg(`Sent ${amount} $PHY to @${target.user.nickname}`);
        setTo("");
        setAmount("");
        refresh(myId);
      } else {
        setSendMsg(j.message || "Send failed.");
      }
    } catch {
      setSendMsg("Network error.");
    }
  }

  const inviteLink = me ? (typeof window !== "undefined" ? `${window.location.origin}/join?ref=${me.id}` : `/join?ref=${me.id}`) : "";

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setSendMsg("Invite link copied — anyone opening it credits you on their first win.");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setSendMsg(inviteLink);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-8 pb-24">
      <h1 className="font-display text-3xl font-black tracking-tight">Profile</h1>
      {!me ? (
        <div className="mt-4 space-y-2 rounded-2xl border border-sky/30 bg-white p-4">
          <input
            value={form.nickname}
            onChange={(e) => setForm({ ...form, nickname: e.target.value })}
            placeholder="handle e.g. alex_02"
            className="w-full rounded-lg border border-sky/30 px-3 py-2 text-sm"
          />
          <input
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            placeholder="full name (optional shown)"
            className="w-full rounded-lg border border-sky/30 px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <select
              value={form.programme}
              onChange={(e) => setForm({ ...form, programme: e.target.value })}
              className="flex-1 rounded-lg border border-sky/30 px-3 py-2 text-sm"
            >
              {["PHYS", "ANAT", "BIOCHEM", "MBBS", "PHARM", "NURS", "BMLS", "COMMED"].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
            <select
              value={form.level}
              onChange={(e) => setForm({ ...form, level: e.target.value })}
              className="flex-1 rounded-lg border border-sky/30 px-3 py-2 text-sm"
            >
              {["100L", "200L", "300L", "400L", "500L", "600L"].map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </div>
          <button onClick={create} className="w-full rounded-full bg-accent px-4 py-2 text-sm font-bold text-white">
            Create handle
          </button>
          {msg && <p className="font-mono text-[11px] text-ink/60">{msg}</p>}
          <p className="font-mono text-[10px] text-ink/40">lowercase, _ and a digit — e.g. alex_02</p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="rounded-2xl border border-sky/30 bg-white p-4">
            <p className="text-lg font-black">@{me.nickname}</p>
            {genesis && (
              <p className="mt-1 inline-block rounded-full bg-accent px-2 py-0.5 font-mono text-[10px] font-bold text-white">
                ★ Genesis wallet — first on the chain
              </p>
            )}
            <p className="font-mono text-xs text-ink/60">
              {me.programme} · {me.level}
            </p>
            <button onClick={signOut} className="mt-2 text-xs text-brick">
              Sign out
            </button>
          </div>
          <div className="rounded-2xl border border-sky/30 bg-white p-4">
            <p className="font-mono text-[11px] uppercase text-ink/50">Wallet lock</p>
            <div className="mt-2 flex gap-2">
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="password (8+ chars)"
                type="password"
                className="flex-1 rounded-lg border border-sky/30 px-3 py-2 text-sm"
              />
              <button onClick={login} className="rounded-full bg-ink px-4 py-2 text-sm font-bold text-white">
                Unlock
              </button>
              <button onClick={enrollPw} className="rounded-full border border-sky/30 px-4 py-2 text-sm font-bold">
                Lock
              </button>
            </div>
            <p className="mt-1 font-mono text-[10px] text-ink/40">Lock sets the password once, forever. Unlock opens the session.</p>
            {loginMsg && <p className="mt-1 font-mono text-[11px] text-ink/60">{loginMsg}</p>}
          </div>
          <div className="rounded-2xl border border-sky/30 bg-white p-4">
            <p className="font-mono text-[11px] uppercase text-ink/50">Wallet</p>
            <p className="text-2xl font-black">{Number(me.mining_balance).toFixed(2)} $PHY</p>
            <div className="mt-3 flex gap-2">
              <input
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="send to @handle"
                className="flex-1 rounded-lg border border-sky/30 px-3 py-2 text-sm"
              />
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                inputMode="decimal"
                className="w-24 rounded-lg border border-sky/30 px-3 py-2 text-sm"
              />
              <button onClick={sendCoins} className="rounded-full bg-forest px-4 py-2 text-sm font-bold text-white">
                Send
              </button>
            </div>
            {sendMsg && <p className="mt-1 font-mono text-[11px] text-ink/60">{sendMsg}</p>}
            <p className="mt-1 font-mono text-[10px] text-ink/40">Sends burn 2% (min 0.01) — flow pays for scarcity.</p>
            {history.length > 0 && (
              <div className="mt-3 border-t border-sky/20 pt-2">
                <p className="font-mono text-[10px] uppercase text-ink/40">Recent moves</p>
                {history.map((h) => (
                  <p key={h.id} className="mt-1 font-mono text-[11px] text-ink/60">
                    {h.from_user === me.id ? `sent ${h.amount}` : `got ${h.amount}`} · {String(h.created_at).slice(5, 16).replace("T", " ")}
                  </p>
                ))}
              </div>
            )}
            <a href="/app/roadmap" className="mt-3 block text-sm font-bold text-accent">
              Vote on the Road →
            </a>
          </div>

          {/* Faucet weekly drip — visibly linked to 3-vote + 24h rule */}
          <div className="rounded-2xl border border-sky/30 bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[11px] uppercase tracking-widest text-ink/50">Faucet · 1 $PHY/week</p>
              <span className="rounded-full bg-ink px-2 py-1 font-mono text-[10px] font-bold text-white">{faucet?.week ?? "—"}</span>
            </div>
            {faucetLoading ? (
              <p className="mt-2 font-mono text-xs text-ink/60">Checking faucet…</p>
            ) : faucet ? (
              <>
                <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 font-mono text-xs font-bold text-ink">
                  Faucet status: {faucet.votes}/3 votes{faucet.hoursLeft > 0 ? `, ${faucet.hoursLeft}h to go` : ", ✓ time met"}
                  {faucet.drippedThisWeek ? " · dripped this week" : faucet.eligible ? " · eligible — drips Monday" : " · not yet eligible"}
                </p>
                <p className="mt-2 font-mono text-[11px] leading-relaxed text-ink/60">
                  Needs <span className="font-bold text-ink/80">3 votes</span> + account older than <span className="font-bold text-ink/80">24h</span> for the <span className="font-bold text-ink/80">1 PHY/week</span> drip. One drip per ISO week, separate ledger from the lottery mint.
                  {faucet.eligible && !faucet.drippedThisWeek ? <span className="ml-1 rounded-full bg-forest/10 px-2 py-0.5 font-bold text-forest">✓ eligible</span> : null}
                </p>
                <div className="mt-2 flex gap-1.5 font-mono text-[10px]">
                  <span className={`rounded-full px-2.5 py-1 font-bold ${faucet.votes >= 3 ? "bg-forest text-white" : "bg-sky/20 text-ink/60"}`}>{faucet.votes}/3 votes</span>
                  <span className={`rounded-full px-2.5 py-1 font-bold ${faucet.hoursLeft === 0 ? "bg-forest text-white" : "bg-sky/20 text-ink/60"}`}>{faucet.hoursLeft === 0 ? "✓ 24h met" : `${faucet.hoursLeft}h to go`}</span>
                  <span className={`rounded-full px-2.5 py-1 font-bold ${faucet.eligible ? "bg-forest text-white" : "bg-ink/10 text-ink/40"}`}>{faucet.eligible ? "eligible" : "locked"}</span>
                </div>
              </>
            ) : (
              <>
                <p className="mt-2 rounded-xl border border-sky/20 bg-paper px-3 py-2 font-mono text-xs text-ink/60">Faucet status: connect wallet to check — needs 3 votes + 24h for 1 PHY/week</p>
                <p className="mt-1 font-mono text-[10px] text-ink/40">Vote on 3 timetable slips + wait 24h from handle creation. One drip per ISO week.</p>
              </>
            )}
            <p className="mt-2 font-mono text-[10px] text-ink/40">Flow feeds itself — verify → earn → faucet drips. No new tables.</p>
          </div>

          {/* Invite rewards — slip + Fraunces */}
          <div className="slip rounded-2xl border border-sky/20 bg-white p-5 pt-6">
            <p className="font-mono text-[11px] uppercase tracking-widest text-ink/50">Invite · 0.5 $PHY on their first win</p>
            <h2 className="font-display mt-1 text-xl font-black tracking-tight">Grow the node</h2>
            <p className="mt-1 text-sm leading-relaxed text-ink/60">
              Share your link. When someone you invited wins their first round, you get 0.5 $PHY — once per invitee, no cost to them.
            </p>
            <div className="mt-3 flex gap-2">
              <input
                readOnly
                value={inviteLink}
                onFocus={(e) => e.target.select()}
                className="flex-1 rounded-xl border border-sky/30 bg-paper px-3 py-2.5 font-mono text-xs text-ink/80"
              />
              <button
                onClick={copyInvite}
                className={`shrink-0 rounded-full px-4 py-2.5 text-sm font-bold text-white transition ${copied ? "bg-forest" : "bg-accent hover:bg-accent/90"}`}
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="mt-1 font-mono text-[10px] text-ink/40">Anyone opening the link joins with your id as invited_by.</p>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-sky/20 bg-paper px-3 py-3 text-center">
                <p className="font-display text-xl font-black">{invites?.invite_count ?? "—"}</p>
                <p className="font-mono text-[10px] uppercase tracking-wide text-ink/50">Invited</p>
              </div>
              <div className="rounded-xl border border-sky/20 bg-paper px-3 py-3 text-center">
                <p className="font-display text-xl font-black">{invites?.rewarded_count ?? "—"}</p>
                <p className="font-mono text-[10px] uppercase tracking-wide text-ink/50">Rewarded</p>
              </div>
              <div className="rounded-xl border border-forest/20 bg-forest/10 px-3 py-3 text-center">
                <p className="font-display text-xl font-black text-forest">+{invites ? Number(invites.earned).toFixed(2) : "0.00"}</p>
                <p className="font-mono text-[10px] uppercase tracking-wide text-ink/50">$PHY earned</p>
              </div>
            </div>

            {invites && invites.invites.length > 0 ? (
              <div className="mt-4 border-t border-sky/20 pt-3">
                <p className="font-mono text-[10px] uppercase tracking-wide text-ink/40">Recent invites</p>
                <div className="mt-2 space-y-1">
                  {invites.invites.map((iv) => (
                    <div key={iv.id} className="flex items-center justify-between rounded-lg bg-paper px-3 py-2 font-mono text-xs">
                      <span className="font-bold text-ink">@{iv.nickname}</span>
                      <span className="text-ink/50">{iv.created_at}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${iv.rewarded ? "bg-forest text-white" : "bg-sky/20 text-ink/60"}`}>
                        {iv.rewarded ? "+0.5 paid" : "pending"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="mt-3 font-mono text-[11px] text-ink/40">No invites yet — copy the link and bring the cohort.</p>
            )}
          </div>

          {msg && <p className="font-mono text-[11px] text-ink/60">{msg}</p>}
        </div>
      )}
    </div>
  );
}
