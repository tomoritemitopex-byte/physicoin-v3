export type Building = { id: string; code: string; label: string; color: string; icon: string };

export const BUILDINGS: Building[] = [
  { id: "anat", code: "ANAT", label: "Anatomy", color: "#d97706", icon: "🦴" },
  { id: "phys", code: "PHYSIOL", label: "Physiology", color: "#2563eb", icon: "❤️" },
  { id: "biochem", code: "BIOCHEM", label: "Biochemistry", color: "#16a34a", icon: "🧪" },
  { id: "mbbs", code: "MBBS", label: "Medicine & Surgery", color: "#b91c1c", icon: "🩺" },
  { id: "pharm", code: "PHARM", label: "Pharmacology", color: "#9333ea", icon: "💊" },
  { id: "commed", code: "COMM MED", label: "Community Medicine", color: "#0891b2", icon: "🏥" },
  { id: "nursing", code: "NURS", label: "Nursing Science", color: "#db2777", icon: "🩹" },
  { id: "lab", code: "BMLS", label: "Medical Lab Science", color: "#ea580c", icon: "🔬" },
];

export const LEVELS = ["100L", "200L", "300L", "400L", "500L", "600L"];

/** Serpentine node positions (percent coords, viewBox 0 0 100 1000). */
export const NODE_POSITIONS: Record<string, { x: number; y: number }> = {
  anat: { x: 14, y: 120 },
  phys: { x: 50, y: 200 },
  biochem: { x: 86, y: 320 },
  mbbs: { x: 50, y: 440 },
  pharm: { x: 14, y: 560 },
  commed: { x: 86, y: 680 },
  nursing: { x: 50, y: 800 },
  lab: { x: 14, y: 920 },
};

export function roadPath(): string {
  const pts = BUILDINGS.map((b) => NODE_POSITIONS[b.id])
    .filter(Boolean)
    .sort((a, b) => a.y - b.y);
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const cur = pts[i];
    const cpx = (prev.x + cur.x) / 2;
    d += ` C ${cpx} ${prev.y}, ${cpx} ${cur.y}, ${cur.x} ${cur.y}`;
  }
  return d;
}
