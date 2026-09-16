"use client";
import { useEffect, useMemo, useState } from "react";
import { BUILDINGS, LEVELS, NODE_POSITIONS } from "@/lib/campus";

export type FeedEvent = {
  id: string;
  title: string;
  venue: string;
  event_date: string;
  event_time: string;
  scope_type: string;
  scope_value: string | null;
  status: string;
  severity?: string;
};

function myId(): string | null {
  try {
    const raw = localStorage.getItem("physi_profile");
    return raw ? JSON.parse(raw)?.id || null : null;
  } catch {
    return null;
  }
}

function VoteButtons({ id, title }: { id: string; title: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  async function vote(v: "YES" | "NO") {
    const uid = myId();
    if (!uid) {
      setMsg("Create a handle on Profile first.");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch("/api/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ verifier_id: uid, event_id: id, vote: v }),
      });
      const j = await r.json();
      if (j.ok) {
        setMsg(j.promoted ? "✓ Verified!" : v === "YES" ? `Yes ${j.yes}/${j.required}` : `No recorded`);
      } else {
        setMsg(j.message || "Vote failed.");
      }
    } catch {
      setMsg("Network error.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-3 flex items-center gap-3">
      <button
        onClick={() => vote("YES")}
        disabled={busy}
        aria-label={`Confirm ${title}`}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-forest text-xl font-bold text-white shadow disabled:opacity-50"
      >
        ✓
      </button>
      <button
        onClick={() => vote("NO")}
        disabled={busy}
        aria-label={`Reject ${title}`}
        className="flex h-12 w-12 items-center justify-center rounded-full border border-brick/30 bg-white text-base font-bold text-brick disabled:opacity-50"
      >
        ✕
      </button>
      {msg && <span className="font-mono text-[11px] text-ink/60">{msg}</span>}
    </div>
  );
}

function PostForm({ onPosted }: { onPosted: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", venue: "", event_date: "", event_time: "" });
  const [msg, setMsg] = useState("");
  async function submit() {
    const uid = myId();
    if (!uid) {
      setMsg("Create a handle on Profile first.");
      return;
    }
    setMsg("Posting…");
    try {
      const r = await fetch("/api/timetable", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, scope_type: "general", created_by: uid }),
      });
      const j = await r.json();
      if (j.ok && !j.duplicate) {
        setMsg("Posted!");
        setForm({ title: "", venue: "", event_date: "", event_time: "" });
        onPosted();
      } else if (j.duplicate) {
        setMsg("That one already exists.");
      } else {
        setMsg(j.message || "Post failed.");
      }
    } catch {
      setMsg("Network error.");
    }
  }
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white">
        + Post
      </button>
    );
  }
  return (
    <div className="rounded-2xl border border-sky/30 bg-white p-4">
      <div className="grid grid-cols-2 gap-2">
        {(["title", "venue", "event_date", "event_time"] as const).map((f) => (
          <input
            key={f}
            value={form[f]}
            onChange={(e) => setForm({ ...form, [f]: e.target.value })}
            placeholder={f.replace("_", " ")}
            type={f.startsWith("event_") ? (f === "event_date" ? "date" : "time") : "text"}
            className="rounded-lg border border-sky/30 px-3 py-2 text-sm"
          />
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button onClick={submit} className="rounded-full bg-forest px-4 py-2 text-sm font-bold text-white">
          Post change
        </button>
        <button onClick={() => setOpen(false)} className="text-sm text-ink/60">
          Cancel
        </button>
        {msg && <span className="font-mono text-[11px] text-ink/60">{msg}</span>}
      </div>
    </div>
  );
}

export default function RoadClient({ events }: { events: FeedEvent[] }) {
  const [buildingId, setBuildingId] = useState<string | null>(null);
  const [level, setLevel] = useState<string | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("physi_profile");
      const lv = raw ? JSON.parse(raw)?.level : null;
      if (lv) setLevel(lv);
    } catch {}
  }, []);

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const b of BUILDINGS) m[b.id] = 0;
    for (const ev of events) {
      for (const b of BUILDINGS) {
        const hay = `${ev.title} ${ev.venue}`.toLowerCase();
        if (hay.includes(b.code.toLowerCase())) m[b.id]++;
      }
    }
    return m;
  }, [events]);

  const feed = useMemo(() => {
    let list = events;
    if (level) {
      list = list.filter((ev) => {
        const sv = String(ev.scope_value || "").toLowerCase();
        if (sv === level.toLowerCase()) return true;
        if (String(ev.scope_type).toLowerCase() === "general") return true;
        return false;
      });
    }
    return list.slice(0, 12);
  }, [events, level]);

  const verified = events.filter((e) => e.status === "verified").length;

  return (
    <div className="relative z-10">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex gap-4 font-mono text-xs text-ink/70">
          <span>{events.length} events</span>
          <span>{verified} verified</span>
          <span>{events.length - verified} pending</span>
        </div>
        <PostForm onPosted={() => window.location.reload()} />
      </div>

      {BUILDINGS.map((b) => {
        const pos = NODE_POSITIONS[b.id];
        if (!pos) return null;
        const active = buildingId === b.id;
        return (
          <button
            key={b.id}
            onClick={() => setBuildingId(active ? null : b.id)}
            aria-pressed={active}
            aria-label={`${b.label} — ${counts[b.id]} events`}
            className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${pos.x}%`, top: `${pos.y / 10}%` }}
          >
            <span
              className="flex h-14 w-14 items-center justify-center rounded-full text-2xl shadow-lg"
              style={{ background: b.color, outline: active ? "3px solid #0c1e3a" : "none" }}
            >
              {b.icon}
            </span>
            <span className="mt-1 block rounded-full bg-white/90 px-2 py-0.5 font-mono text-[10px] font-bold">
              {b.code} · {counts[b.id]}
            </span>
          </button>
        );
      })}

      {buildingId && (
        <div className="mx-auto mt-6 max-w-lg rounded-2xl border border-sky/30 bg-white/95 p-4">
          <p className="text-sm font-black">
            {BUILDINGS.find((b) => b.id === buildingId)?.label} — pick your level
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {LEVELS.map((lv) => (
              <button
                key={lv}
                onClick={() => setLevel(level === lv ? null : lv)}
                aria-pressed={level === lv}
                className={`rounded-xl border px-3 py-2 text-sm font-bold ${
                  level === lv ? "bg-accent text-white" : "bg-white"
                }`}
              >
                {lv}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mx-auto mt-6 max-w-lg space-y-3 pb-24">
        <p className="font-mono text-[11px] uppercase tracking-widest text-ink/60">
          {buildingId ? "Filtered feed" : "All buildings · live feed"} · {feed.length}
        </p>
        {feed.length === 0 && (
          <div className="rounded-2xl border border-dashed border-sky/40 bg-white/70 p-6 text-center text-sm">
            No timetable yet — be the first to post.
          </div>
        )}
        {feed.map((ev) => (
          <div key={ev.id} className="slip p-4 pt-5">
            <p className="tnum font-mono text-[11px] text-ink/60">
              {String(ev.event_time).slice(0, 5)} · {String(ev.event_date).slice(0, 10)}
            </p>
            <p className="font-display mt-0.5 text-lg font-semibold leading-snug">{ev.venue}</p>
            <p className="text-sm text-ink/80">{ev.title}</p>
            <p className="mt-1.5 font-mono text-[10px] text-ink/50">
              {ev.status === "verified" ? "✓ confirmed" : "· waiting on votes"} · {ev.scope_type}
              {ev.scope_value ? ` · ${ev.scope_value}` : ""}
            </p>
            <VoteButtons id={ev.id} title={ev.title} />
          </div>
        ))}
      </div>
    </div>
  );
}
