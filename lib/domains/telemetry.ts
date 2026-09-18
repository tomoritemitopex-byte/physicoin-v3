import { getDb, isDbConfigured } from "@/lib/db";

function maxScoreForOrder(n: number): number {
  return 4 * n * (n - 1) + n * n - 1;
}
function barCap(order: number): number {
  return Math.max(8, Math.floor(maxScoreForOrder(order) / 6));
}

export type TeleRound = {
  round: number;
  tx_count: number;
  subs: number;
  bar: number;
  difficulty: number;
  barCap: number;
  lattice_order: number;
  winning_score: number | null;
  winning_ticket: string | null;
  ticket_prefix: string | null;
  prev_hash: string | null;
  tx_root: string | null;
  status: string;
};

export type TeleFlags = {
  SATURATED: boolean;
  BAR_MAX: boolean;
  LATTICE_STALL: boolean;
  detail: {
    saturatedWindow: number[] | null;
    barMaxRounds: number[];
    stallReason: string | null;
  };
};

export async function getTelemetry(limit = 20): Promise<{
  recentRounds: TeleRound[];
  rounds: TeleRound[];
  subsCounts: Record<number, number>;
  flags: TeleFlags;
}> {
  const n = Math.min(Math.max(limit, 1), 50);
  if (!isDbConfigured()) {
    return {
      recentRounds: [],
      rounds: [],
      subsCounts: {},
      flags: {
        SATURATED: false,
        BAR_MAX: false,
        LATTICE_STALL: false,
        detail: { saturatedWindow: null, barMaxRounds: [], stallReason: null },
      },
    };
  }
  try {
    const sql = getDb();
    const rows = await sql<
      {
        number: number;
        status: string;
        winning_score: number | null;
        winning_ticket: string | null;
        prev_hash: string | null;
        tx_root: string | null;
        tx_count: number;
        lattice_order: number;
        difficulty: number;
      }[]
    >`
      SELECT number, status, winning_score, winning_ticket, prev_hash, tx_root, tx_count, lattice_order, difficulty
      FROM physi_rounds ORDER BY number DESC LIMIT ${n}
    `;
    // subs per round
    const subsCounts: Record<number, number> = {};
    if (rows.length) {
      const nums = rows.map((r) => r.number);
      const subs = await sql<{ round_number: number; c: number }[]>`
        SELECT round_number, count(*)::int AS c FROM physi_round_proofs
        WHERE round_number IN (SELECT unnest(${nums}::int[])) GROUP BY round_number
      `;
      for (const s of subs) subsCounts[s.round_number] = s.c;
    }
    // map to TeleRound ascending for window checks but keep desc for display? Provide desc order for UI (newest first)
    const desc: TeleRound[] = rows.map((r) => {
      const cap = barCap(r.lattice_order);
      const bar = Math.min(r.difficulty, cap);
      const tp = r.winning_ticket ? r.winning_ticket.slice(0, 8).toLowerCase() : null;
      return {
        round: r.number,
        tx_count: r.tx_count ?? 0,
        subs: subsCounts[r.number] ?? 0,
        bar,
        difficulty: r.difficulty,
        barCap: cap,
        lattice_order: r.lattice_order,
        winning_score: r.winning_score,
        winning_ticket: r.winning_ticket,
        ticket_prefix: tp,
        prev_hash: r.prev_hash,
        tx_root: r.tx_root,
        status: r.status,
      };
    });
    // for flag computation need ascending (chronological)
    const asc = [...desc].sort((a, b) => a.round - b.round);

    // SATURATED: 3 consecutive rounds tx_count==0 while subs>0
    let saturatedWindow: number[] | null = null;
    let SATURATED = false;
    for (let i = 0; i + 2 < asc.length; i++) {
      const w = asc.slice(i, i + 3);
      // must be consecutive numbers
      if (w[1].round !== w[0].round + 1 || w[2].round !== w[1].round + 1) continue;
      if (w.every((r) => r.tx_count === 0 && r.subs > 0)) {
        SATURATED = true;
        saturatedWindow = w.map((r) => r.round);
        break;
      }
    }

    // BAR_MAX: any round where bar == barCap (bar hits cap)
    const barMaxRounds: number[] = desc.filter((r) => r.bar >= r.barCap).map((r) => r.round);
    const BAR_MAX = barMaxRounds.length > 0;

    // LATTICE_STALL: wins flatline
    // - lattice_order unchanged for last 6 rounds (or all if fewer)
    // - OR winning_score identical for last 5 closed rounds with non-null scores
    let stallReason: string | null = null;
    let LATTICE_STALL = false;
    const closed = asc.filter((r) => r.status === "closed");
    if (closed.length >= 5) {
      const last6 = closed.slice(-6);
      const orders = new Set(last6.map((r) => r.lattice_order));
      if (orders.size === 1 && last6.length >= 5) {
        LATTICE_STALL = true;
        stallReason = `order ${last6[0].lattice_order} flat ${last6.length} rounds`;
      }
      if (!LATTICE_STALL) {
        const last5 = closed.slice(-5).filter((r) => r.winning_score !== null);
        if (last5.length >= 5) {
          const first = last5[0].winning_score;
          if (last5.every((r) => r.winning_score === first)) {
            LATTICE_STALL = true;
            stallReason = `score ${first} flat ${last5.length} rounds`;
          }
        }
      }
      // also check if no order growth over window implies stall
      if (!LATTICE_STALL) {
        const last8 = closed.slice(-8);
        if (last8.length >= 6) {
          const uniq = new Set(last8.map((r) => r.lattice_order));
          if (uniq.size === 1) {
            LATTICE_STALL = true;
            stallReason = `lattice stall ${last8[0].lattice_order}×${last8.length}`;
          }
        }
      }
    }

    const flags: TeleFlags = {
      SATURATED,
      BAR_MAX,
      LATTICE_STALL,
      detail: { saturatedWindow, barMaxRounds, stallReason },
    };
    return { recentRounds: desc, rounds: desc, subsCounts, flags };
  } catch {
    // graceful degradation for builds without DB / missing tables
    return {
      recentRounds: [],
      rounds: [],
      subsCounts: {},
      flags: {
        SATURATED: false,
        BAR_MAX: false,
        LATTICE_STALL: false,
        detail: { saturatedWindow: null, barMaxRounds: [], stallReason: null },
      },
    };
  }
}
