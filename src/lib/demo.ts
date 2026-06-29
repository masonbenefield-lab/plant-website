// ── Demo mode ────────────────────────────────────────────────────────────────
// Powers the logged-out interactive product demo at /demo. The Garden, Community,
// and Wishlist tabs render REAL public data from a curated demo account (so they
// stay in sync with the live product and never show invented stats). The Care
// tab renders the fixed dataset below so the "due today / overdue" story is always
// compelling — real account data would drift to all-green over time.
//
// SETUP (one-time, manual): create a normal account, set its username to
// DEMO_GARDEN_USERNAME, add ~10 plants with photos, and turn ON both
// "public garden" and "public wishlist". The demo tabs read from that account.

/** Username of the curated public account that backs the demo's data tabs. */
export const DEMO_GARDEN_USERNAME = "demo";

/** Display name shown in the demo header (the demo account's real display name
 *  is used when available; this is only a fallback). */
export const DEMO_DISPLAY_NAME = "Demo Garden";

// ── Fixed Care Schedule dataset ───────────────────────────────────────────────
// daysUntilDue: negative = overdue, 0 = due today, positive = upcoming. These are
// relative offsets so the demo always shows the same "2 due today · 1 overdue"
// stakes no matter what day it's viewed.

export type DemoCareTask = {
  id: string;
  plantName: string;
  /** Public plant image URL, or null to render the 🌿 emoji fallback. */
  image: string | null;
  location: string | null;
  /** "Water" | "Fertilize" | "Repot" | "Prune", or any custom label (isCustom). */
  careType: string;
  /** True for user-defined care tags (e.g. Mist, Rotate) — rendered with the custom style. */
  isCustom?: boolean;
  /** Days from today: <0 overdue, 0 due today, >0 upcoming. */
  daysUntilDue: number;
  /** How often this task recurs, in days (drives the week-strip projection). */
  interval: number;
};

// Mirrors the real plants in the demo account (same names + locations) so the
// Care Schedule and My Garden tabs read as one cohesive garden. A spread of care
// types shows the full feature; Today carries a mix (water, fertilize, prune,
// custom) with prune + repot + a second custom tag across the week.
export const DEMO_CARE_TASKS: DemoCareTask[] = [
  // ── Today: overdue ──
  { id: "d1", plantName: "Peters Honey Fig",   image: null, location: "Front Yard",   careType: "Water",     daysUntilDue: -2, interval: 7   },
  { id: "d2", plantName: "Arctic Frost Satsuma", image: null, location: "Ranch Orchard", careType: "Fertilize", daysUntilDue: -1, interval: 30 },
  // ── Today: due today ──
  { id: "d3", plantName: "Blue Java Banana",   image: null, location: "Ranch",        careType: "Water",     daysUntilDue: 0,  interval: 7   },
  { id: "d4", plantName: "Variegated Pothos",  image: null, location: "Bathroom",     careType: "Mist",      daysUntilDue: 0,  interval: 7, isCustom: true },
  { id: "d5", plantName: "Texas Peach",        image: null, location: "Backyard",     careType: "Prune",     daysUntilDue: 0,  interval: 90  },
  // ── Upcoming this week ──
  { id: "d6", plantName: "Variegated Pothos",  image: null, location: "Bathroom",     careType: "Repot",     daysUntilDue: 2,  interval: 365 },
  { id: "d7", plantName: "Blue Java Banana",   image: null, location: "Ranch",        careType: "Fertilize", daysUntilDue: 3,  interval: 30  },
  { id: "d8", plantName: "Arctic Frost Satsuma", image: null, location: "Ranch Orchard", careType: "Water",  daysUntilDue: 4,  interval: 7   },
  { id: "d9", plantName: "Texas Peach",        image: null, location: "Backyard",     careType: "Pest check", daysUntilDue: 5, interval: 21, isCustom: true },
];

/** Stat strip shown above the demo care schedule. */
export const DEMO_CARE_STREAK_DAYS = 12;
export const DEMO_CARE_LOGGED_30 = 28;
