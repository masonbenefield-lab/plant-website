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
  careType: "Water" | "Fertilize" | "Repot" | "Prune";
  /** Days from today: <0 overdue, 0 due today, >0 upcoming. */
  daysUntilDue: number;
  /** How often this task recurs, in days (drives the week-strip projection). */
  interval: number;
};

export const DEMO_CARE_TASKS: DemoCareTask[] = [
  { id: "d1", plantName: "Monstera Deliciosa", image: null, location: "Living room",  careType: "Water",     daysUntilDue: -2, interval: 7  },
  { id: "d2", plantName: "Fiddle Leaf Fig",    image: null, location: "Office",       careType: "Water",     daysUntilDue: 0,  interval: 7  },
  { id: "d3", plantName: "Snake Plant",        image: null, location: "Bedroom",      careType: "Water",     daysUntilDue: 0,  interval: 14 },
  { id: "d4", plantName: "Pothos 'Golden'",    image: null, location: "Kitchen",      careType: "Fertilize", daysUntilDue: 2,  interval: 30 },
  { id: "d5", plantName: "Calathea Orbifolia", image: null, location: "Bathroom",     careType: "Water",     daysUntilDue: 3,  interval: 5  },
  { id: "d6", plantName: "ZZ Plant",           image: null, location: "Entryway",     careType: "Prune",     daysUntilDue: 5,  interval: 90 },
];

/** Stat strip shown above the demo care schedule. */
export const DEMO_CARE_STREAK_DAYS = 12;
export const DEMO_CARE_LOGGED_30 = 28;
