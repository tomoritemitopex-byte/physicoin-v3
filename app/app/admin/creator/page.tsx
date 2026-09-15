"use client";
import { useEffect, useState } from "react";

export default function CreatorPage() {
  const [schools, setSchools] = useState<any[]>([]);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [tab, setTab] = useState<"schools" | "disputes">("schools");
  const [msg, setMsg] = useState("");

  async function load() {
    try {
      const [s, d] = await Promise.all([
        fetch("/api/schools?status=pending").then((r) => r.json()),
        fetch("/api/schools/disputes?status=active").then((r) => r.json()),
      ]);
      if (s.ok) setSchools(s.schools);
      if (d.ok) setDisputes(d.disputes);
    } catch {}
  }

  useEffect(() => {
    load();
  }, []);

  async function reviewSchool(id: string, status: "verified" | "rejected") {
    let reviewer_id = "";
    try {
      reviewer_id = JSON.parse(localStorage.getItem("physi_profile") || "{}")?.id || "";
    } catch {}
    const r = await fetch("/api/schools", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, status, reviewer_id }),
    });
    const j = await r.json();
    setMsg(j.ok ? `${status}` : j.message || "Failed.");
    load();
  }

  async function resolveDispute(id: string, outcome: string) {
    let resolved_by = "";
    try {
      resolved_by = JSON.parse(localStorage.getItem("physi_profile") || "{}")?.id || "";
    } catch {}
    const r = await fetch("/api/schools/disputes", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, outcome, resolved_by }),
    });
    const j = await r.json();
    setMsg(j.ok ? `${outcome}` : j.message || "Failed.");
    load();
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 pb-24">
      <h1 className="text-xl font-black">Schools & disputes</h1>
      <p className="font-mono text-[11px] text-ink/50">
        {schools.length} pending schools · {disputes.length} active disputes
      </p>
      <div className="mt-3 flex gap-2">
        {(["schools", "disputes"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-1.5 text-sm font-bold ${tab === t ? "bg-accent text-white" : "bg-white border border-sky/30"}`}
          >
            {t}
          </button>
        ))}
      </div>
      {msg && <p className="mt-2 font-mono text-xs text-ink/60">{msg}</p>}
      {tab === "schools" && (
        <div className="mt-4 space-y-2">
          {schools.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-xl border border-sky/20 bg-white p-3">
              <div>
                <p className="font-bold">{s.name}</p>
                <p className="font-mono text-[11px] text-ink/50">{s.department_count} departments</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => reviewSchool(s.id, "verified")} className="rounded-full bg-forest px-3 py-1 text-xs font-bold text-white">
                  ✓
                </button>
                <button onClick={() => reviewSchool(s.id, "rejected")} className="rounded-full border border-brick/30 px-3 py-1 text-xs font-bold text-brick">
                  ✕
                </button>
              </div>
            </div>
          ))}
          {schools.length === 0 && <p className="text-sm text-ink/50">No pending schools.</p>}
        </div>
      )}
      {tab === "disputes" && (
        <div className="mt-4 space-y-2">
          {disputes.map((d) => (
            <div key={d.id} className="rounded-xl border border-sky/20 bg-white p-3">
              <p className="font-mono text-[11px] text-ink/50">{d.id.slice(0, 8)} · {d.dispute_type}</p>
              <div className="mt-2 flex gap-2">
                <button onClick={() => resolveDispute(d.id, "resolved_a_wins")} className="rounded-full bg-white border border-sky/30 px-3 py-1 text-xs font-bold">
                  A wins
                </button>
                <button onClick={() => resolveDispute(d.id, "resolved_b_wins")} className="rounded-full bg-white border border-sky/30 px-3 py-1 text-xs font-bold">
                  B wins
                </button>
              </div>
            </div>
          ))}
          {disputes.length === 0 && <p className="text-sm text-ink/50">No active disputes.</p>}
        </div>
      )}
      <p className="mt-4 font-mono text-[10px] text-ink/40">
        Burns: 30% destroyed · 5% to resolver · 70% to winner's creator.
      </p>
    </div>
  );
}
