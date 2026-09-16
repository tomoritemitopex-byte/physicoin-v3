"use client";
import { useEffect, useState } from "react";

type Profile = {
  id: string;
  nickname: string;
  programme: string;
  level: string;
  mining_balance: string;
};

export default function ProfilePage() {
  const [me, setMe] = useState<Profile | null>(null);
  const [genesis, setGenesis] = useState(false);
  const [form, setForm] = useState({ full_name: "", nickname: "", programme: "PHYS", level: "100L" });
  const [msg, setMsg] = useState("");

  async function refresh(id: string) {
    try {
      const r = await fetch(`/api/profile?id=${encodeURIComponent(id)}`);
      const j = await r.json();
      if (j.ok) {
        setMe(j.user);
        setGenesis(j.rank === 1);
        localStorage.setItem("physi_profile", JSON.stringify(j.user));
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
      const sess = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ user_id: myId }),
      }).then((r) => r.json());
      if (!sess.ok) {
        setSendMsg("Could not authorize wallet.");
        return;
      }
      const r = await fetch("/api/wallet/send", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${sess.token}` },
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
            <button
              onClick={() => {
                const link = `${window.location.origin}/join?ref=${me.id}`;
                navigator.clipboard?.writeText(link).catch(() => {});
                setSendMsg("Invite link copied — anyone opening it can mine.");
              }}
              className="mt-2 text-sm font-bold text-accent"
            >
              Copy my invite link
            </button>
            <a href="/app/roadmap" className="mt-2 block text-sm font-bold text-accent">
              Vote on the Road →
            </a>
          </div>
          {msg && <p className="font-mono text-[11px] text-ink/60">{msg}</p>}
        </div>
      )}
    </div>
  );
}
