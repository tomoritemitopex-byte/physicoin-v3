import { Fraunces } from "next/font/google";
const display = Fraunces({ subsets: ["latin"], variable: "--font-display" });
export default function Page() {
  return (
    <main className={`${display.variable} min-h-screen bg-[#08100f] text-[#edf8f1] p-8`}>
      <h1 className="font-display text-5xl font-black">Physicoin in Bend</h1>
      <p className="mt-4 max-w-2xl text-lg text-white/70">The biggest upgrade — timetable is mempool, mining locks blocks, chain is timetable. No Next.js textbook, just parallel grids. Previous Next.js chain backed up as backup/nextjs-legacy.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6"><h3 className="font-bold">Grid as Sculpture</h3><p className="mt-2 text-sm text-white/60">6×6 Latin — no hall double-booked, score 0 impossible</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6"><h3 className="font-bold">Ticket as Light</h3><p className="mt-2 text-sm text-white/60">Lowest Argon2id wins, not best score</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6"><h3 className="font-bold">Chain as Gallery</h3><p className="mt-2 text-sm text-white/60">prev_hash → winning_ticket, tamper-evident</p></div>
      </div>
      <p className="mt-8 font-mono text-xs text-white/40">Bend-native • All terms check • Live chain preserved at backup/nextjs-legacy • 145.40 PHY safe</p>
    </main>
  );
}
