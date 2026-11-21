const DEFAULT_CLOAKED_URL = "https://<scrubbed-url-domain>";

export type CloakedHealth = {
  ok: boolean;
  reachable: boolean;
  status: number;
  data?: unknown;
  checkedAt: string;
};

export function cloakedBaseUrl(): string {
  const configured = process.env.CLOAKED_PHYSICOIN_URL || process.env.NEXT_PUBLIC_CLOAKED_PHYSICOIN_URL;
  return (configured || DEFAULT_CLOAKED_URL).replace(/\/$/, "");
}

export async function getCloakedHealth(): Promise<CloakedHealth> {
  const checkedAt = new Date().toISOString();
  try {
    const response = await fetch(`${cloakedBaseUrl()}/api/health`, {
      headers: { accept: "application/json", "user-agent": "physicoin-v3-bridge/1" },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    const text = await response.text();
    let data: unknown = text;
    try { data = JSON.parse(text); } catch {}
    return { ok: response.ok, reachable: true, status: response.status, data, checkedAt };
  } catch {
    return { ok: false, reachable: false, status: 0, checkedAt };
  }
}
