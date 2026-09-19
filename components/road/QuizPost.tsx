"use client";
import { useState, useCallback } from "react";
import { BUILDINGS } from "@/lib/campus";
import { PERIODS } from "@/lib/schedule";

const PENDING_KEY = "physi_pending_posts";

// Use first 6 halls as spec says 6 pills — matches PERIODS length, remains inside BUILDINGS data
const HALLS = BUILDINGS.slice(0, 6);
const TIMES = PERIODS;

function getCreds(): { uid: string | null; token: string } {
  try {
    const raw = localStorage.getItem("physi_profile");
    const p = raw ? JSON.parse(raw) : null;
    const uid = p?.id || null;
    const token = localStorage.getItem("physi_session") || "";
    return { uid, token };
  } catch {
    return { uid: null, token: "" };
  }
}

function queuePending(o: Record<string, unknown>) {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    const list = raw ? JSON.parse(raw) : [];
    const arr = Array.isArray(list) ? list : [];
    arr.push({ ...o, queuedAt: Date.now() });
    localStorage.setItem(PENDING_KEY, JSON.stringify(arr));
  } catch {}
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function QuizPost({
  onPosted,
  variant = "road",
}: {
  onPosted?: () => void;
  variant?: "road" | "board";
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [hall, setHall] = useState<string | null>(null);
  const [period, setPeriod] = useState<string | null>(null);
  const [course, setCourse] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = useCallback(() => {
    setStep(1);
    setHall(null);
    setPeriod(null);
    setCourse("");
    setMsg("");
    setBusy(false);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    // keep selections for quick retry, but clear msg
    setMsg("");
  }, []);

  function pickHall(code: string) {
    setHall(code);
    setStep(2);
    setMsg("");
  }
  function pickPeriod(p: string) {
    setPeriod(p);
    setStep(3);
    setMsg("");
  }

  async function submit() {
    const { uid, token } = getCreds();
    if (!uid) {
      setMsg("Create a handle on Profile first.");
      return;
    }
    if (!hall || !period) {
      setMsg("Pick a hall and time first.");
      return;
    }
    if (!course.trim()) {
      setMsg("Add the course next — what moved?");
      return;
    }
    const payload = {
      title: course.trim().slice(0, 200),
      venue: hall.trim().slice(0, 200),
      event_date: todayISO(),
      event_time: period,
      scope_type: "general",
      created_by: uid,
      token: token || undefined,
      _mine: true,
    };

    // offline queue preserved — additive, no new tables
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      queuePending(payload);
      setMsg("Offline — queued, will sync when back.");
      setCourse("");
      onPosted?.();
      return;
    }

    setBusy(true);
    setMsg("Posting…");
    try {
      const headers: Record<string, string> = { "content-type": "application/json" };
      if (token) headers["authorization"] = `Bearer ${token}`;
      const r = await fetch("/api/timetable", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) {
        if (j.code === "NO_TOKEN") {
          setMsg("Unlock your wallet on Profile — we need your session to post.");
          return;
        }
        throw new Error(j.message || "Post failed.");
      }
      if (j.duplicate) {
        setMsg("That notice already exists.");
        return;
      }
      // invisible mining: timetable edit IS the mine.
      // Server auto-grinds via _mine flag; also fire client-side best-effort for instant ticket.
      if (uid && token) {
        fetch("/api/mining", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
          body: JSON.stringify({ user_id: uid }),
        }).catch(() => {});
      }
      setMsg("Posted — mining in background ✓");
      setCourse("");
      // keep hall/period so posting another is one tap less — but reset to step 1 if user wants fresh
      // auto-close after brief success so feed updates feel instant
      onPosted?.();
      setTimeout(() => {
        setOpen(false);
        reset();
      }, 700);
    } catch (e) {
      // network failure -> queue offline, preserved
      const isNetwork = e instanceof TypeError || String((e as Error).message).toLowerCase().includes("fetch");
      if (isNetwork) {
        try {
          queuePending(payload);
          setMsg("Offline — queued, will sync when back.");
          onPosted?.();
          return;
        } catch {}
      }
      setMsg(e instanceof Error ? e.message : "Post failed.");
    } finally {
      setBusy(false);
    }
  }

  const pct = step === 1 ? 33 : step === 2 ? 66 : 100;
  const hint =
    step === 1 ? "Which hall moved?" : step === 2 ? "When?" : "What course?";

  // closed pill — one-glance, lightweight
  if (!open) {
    return (
      <button
        onClick={() => {
          setOpen(true);
          reset();
        }}
        className={
          variant === "board"
            ? "inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-[13px] font-bold text-white shadow hover:bg-accent/90"
            : "rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white shadow hover:bg-accent/90"
        }
      >
        <span className="grid h-6 w-6 place-items-center rounded-full bg-white/20 text-[12px]">✎</span>
        {variant === "board" ? "Post a slip" : "+ Post"}
      </button>
    );
  }

  return (
    <div
      className={
        variant === "board"
          ? "rounded-2xl border border-sky/30 bg-paper p-3 sm:p-4"
          : "rounded-2xl border border-sky/30 bg-white p-4 shadow-sm"
      }
    >
      {/* progress */}
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-ink/50">
          {step}/3 · {hint}
        </p>
        <button
          onClick={close}
          aria-label="Close"
          className="rounded-full bg-ink/5 px-2 py-1 font-mono text-[10px] font-bold text-ink/60 hover:bg-ink/10"
        >
          ✕
        </button>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sky/15">
        <div
          className="h-full rounded-full bg-accent transition-all duration-300"
          style={{ width: `${pct}%` }}
          aria-hidden
        />
      </div>

      {/* Step 1: hall pills — one tap, no keyboard */}
      {step === 1 && (
        <div className="mt-3">
          <p className="font-display text-[15px] font-black leading-tight">Which hall moved?</p>
          <p className="mt-1 font-mono text-[11px] text-ink/50">Tap one — prompt is the interface.</p>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {HALLS.map((b) => (
              <button
                key={b.id}
                onClick={() => pickHall(b.code)}
                aria-pressed={hall === b.code}
                className={`rounded-2xl border px-2 py-3 text-center transition ${
                  hall === b.code
                    ? "border-accent bg-accent text-white shadow"
                    : "border-sky/20 bg-white hover:border-accent/40 hover:bg-sky/5"
                }`}
                style={{ borderLeftWidth: hall === b.code ? 2 : 1 }}
              >
                <span className="block text-[16px]" aria-hidden>
                  {b.icon}
                </span>
                <span className="mt-1 block font-mono text-[11px] font-black tracking-wide">{b.code}</span>
                <span className="block font-mono text-[9px] leading-none opacity-60">{b.label}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 font-mono text-[10px] text-ink/40">6 halls · from BUILDINGS (ANAT → COMM MED). No typing yet.</p>
        </div>
      )}

      {/* Step 2: period pills */}
      {step === 2 && (
        <div className="mt-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-2.5 py-1 font-mono text-[11px] font-bold text-accent">
              {hall} ✓
            </span>
            <button onClick={() => setStep(1)} className="font-mono text-[11px] font-bold text-ink/40 hover:text-ink">
              ← back
            </button>
          </div>
          <p className="mt-3 font-display text-[15px] font-black leading-tight">When?</p>
          <p className="mt-1 font-mono text-[11px] text-ink/50">Pick the period — one tap.</p>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {TIMES.map((t) => (
              <button
                key={t}
                onClick={() => pickPeriod(t)}
                aria-pressed={period === t}
                className={`rounded-2xl border px-3 py-3 font-mono text-sm font-black tabular-nums transition ${
                  period === t
                    ? "border-accent bg-accent text-white shadow"
                    : "border-sky/20 bg-white hover:border-accent/40 hover:bg-sky/5"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <p className="mt-2 font-mono text-[10px] text-ink/40">From PERIODS · no keyboard yet.</p>
        </div>
      )}

      {/* Step 3: course free text + confirm */}
      {step === 3 && (
        <div className="mt-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-1 font-mono text-[11px] font-bold text-accent">
              {hall} ✓
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-1 font-mono text-[11px] font-bold text-accent">
              {period} ✓
            </span>
            <button
              onClick={() => setStep(2)}
              className="font-mono text-[11px] font-bold text-ink/40 hover:text-ink"
            >
              ← back
            </button>
          </div>
          <p className="mt-3 font-display text-[15px] font-black leading-tight">What course?</p>
          <p className="mt-1 font-mono text-[11px] text-ink/50">One field only — keyboard appears here. Then confirm.</p>
          <input
            value={course}
            onChange={(e) => setCourse(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !busy && course.trim()) submit();
            }}
            placeholder="e.g. Physiology lecture — Hall B → Hall C"
            autoFocus
            className="mt-3 w-full rounded-xl border border-sky/25 bg-white px-3 py-3 text-sm outline-none placeholder:text-ink/30 focus:border-accent/40 focus:ring-2 focus:ring-accent/15"
            maxLength={200}
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="font-mono text-[10px] text-ink/40">{course.trim().length}/200</span>
            <span className="font-mono text-[10px] text-ink/40">posts to /api/timetable + auto-mines</span>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={submit}
              disabled={busy || !course.trim()}
              className="rounded-full bg-ink px-5 py-2.5 text-sm font-black text-white hover:bg-accent disabled:opacity-40"
            >
              {busy ? "Pinning…" : "Confirm & pin"}
            </button>
            <button onClick={close} className="text-sm font-semibold text-ink/50 hover:text-ink">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* progress dots */}
      <div className="mt-4 flex items-center justify-center gap-1.5" aria-hidden>
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            className={`h-1.5 rounded-full transition-all ${step === n ? "w-6 bg-accent" : n < step ? "w-3 bg-accent/40" : "w-3 bg-sky/20"}`}
          />
        ))}
      </div>

      {msg && (
        <p className="mt-3 rounded-xl border border-sky/20 bg-white px-3 py-2 font-mono text-[11px] leading-relaxed text-ink/70" role="status" aria-live="polite">
          {msg}
        </p>
      )}
    </div>
  );
}
