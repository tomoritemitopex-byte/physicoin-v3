import { recentRounds } from "@/lib/domains/rounds";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RoundsPage() {
  let rounds: any[] = [];
  try {
    rounds = await recentRounds(30);
  } catch {
    rounds = [];
  }
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 pb-24">
      <h1 className="text-xl font-black">Round history</h1>
      <p className="mt-1 font-mono text-[11px] text-ink/50">
        Every round, every winner. Lowest grid takes the coin.
      </p>
      <div className="mt-4 space-y-2">
        {rounds.map((r) => (
          <div key={r.number} className="flex items-center justify-between rounded-xl border border-sky/20 bg-white p-3 font-mono text-xs">
            <span className="font-black">#{r.number}</span>
            <span>{r.status === "closed" ? (r.winner ? `@${r.winner}` : "no contest") : "open…"}</span>
            <span>{r.winning_score !== null ? `score ${r.winning_score}` : "—"}</span>
            <span>+{r.reward}</span>
          </div>
        ))}
        {rounds.length === 0 && <p className="text-sm text-ink/50">No rounds yet.</p>}
      </div>
    </div>
  );
}
