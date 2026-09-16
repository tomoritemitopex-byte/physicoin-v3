import { recentRounds, leaderboard } from "@/lib/domains/rounds";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RoundsPage() {
  let rounds: any[] = [];
  let leaders: any[] = [];
  try {
    rounds = await recentRounds(30);
    leaders = await leaderboard(10);
  } catch {
    rounds = [];
  }
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 pb-24">
      <h1 className="font-display text-3xl font-black tracking-tight">Round history</h1>
      <p className="mt-1 text-sm text-ink/60">
        Every block locks timetable slips. Mining mints the timetable — chain, grid, and txs together.
      </p>
      {leaders.length > 0 && (
        <div className="mt-4 rounded-2xl border border-accent/30 bg-white p-4">
          <p className="font-mono text-[11px] uppercase text-ink/50">Leaderboard</p>
          {leaders.map((l, i) => (
            <div key={l.nickname} className="mt-1 flex items-center justify-between font-mono text-xs">
              <span className="font-black">
                {i + 1}. @{l.nickname}
              </span>
              <span>
                {l.wins} wins · +{l.earned} · best {l.best_score}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="mt-4 space-y-2">
        {rounds.map((r) => (
          <a
            key={r.number}
            href={`/api/rounds?round=${r.number}`}
            className="flex items-center justify-between rounded-xl border border-sky/20 bg-white p-3 font-mono text-xs hover:border-accent/40"
          >
            <span className="font-black">#{r.number}</span>
            <span>{r.status === "closed" ? (r.winner ? `@${r.winner}` : "empty") : "open…"}</span>
            <span>{r.winning_score !== null ? `score ${r.winning_score}` : "—"}</span>
            <span>+{r.reward}</span>
          </a>
        ))}
        {rounds.length === 0 && <p className="text-sm text-ink/50">No rounds yet.</p>}
      </div>
    </div>
  );
}
