"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type LiveEvent = {
  id: string;
  title: string;
  venue: string;
  event_date: string;
  event_time: string;
  severity: string | null;
  required_points: string | number;
};

function explain(j: any, status: number): string {
  const code = String(j?.code || "");
  if (code === "NO_TOKEN" || status === 401) return "Unlock your wallet on Profile, then come back.";
  if (code === "NOT_YOURS" || status === 403) return "This session can't vote as that wallet.";
  if (code === "SELF_VOUCH") return "That's your own post — let a classmate confirm it.";
  if (code === "UNKNOWN_EVENT") return "That change just closed. Pull to refresh.";
  return String(j?.message || "Vote didn't go through — tap again.");
}

export default function LiveVote({
  event,
  tally,
  roundNumber,
}: {
  event: LiveEvent;
  tally: { yes: number; no: number; required: number; status: string };
  roundNumber: number | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"YES" | "NO" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const required = Math.max(1, Number(tally.required) || 8);
  const yes = Number(tally.yes) || 0;
  const pct = Math.min(100, Math.round((yes / required) * 100));
  const done = tally.status === "verified" || yes >= required;

  async function vote(v: "YES" | "NO") {
    setBusy(v);
    setMsg(null);
    try {
      let profile: any = null;
      try {
        profile = JSON.parse(localStorage.getItem("physi_profile") || "null");
      } catch {}
      const token = localStorage.getItem("physi_session");
      if (!profile?.id) {
        setMsg("Create your handle first — then your vote counts.");
        return;
      }
      if (!token) {
        setMsg("Unlock your wallet on Profile, then come back.");
        return;
      }
      const r = await fetch("/api/verify", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ verifier_id: profile.id, event_id: event.id, vote: v }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok !== false) {
        setMsg(v === "YES" ? "Counted — one more classmate." : "Counted.");
        router.refresh();
      } else {
        setMsg(explain(j, r.status));
      }
    } catch {
      setMsg("Network hiccup — tap again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="brutal-card mt-5 p-5">
      <p className="font-display break-words text-[30px] leading-[0.95]">{event.venue}</p>
      <p className="mt-2 text-sm font-bold">{event.title}</p>
      <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.08em] text-ink/65">
        {String(event.event_date).slice(0, 10)} · {String(event.event_time).slice(0, 5)} ·{" "}
        {event.severity ? String(event.severity) : "advisory"}
      </p>

      <div className="mt-5">
        <div className="flex items-end justify-between gap-2">
          <span className="kicker">agreed</span>
          <span className="font-mono text-sm font-bold tabular-nums">
            {yes}/{required} <span className="font-normal text-ink/65">classmates</span>
          </span>
        </div>
        <div
          className="mt-2 h-5 border-[3px] border-ink bg-white"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${yes} of ${required} classmates agreed`}
        >
          <div className={`h-full ${done ? "bg-lime" : "bg-blue"}`} style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-ink/55">
          {done
            ? "✓ confirmed — sealed into the chain"
            : `${Math.max(0, required - yes)} more for the green tick`}
        </p>
      </div>

      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={() => vote("YES")}
          disabled={busy !== null || done}
          className="brutal-btn flex-1"
        >
          {busy === "YES" ? "…" : "✓ Yes"}
        </button>
        <button
          type="button"
          onClick={() => vote("NO")}
          disabled={busy !== null}
          className="brutal-btn brutal-btn--white flex-1"
        >
          {busy === "NO" ? "…" : "✕ No"}
        </button>
      </div>

      {msg && (
        <p
          className="mt-3 border-[3px] border-ink bg-paper-2 px-3 py-2 text-center text-sm font-bold"
          role="status"
        >
          {msg}
        </p>
      )}

      <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.1em] text-ink/65">
        {roundNumber != null
          ? `block #${roundNumber} is open — a confirmed change rides in it`
          : "the chain is catching up"}
      </p>
    </div>
  );
}
