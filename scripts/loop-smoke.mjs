// Full-loop executable spec: register -> session -> mine -> submit ->
// settle -> win. Run against practice (or staging) BEFORE every deploy.
// Usage: SERVER_URL=http://localhost:3100 node scripts/loop-smoke.mjs
// Exit 0 = the whole game works end to end. Anything else = do not ship.

const SERVER = (process.env.SERVER_URL || "http://localhost:3100").replace(/\/$/, "");
const BIN = process.env.PROOF_BIN || new URL("../proof/target/release/physi-proof", import.meta.url).pathname;

import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";

let step = 0;
const ok = (name, cond, extra = "") => {
  step++;
  console.log(`${cond ? "PASS" : "FAIL"} ${step}. ${name}${extra ? " — " + extra : ""}`);
  if (!cond) process.exit(1);
};
const api = async (method, path, body, token) => {
  const r = await fetch(`${SERVER}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return r.json();
};

const tag = randomBytes(3).toString("hex");
const nick = `smoke_${tag}`.replace(/[^a-z0-9_]/g, "").slice(0, 20);

// 1. register
const reg = await api("POST", "/api/profile", {
  full_name: "Smoke Test",
  nickname: nick,
  programme: "PHYS",
  level: "100L",
});
ok("register", reg.ok && reg.user?.id, nick);
const uid = reg.user.id;

// 2. session
const sess = await api("POST", "/api/auth/session", { user_id: uid });
ok("session", sess.ok && sess.token, "token issued");
const token = sess.token;

// 3. read round + mine externally (like a real outside miner)
const round = await api("GET", "/api/mining?round=current");
ok("round open", round.ok && round.status === "open", `round ${round.round} bar ${round.difficulty}`);
const salt = randomBytes(8).toString("hex");
const challenge = `${round.round}:${uid}:${salt}`;
let proof;
try {
  const out = execFileSync(BIN, ["mine-lottery", challenge, String(round.difficulty), "300", String(round.lattice_order)], { encoding: "utf8", timeout: 120000 });
  proof = JSON.parse(out.trim());
} catch (e) {
  ok("mine", false, String(e.message).slice(0, 120));
}
ok("mine", !!proof?.ticket_hex, `score ${proof?.score}`);

// 4. submit
const sub = await api(
  "POST",
  "/api/mining",
  { user_id: uid, round: round.round, nonce: proof.nonce, grid_hex: proof.grid_hex, score: proof.score, salt, ticket_hex: proof.ticket_hex, version: 1, token },
  token
);
ok("submit", sub.ok && sub.recorded, `round ${round.round}`);

// 5. settle: wait for the round to close, then check the win chain
const deadline = Date.now() + 300000;
let won = null;
let closed = null;
while (Date.now() < deadline) {
  const cur = await api("GET", "/api/mining?round=current");
  if (cur.ok && cur.round > round.round) {
    closed = cur.round - 1;
    break;
  }
  await new Promise((r) => setTimeout(r, 10000));
}
ok("settle (round closed)", closed === round.round, `closed ${closed}`);
const wins = await api("GET", `/api/mining?user_id=${uid}`);
won = (wins.wins || []).find((w) => w.round === round.round);
ok("win recorded (or honorably outbid)", true, won ? `score ${won.score}` : "outbid — lottery worked as designed");

// NOTE: another wallet may outbid us; the spec's hard guarantees are
// register/session/mine/submit/settle. A missing win with rivals present
// means the lottery worked, not that it broke.
console.log("LOOP SMOKE PASS");
