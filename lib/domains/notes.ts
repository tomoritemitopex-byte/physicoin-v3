import { getDb } from "@/lib/db";
import { DomainError } from "./users";

// Notes Drop: study photos shared per building. Feed shows blurred
// previews; 1 coin reveals (0.5 goes to the uploader).

export const UNLOCK_COST = 1;

export async function drop(input: {
  title: string;
  building_id?: string;
  level?: string;
  uploader_id?: string | null;
  lat?: number | null;
  lng?: number | null;
  image_data?: string;
  ocr_text?: string;
}) {
  if (!input.title) throw new DomainError("MISSING_FIELDS", "title is required.");
  const sql = getDb();
  const preview = String(input.ocr_text || "").slice(0, 60);
  const [n] = await sql`
    INSERT INTO physi_notes_drops (title, building_id, level, uploader_id, lat, lng, image_data, ocr_text, preview_blur)
    VALUES (${input.title}, ${input.building_id || "phys"}, ${input.level || "100L"},
      ${input.uploader_id || null}, ${input.lat ?? null}, ${input.lng ?? null},
      ${input.image_data || ""}, ${input.ocr_text || ""}, ${preview})
    RETURNING id, title, building_id, level, preview_blur, created_at`;
  return { ...n, cost: UNLOCK_COST };
}

export async function feed(input: { building_id?: string; level?: string; viewer_id?: string }) {
  const sql = getDb();
  const rows = await sql<
    {
      id: string; title: string; building_id: string; level: string;
      preview_blur: string; created_at: string; uploader_id: string | null;
      ocr_text: string; image_data: string;
    }[]
  >`
    SELECT n.id, n.title, n.building_id, n.level, n.preview_blur, n.created_at, n.uploader_id,
      CASE WHEN ${input.viewer_id || null}::text IS NULL THEN '' ELSE n.ocr_text END AS ocr_text,
      CASE WHEN ${input.viewer_id || null}::text IS NULL THEN '' ELSE n.image_data END AS image_data
    FROM physi_notes_drops n
    WHERE (${input.building_id || null}::text IS NULL OR n.building_id = ${input.building_id || null})
      AND (${input.level || null}::text IS NULL OR n.level = ${input.level || null})
    ORDER BY n.created_at DESC LIMIT 50`;
  if (!input.viewer_id) {
    return rows.map((r) => ({ ...r, ocr_text: "", image_data: "", unlocked: false }));
  }
  const unlocked = await sql<{ note_id: string }[]>`
    SELECT note_id FROM physi_notes_unlocks WHERE user_id = ${input.viewer_id}`;
  const set = new Set(unlocked.map((u) => u.note_id));
  return rows.map((r) => ({
    ...r,
    ocr_text: set.has(r.id) || r.uploader_id === input.viewer_id ? r.ocr_text : "",
    image_data: set.has(r.id) || r.uploader_id === input.viewer_id ? r.image_data : "",
    unlocked: set.has(r.id),
  }));
}

export async function unlock(input: { note_id: string; user_id: string }) {
  if (!input.note_id || !input.user_id) throw new DomainError("MISSING_FIELDS", "note_id and user_id are required.");
  const sql = getDb();
  const notes = await sql<{ uploader_id: string | null }[]>`
    SELECT uploader_id FROM physi_notes_drops WHERE id = ${input.note_id} LIMIT 1`;
  if (!notes[0]) throw new DomainError("NOT_FOUND", "Note not found.", 404);
  const users = await sql<{ mining_balance: string }[]>`
    SELECT mining_balance::text FROM physi_users WHERE id = ${input.user_id} LIMIT 1`;
  if (!users[0]) throw new DomainError("UNKNOWN_USER", "User not found.", 404);
  if (Number(users[0].mining_balance) < UNLOCK_COST) {
    throw new DomainError("INSUFFICIENT_COINS", "Need 1 $PHY to reveal this note.", 409);
  }
  await sql`UPDATE physi_users SET mining_balance = mining_balance - ${UNLOCK_COST} WHERE id = ${input.user_id}`;
  if (notes[0].uploader_id && notes[0].uploader_id !== input.user_id) {
    await sql`UPDATE physi_users SET mining_balance = LEAST(10000, mining_balance + 0.5) WHERE id = ${notes[0].uploader_id}`;
  }
  await sql`
    INSERT INTO physi_notes_unlocks (note_id, user_id, cost)
    VALUES (${input.note_id}, ${input.user_id}, ${UNLOCK_COST})
    ON CONFLICT (note_id, user_id) DO NOTHING`;
  const [full] = await sql`SELECT ocr_text, image_data FROM physi_notes_drops WHERE id = ${input.note_id} LIMIT 1`;
  return { unlocked: true, ...full };
}
