import type { Metadata } from "next";
import { recentRounds, recentWins, chainTotals, verifyChain } from "@/lib/domains/rounds";
import { stats } from "@/lib/domains/misc";
import LiveChain from "@/components/live/LiveChain";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "PhysiCoin — live chain",
  description: "Blocks sealed by students. Check the chain yourself.",
};

export default async function LivePage() {
  let blocks: any[] = [];
  let wins: any[] = [];
  let chain: { valid: boolean | null; brokenAt?: number | null; checked: number } = {
    valid: null,
    checked: 0,
  };
  let stat: any = {};
  let totals: { sealed: number; with_ticket: number } = { sealed: 0, with_ticket: 0 };

  try {
    blocks = await recentRounds(6);
  } catch {
    blocks = [];
  }
  try {
    wins = await recentWins(12);
  } catch {
    wins = [];
  }
  try {
    totals = await chainTotals();
  } catch {
    totals = { sealed: 0, with_ticket: 0 };
  }
  try {
    const c: any = await verifyChain(200);
    chain = { valid: c?.valid ?? null, brokenAt: c?.brokenAt ?? null, checked: Number(c?.checked) || 0 };
  } catch {
    chain = { valid: null, checked: 0 };
  }
  try {
    stat = await stats();
  } catch {
    stat = {};
  }

  return (
    <LiveChain
      initialBlocks={blocks}
      initialWins={wins}
      initialChain={chain}
      confirmed={Number(stat?.events_by_status?.verified ?? 0)}
      students={Number(stat?.users ?? 0)}
      mined={totals.with_ticket}
    />
  );
}
