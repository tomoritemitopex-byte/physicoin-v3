"use client";
import { useEffect, useState } from "react";

export default function AdminPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [paused, setPaused] = useState(false);

  async function load() {
    try {
      const r = await fetch("/api/logs?limit=100");
      const j = await r.json();
      if (j.ok) setLogs(j.logs);
    } catch {}
  }

  useEffect(() => {
    load();
    if (paused) return;
    const iv = setInterval(load, 3000);
    return () => clearInterval(iv);
  }, [paused]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black">Admin · event log</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setPaused(!paused)}
            className="rounded-full border border-sky/30 bg-white px-3 py-1 text-xs font-bold"
          >
            {paused ? "Resume" : "Pause"}
          </button>
          <button onClick={load} className="rounded-full border border-sky/30 bg-white px-3 py-1 text-xs font-bold">
            Refresh
          </button>
        </div>
      </div>
      <p className="mt-1 font-mono text-[11px] text-ink/50">{paused ? "paused" : "live"} · last {logs.length} events</p>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-sky/20 bg-white">
        <table className="w-full font-mono text-[11px]">
          <thead>
            <tr className="text-left text-ink/50">
              <th className="p-2">Time</th>
              <th className="p-2">Method</th>
              <th className="p-2">Path</th>
              <th className="p-2">Status</th>
              <th className="p-2">Message</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l, i) => (
              <tr key={i} className="border-t border-sky/10">
                <td className="p-2">{String(l.at).slice(11, 19)}</td>
                <td className="p-2">{l.method}</td>
                <td className="p-2">{l.path}</td>
                <td className="p-2">{l.status}</td>
                <td className="p-2">{l.message}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="p-4 text-center text-ink/50">
                  No errors logged. Quiet is good.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-4">
        <a href="/app/admin/creator" className="text-sm font-bold text-accent">
          Schools & disputes →
        </a>
      </p>
    </div>
  );
}
