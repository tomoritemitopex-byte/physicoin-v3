import { cloakedBaseUrl, getCloakedHealth } from "@/lib/cloaked/client";

export const dynamic = "force-dynamic";

export default async function EcosystemPage() {
  const health = await getCloakedHealth();
  const url = cloakedBaseUrl();
  return (
    <section className="mx-auto max-w-4xl px-5 pb-28 pt-10">
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-cyan-700">One ecosystem</p>
      <h1 className="mt-2 font-display text-4xl font-black tracking-tight">Physicoin protocol + Cloaked app</h1>
      <p className="mt-4 max-w-2xl text-slate-600">
        Physicoin V3 supplies the ledger, proof and signed-transaction protocol. Cloaked Physicoin remains the student timetable, verification and governance application layer while migration proceeds.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-widest text-slate-500">Protocol</p>
          <h2 className="mt-2 text-2xl font-black">Physicoin V3</h2>
          <ul className="mt-4 space-y-2 text-sm text-slate-600">
            <li>Canonical blockchain and proof rules</li>
            <li>Signed transactions and wallet ownership</li>
            <li>Mining, chain validation and explorer APIs</li>
          </ul>
        </article>

        <article className="rounded-3xl border border-cyan-200 bg-cyan-50 p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-cyan-800">Application</p>
              <h2 className="mt-2 text-2xl font-black">Cloaked Physicoin</h2>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-black ${health.ok ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
              {health.ok ? "Connected" : health.reachable ? "Responding" : "Offline"}
            </span>
          </div>
          <ul className="mt-4 space-y-2 text-sm text-slate-600">
            <li>Timetable and campus events</li>
            <li>Student verification and governance</li>
            <li>Profiles, reputation and existing community tools</li>
          </ul>
          <a className="mt-6 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white" href={url} target="_blank" rel="noreferrer">
            Open Cloaked Physicoin
          </a>
        </article>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
        <strong className="text-slate-900">Migration status:</strong> the two deployments are linked through a stable service boundary first. Database writes and balances are not silently shared until signed-wallet migration and transaction verification are complete.
      </div>
    </section>
  );
}
