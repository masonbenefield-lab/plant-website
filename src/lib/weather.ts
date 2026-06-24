// Geocoding + forecast helpers for frost alerts. Both use free, no-key APIs.

/** US ZIP -> {lat,lng} via zippopotam.us. Returns null on bad zip / failure. */
export async function geocodeUsZip(zip: string): Promise<{ lat: number; lng: number } | null> {
  const clean = zip.trim();
  if (!/^\d{5}$/.test(clean)) return null;
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${clean}`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    const place = data?.places?.[0];
    if (!place) return null;
    const lat = parseFloat(place.latitude);
    const lng = parseFloat(place.longitude);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

/**
 * Forecast overnight low (°F) for tonight via Open-Meteo. Uses tomorrow's daily
 * minimum, which is the relevant pre-dawn low when checked in the evening.
 * Returns null on failure.
 */
export async function getOvernightLowF(lat: number, lng: number): Promise<number | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      `&daily=temperature_2m_min&temperature_unit=fahrenheit&timezone=auto&forecast_days=2`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    const mins = data?.daily?.temperature_2m_min;
    if (!Array.isArray(mins)) return null;
    const tonight = typeof mins[1] === "number" ? mins[1]
      : (typeof mins[0] === "number" ? mins[0] : null);
    return tonight;
  } catch {
    return null;
  }
}
