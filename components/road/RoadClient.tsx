"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
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

const CACHE_KEY = "physi_timetable_cache";
const PENDING_KEY = "physi_pending_posts";
const HEAT_BOOST_KEY = "physi_heat_boost";
const HEAT_CACHE_KEY = "physi_heat_cache";

type PendingPost = {
  title: string;
  venue: string;
  event_date: string;
  event_time: string;
  scope_type: string;
  scope_value?: string | null;
  created_by: string;
  queuedAt: number;
};

function myId(): string | null {
  try {
    const raw = localStorage.getItem("physi_profile");
    return raw ? JSON.parse(raw)?.id || null : null;
  } catch {
    return null;
  }
}

function getCached(): FeedEvent[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as FeedEvent[];
    if (parsed && Array.isArray(parsed.events)) return parsed.events as FeedEvent[];
    return null;
  } catch {
    return null;
  }
}

function setCached(events: FeedEvent[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(events));
  } catch {}
}

function getPending(): PendingPost[] {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function setPending(list: PendingPost[]) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(list));
  } catch {}
}

function queuePending(post: Omit<PendingPost, "queuedAt">) {
  const list = getPending();
  list.push({ ...post, queuedAt: Date.now() });
  setPending(list);
}

async function syncPendingPosts(): Promise<{ synced: number; remaining: number }> {
  const pending = getPending();
  if (pending.length === 0) return { synced: 0, remaining: 0 };
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { synced: 0, remaining: pending.length };
  }
  const remaining: PendingPost[] = [];
  let synced = 0;
  for (const p of pending) {
    try {
      const r = await fetch("/api/timetable", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: p.title,
          venue: p.venue,
          event_date: p.event_date,
          event_time: p.event_time,
          scope_type: p.scope_type,
          scope_value: p.scope_value ?? null,
          created_by: p.created_by,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (j.ok || j.duplicate) {
        synced++;
      } else {
        remaining.push(p);
      }
    } catch {
      remaining.push(p);
      const idx = pending.indexOf(p);
      for (let i = idx + 1; i < pending.length; i++) remaining.push(pending[i]);
      break;
    }
  }
  setPending(remaining);
  return { synced, remaining: remaining.length };
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
    if (!form.title.trim() || !form.venue.trim() || !form.event_date || !form.event_time) {
      setMsg("Fill all fields.");
      return;
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      queuePending({ ...form, scope_type: "general", created_by: uid });
      setMsg("Offline — queued, will sync when back.");
      setForm({ title: "", venue: "", event_date: "", event_time: "" });
      onPosted();
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
      queuePending({ ...form, scope_type: "general", created_by: uid });
      setMsg("Offline — queued, will sync when back.");
      onPosted();
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
  const [displayEvents, setDisplayEvents] = useState<FeedEvent[]>(events);
  const [isOffline, setIsOffline] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  // heat hall
  const [serverHeat, setServerHeat] = useState<Record<string, number> | null>(null);
  const [boostHall, setBoostHall] = useState<string | null>(null);
  const [heatToast, setHeatToast] = useState<string>("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem("physi_profile");
      const lv = raw ? JSON.parse(raw)?.level : null;
      if (lv) setLevel(lv);
    } catch {}
    try {
      const b = localStorage.getItem(HEAT_BOOST_KEY);
      if (b) {
        const p = JSON.parse(b);
        if (p?.buildingId && Date.now() - (p.ts || 0) < 10 * 60 * 1000) setBoostHall(p.buildingId);
        else localStorage.removeItem(HEAT_BOOST_KEY);
      }
    } catch {}
    try {
      const cachedHeat = localStorage.getItem(HEAT_CACHE_KEY);
      if (cachedHeat) {
        const p = JSON.parse(cachedHeat);
        if (p?.heat) setServerHeat(p.heat);
      }
    } catch {}
  }, []);

  const refreshPendingCount = useCallback(() => {
    setPendingCount(getPending().length);
  }, []);

  useEffect(() => {
    if (events.length > 0) {
      setCached(events);
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setIsOffline(true);
      }
      setDisplayEvents(events);
    }
    refreshPendingCount();
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      const cached = getCached();
      if (cached && cached.length > 0) {
        setDisplayEvents(cached);
      }
      setIsOffline(true);
    }
  }, [events, refreshPendingCount]);

  const fetchTimetable = useCallback(async () => {
    try {
      const r = await fetch("/api/timetable?limit=60", { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      if (j.ok && Array.isArray(j.events)) {
        setDisplayEvents(j.events);
        setCached(j.events);
        setIsOffline(false);
        return;
      }
      throw new Error("bad payload");
    } catch {
      const cached = getCached();
      if (cached && cached.length > 0) {
        setDisplayEvents(cached);
        setIsOffline(true);
      } else if (events.length === 0) {
        setIsOffline(true);
      } else {
        setIsOffline(true);
      }
    }
  }, [events]);

  const fetchHeat = useCallback(async () => {
    try {
      const r = await fetch("/api/halls/heat", { cache: "no-store" });
      const j = await r.json();
      if (j.ok && j.heat) {
        setServerHeat(j.heat);
        try { localStorage.setItem(HEAT_CACHE_KEY, JSON.stringify({ heat: j.heat, ts: Date.now() })); } catch {}
      } else if (j.heat) {
        // fallback when spread heat
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.onLine) {
      fetchTimetable();
      fetchHeat();
      syncPendingPosts().then((res) => {
        refreshPendingCount();
        if (res.synced > 0) fetchTimetable();
      });
    } else {
      const cached = getCached();
      if (cached && cached.length > 0) {
        setDisplayEvents(cached);
        setIsOffline(true);
      }
    }

    const onOnline = async () => {
      setIsOffline(false);
      const res = await syncPendingPosts();
      refreshPendingCount();
      if (res.synced > 0) await fetchTimetable();
      else await fetchTimetable();
      await fetchHeat();
    };
    const onOffline = () => {
      setIsOffline(true);
      refreshPendingCount();
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    const onStorage = (e: StorageEvent) => {
      if (e.key === PENDING_KEY) refreshPendingCount();
      if (e.key === CACHE_KEY && isOffline) {
        const c = getCached();
        if (c) setDisplayEvents(c);
      }
      if (e.key === HEAT_BOOST_KEY) {
        try {
          const b = e.newValue ? JSON.parse(e.newValue) : null;
          setBoostHall(b?.buildingId || null);
        } catch {}
      }
    };
    window.addEventListener("storage", onStorage);
    // poll heat every 30s when online (lightweight, offline-first)
    const heatIv = setInterval(() => {
      if (typeof navigator !== "undefined" && navigator.onLine) fetchHeat();
    }, 30000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("storage", onStorage);
      clearInterval(heatIv);
    };
  }, [fetchTimetable, fetchHeat, refreshPendingCount, isOffline]);

  const handlePosted = useCallback(async () => {
    refreshPendingCount();
    if (typeof navigator !== "undefined" && navigator.onLine && getPending().length === 0) {
      window.location.reload();
    } else {
      const cached = getCached();
      if (cached) setDisplayEvents(cached);
      refreshPendingCount();
    }
  }, [refreshPendingCount]);

  // local heat from pending events (offline-first, one-glance)
  const localCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const b of BUILDINGS) m[b.id] = 0;
    const pending = displayEvents.filter((e) => e.status === "pending");
    for (const ev of pending) {
      const hay = `${ev.title} ${ev.venue}`.toLowerCase();
      for (const b of BUILDINGS) {
        if (hay.includes(b.code.toLowerCase())) { m[b.id]++; break; }
      }
    }
    return m;
  }, [displayEvents]);

  const heatCounts = serverHeat || localCounts;
  const hottest = useMemo(() => {
    let max = 0; let h: string | null = null;
    for (const b of BUILDINGS) {
      const c = heatCounts[b.id] || 0;
      if (c > max) { max = c; h = b.id; }
    }
    return max > 0 ? h : null;
  }, [heatCounts]);
  const maxHeat = hottest ? (heatCounts[hottest] || 0) : 0;

  // total nodes counts (all events) for label fallback
  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const b of BUILDINGS) m[b.id] = 0;
    for (const ev of displayEvents) {
      for (const b of BUILDINGS) {
        const hay = `${ev.title} ${ev.venue}`.toLowerCase();
        if (hay.includes(b.code.toLowerCase())) m[b.id]++;
      }
    }
    return m;
  }, [displayEvents]);

  const feed = useMemo(() => {
    let list = displayEvents;
    if (level) {
      list = list.filter((ev) => {
        const sv = String(ev.scope_value || "").toLowerCase();
        if (sv === level.toLowerCase()) return true;
        if (String(ev.scope_type).toLowerCase() === "general") return true;
        return false;
      });
    }
    return list.slice(0, 12);
  }, [displayEvents, level]);

  const verified = displayEvents.filter((e) => e.status === "verified").length;

  const onTapBuilding = useCallback((bId: string) => {
    const isHottest = bId === hottest && (heatCounts[bId] || 0) > 0;
    if (isHottest) {
      try {
        localStorage.setItem(HEAT_BOOST_KEY, JSON.stringify({ buildingId: bId, ts: Date.now() }));
        setBoostHall(bId);
        const label = BUILDINGS.find((x) => x.id === bId)?.code || bId;
        setHeatToast(`Next ticket ×1.5 for ${label}`);
        setTimeout(() => setHeatToast(""), 2600);
      } catch {}
    }
    setBuildingId((prev) => (prev === bId ? null : bId));
  }, [hottest, heatCounts]);

  return (
    <div className="relative z-10">
      <style>{`@keyframes hallPulse{0%{box-shadow:0 0 0 0 rgba(220,38,38,0.55)}70%{box-shadow:0 0 0 14px rgba(220,38,38,0)}100%{box-shadow:0 0 0 0 rgba(220,38,38,0)}} @keyframes heatBadgePop{0%{transform:scale(0.85)}50%{transform:scale(1.06)}100%{transform:scale(1)}}`}</style>
      {isOffline && (
        <div
          role="status"
          aria-live="polite"
          className="mb-3 rounded-xl border border-amber-300 bg-amber-100 px-4 py-2 text-center font-mono text-xs font-bold text-amber-900"
        >
          Offline — showing last green ticks, will sync when back
          {pendingCount > 0 ? ` · ${pendingCount} queued` : ""}
        </div>
      )}
      {!isOffline && pendingCount > 0 && (
        <div role="status" className="mb-3 rounded-xl border border-sky/30 bg-white/90 px-4 py-2 text-center font-mono text-xs text-ink/70">
          {pendingCount} slip{pendingCount > 1 ? "s" : ""} queued — will sync when back
        </div>
      )}
      {/* Heat Hall — one-glance strip */}
      <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-sky/20 bg-white/90 px-3 py-2 shadow-sm">
        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-ink/50">Heat Hall</span>
        {hottest ? (
          <span className="flex items-center gap-2 font-mono text-[11px]">
            <span className="inline-block h-2 w-2 rounded-full bg-brick animate-pulse" aria-hidden />
            <span className="font-bold text-brick">{BUILDINGS.find((b)=>b.id===hottest)?.code} hottest · {maxHeat} pending</span>
            <span className="hidden sm:inline text-ink/40">tap red hall → next ticket ×1.5</span>
          </span>
        ) : (
          <span className="font-mono text-[11px] text-ink/40">no pending heat — post a slip</span>
        )}
        {boostHall && (
          <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 font-mono text-[10px] font-bold text-amber-800">
            Next ticket ×1.5 for {BUILDINGS.find((b)=>b.id===boostHall)?.code}
          </span>
        )}
      </div>
      {boostHall && (
        <div className="mb-2 flex sm:hidden">
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 font-mono text-[10px] font-bold text-amber-800">
            Next ticket ×1.5 for {BUILDINGS.find((b)=>b.id===boostHall)?.code}
          </span>
        </div>
      )}
      {heatToast && (
        <div role="status" aria-live="polite" className="mb-2 rounded-full bg-ink px-3 py-1.5 text-center font-mono text-xs font-bold text-white">
          {heatToast} — lightweight hint stored (no backend change)
        </div>
      )}
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex gap-4 font-mono text-xs text-ink/70">
          <span>{displayEvents.length} events</span>
          <span>{verified} verified</span>
          <span>{displayEvents.length - verified} pending</span>
        </div>
        <PostForm onPosted={handlePosted} />
      </div>

      {BUILDINGS.map((b) => {
        const pos = NODE_POSITIONS[b.id];
        if (!pos) return null;
        const active = buildingId === b.id;
        const heat = heatCounts[b.id] || 0;
        const isHottest = b.id === hottest && heat > 0;
        const isWarm = heat > 0 && !isHottest;
        return (
          <button
            key={b.id}
            onClick={() => onTapBuilding(b.id)}
            aria-pressed={active}
            aria-label={`${b.label} — ${counts[b.id]} events, ${heat} pending heat${isHottest ? " — hottest" : ""}`}
            className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${pos.x}%`, top: `${pos.y / 10}%` }}
          >
            <span className="relative flex">
              <span
                className="flex h-14 w-14 items-center justify-center rounded-full text-2xl shadow-lg transition-transform"
                style={{
                  background: b.color,
                  outline: active ? "3px solid #0c1e3a" : isHottest ? "3px solid #dc2626" : isWarm ? "2px solid #38bdf8" : "none",
                  transform: isHottest ? "scale(1.11)" : isWarm ? "scale(1.03)" : "scale(1)",
                  animation: isHottest ? "hallPulse 1.6s ease-out infinite" : "none",
                }}
              >
                {b.icon}
              </span>
              {heat > 0 && (
                <span
                  className={`absolute -right-1 -top-1 grid h-6 min-w-[24px] place-items-center rounded-full px-1 font-mono text-[11px] font-black text-white shadow ${isHottest ? "bg-brick" : "bg-sky-500"}`}
                  style={{ animation: isHottest ? "heatBadgePop 1.2s ease-in-out infinite" : "none" }}
                >
                  {heat}
                </span>
              )}
            </span>
            <span className={`mt-1 block rounded-full px-2 py-0.5 font-mono text-[10px] font-bold ${isHottest ? "bg-brick text-white" : isWarm ? "bg-sky-500 text-white" : "bg-white/90 text-ink"}`}>
              {b.code} · {counts[b.id]}{isHottest ? " 🔥" : ""}
            </span>
          </button>
        );
      })}

      {buildingId && (
        <div className="mx-auto mt-6 max-w-lg rounded-2xl border border-sky/30 bg-white/95 p-4">
          <p className="text-sm font-black">
            {BUILDINGS.find((b) => b.id === buildingId)?.label} — pick your level
          </p>
          {buildingId === boostHall && boostHall && (
            <p className="mt-1 font-mono text-[11px] font-bold text-amber-700">Next ticket ×1.5 for this hall (local hint)</p>
          )}
          {buildingId === hottest && hottest && (
            <p className="mt-1 font-mono text-[11px] text-brick">🔥 Hottest hall — tap again to lock ×1.5 for next mining ticket</p>
          )}
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
