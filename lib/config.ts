// Canonical addresses. The public server URL lives HERE so every
// machine, agent, and script reads the same truth from the repo.
export const PUBLIC_SERVER_URL = "https://physicoin-v3.vercel.app";

export function serverUrl(): string {
  const env = (process.env.SERVER_URL || "").replace(/\/$/, "");
  if (env) return env;
  if (typeof window !== "undefined") return window.location.origin;
  return PUBLIC_SERVER_URL;
}
