import { createHmac } from "crypto";

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function clientIp(headers: Headers): string | null {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim() || null;
  return headers.get("x-real-ip");
}

/**
 * Keyed (HMAC-SHA256) hash of an IP. The secret pepper makes it non-reversible,
 * while the same IP always maps to the same hash — so we can match accounts that
 * share an IP without ever storing the raw address. Returns null if the IP or the
 * IP_HASH_SECRET env var is missing (capture still works, just without linkage).
 */
export function hashIp(ip: string | null): string | null {
  const secret = process.env.IP_HASH_SECRET;
  if (!ip || !secret) return null;
  return createHmac("sha256", secret).update(ip).digest("hex");
}
