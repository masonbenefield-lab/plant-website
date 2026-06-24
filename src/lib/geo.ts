/**
 * Country gate for account creation. Plantet is US-only.
 *
 * Enforcement is fail-closed — anything that isn't an allowed country, INCLUDING
 * an unknown/missing country, is blocked — but only in production, where Vercel
 * populates the geo header. In dev/preview the header is absent, so we allow it
 * through rather than locking out local work.
 */
export const ALLOWED_COUNTRIES = new Set(["US"]);

/** Country (ISO-3166 alpha-2) Vercel resolved for the request, or null. */
export function geoCountry(headers: Headers): string | null {
  return headers.get("x-vercel-ip-country");
}

export function isGeoAllowed(country: string | null): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  return !!country && ALLOWED_COUNTRIES.has(country);
}
