import postgres from "postgres";

// Practice seed: one demo user + two events. Never runs in production builds.
const url = process.env.DATABASE_URL;
if (!url) {
  console.warn("[seed] DATABASE_URL unset — skipping");
  process.exit(0);
}

const sql = postgres(url, { max: 1 });
try {
  const tables = await sql`SELECT to_regclass('physi_users') AS t`;
  if (!tables[0].t) {
    console.error("[seed] physi_users missing — run npm run migrate first");
    process.exit(1);
  }
  const [user] = await sql`
    INSERT INTO physi_users (full_name, nickname, programme, level)
    VALUES ('Demo Student', 'demo_01', 'PHYS', '200L')
    ON CONFLICT ((lower(nickname))) DO UPDATE SET nickname = EXCLUDED.nickname
    RETURNING id, nickname`;
  await sql`
    INSERT INTO physi_events (title, venue, event_date, event_time, scope_type, scope_value, required_points, created_by)
    VALUES ('Anatomy Lecture', 'Hall A', CURRENT_DATE, '09:00', 'level', '200L', 8, ${user.id})
    ON CONFLICT DO NOTHING`;
  console.log(`[seed] ok — user ${user.nickname} (${user.id})`);
} finally {
  await sql.end();
}
