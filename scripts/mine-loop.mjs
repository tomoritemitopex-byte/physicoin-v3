import { readFileSync } from "fs";

// Always-on miner: grinds proofs back-to-back into the open round
// for one wallet. Run: node scripts/mine-loop.mjs
// Reads OWNER_WALLET_ID + SERVER_URL from environment (.env.local).
// Logs to stdout (redirect to logs/miner.log). Stop with Ctrl+C.

function env(name, fallback) {
  const line = (() => {
    try {
      const txt = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
      const m = txt.split("\n").find((l) => l.startsWith(name + "="));
      return m ? m.slice(name.length + 1).trim() : null;
    } catch {
      return null;
    }
  })();
  return process.env[name] || line || fallback;
}

const WALLET = env("OWNER_WALLET_ID", "");
const SERVER = (env("SERVER_URL", "http://localhost:3100") || "").replace(/\/$/, "");
const PAUSE_MS = Number(env("MINER_PAUSE_MS", "2000") || 2000);

if (!WALLET) {
  console.error("[miner] OWNER_WALLET_ID not set — refusing to run blind");
  process.exit(1);
}

console.log(`[miner] grinding for wallet ${WALLET} via ${SERVER}`);
const stamp = () => new Date().toISOString().slice(11, 19);

async function session() {
  const r = await fetch(`${SERVER}/api/auth/session`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ user_id: WALLET }),
  });
  const j = await r.json();
  if (!j.ok || !j.token) throw new Error("session failed: " + (j.message || r.status));
  return j.token;
}

let token = await session().catch((e) => {
  console.error("[miner] cannot authorize wallet:", e.message);
  process.exit(1);
});

let submitted = 0;
let best = 999;

for (;;) {
  try {
    // Round edge: never start a grind that can't finish before the flip.
    try {
      const rq = await fetch(`${SERVER}/api/mining?round=current`);
      const rj = await rq.json();
      if (rj.ok && typeof rj.ends_in_secs === "number" && rj.ends_in_secs < 15) {
        console.log(`[${stamp()}] round ${rj.round} closes in ${rj.ends_in_secs}s — waiting it out`);
        await new Promise((r2) => setTimeout(r2, (rj.ends_in_secs + 5) * 1000));
        continue;
      }
    } catch {}
    const r = await fetch(`${SERVER}/api/mining`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ user_id: WALLET }),
      signal: AbortSignal.timeout(150000),
    });
    const j = await r.json();
    if (j.code === "BAD_TOKEN" || j.code === "REVOKED" || j.code === "NO_TOKEN") {
      console.log(`[${stamp()}] session expired — re-authorizing`);
      token = await session();
      continue;
    }
    if (j.ok) {
      submitted++;
      const s = j.leader?.score;
      if (typeof s === "number" && s < best) best = s;
      console.log(
        `[${stamp()}] #${submitted} round ${j.round} in · leader score ${s ?? "?"} · best seen ${best}`
      );
    } else {
      console.log(`[${stamp()}] rejected: ${j.code || "?"} ${j.message || ""}`);
      await new Promise((r2) => setTimeout(r2, 15000));
    }
  } catch (e) {
    console.log(`[${stamp()}] error: ${String(e?.message || e).slice(0, 120)} — retrying`);
    await new Promise((r2) => setTimeout(r2, 15000));
  }
  await new Promise((r2) => setTimeout(r2, PAUSE_MS));
}
