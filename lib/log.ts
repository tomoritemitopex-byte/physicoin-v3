type Entry = { at: string; method: string; path: string; status: number; message: string };

const RING: Entry[] = [];
const MAX = 200;

export function logEvent(e: { method: string; path: string; status: number; message: string }) {
  RING.push({ at: new Date().toISOString(), ...e });
  if (RING.length > MAX) RING.splice(0, RING.length - MAX);
}

export function getLogs(limit = 100): { logs: Entry[]; count: number; total: number } {
  const n = Math.min(Math.max(limit, 1), MAX);
  return { logs: RING.slice(-n).reverse(), count: Math.min(n, RING.length), total: RING.length };
}
