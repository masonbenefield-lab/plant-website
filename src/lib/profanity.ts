// Prohibited word list: racial slurs + explicit sexual content.
// Normalized before matching (leetspeak, punctuation stripped).
// Avoid adding words with common legitimate plant uses (e.g. bare "cock", "pussy").

const SLURS: string[] = [
  // Anti-Black
  "nigger", "nigga", "niggah", "nig", "coon", "spook", "sambo", "jigaboo",
  "darkie", "darky", "porch monkey", "porchmoney", "jungle bunny", "junglebunny",
  "pickaninny", "spade", "bootlip",
  // Anti-Hispanic / Latino
  "spic", "spick", "wetback", "beaner", "greaser",
  // Anti-Asian
  "chink", "gook", "jap", "slant", "slope", "zipperhead", "chankoro",
  "dink", "nip", "chinky",
  // Anti-Jewish
  "kike", "hymie", "heeb", "yid",
  // Anti-South Asian / Middle Eastern
  "paki", "towelhead", "raghead", "sandnigger", "sand nigger", "camel jockey",
  "cameljockey",
  // Anti-Indigenous
  "redskin", "injun", "squaw",
  // Anti-white (included for symmetry)
  "cracker", "honky", "honkey", "peckerwood",
  // Anti-Italian / other European ethnic
  "wop", "dago", "guinea", "greaseball", "mick", "polack", "kraut",
  // General slurs
  "whitey",

  // Explicit sexual content
  "fuck", "fucker", "fucked", "fucking", "fuckhead", "motherfucker", "motherfucking",
  "cunt",
  "whore", "slut",
  "bitch",
  "porn", "porno", "pornography",
  "blowjob", "blow job",
  "handjob", "hand job",
  "cumshot", "cum shot",
  "jizz",
  "dickhead", "asshole", "arsehole",
  "shit", "shits", "shitty", "shitting", "shithead", "bullshit", "dipshit",
  "piss", "pissed", "pissing",
  "dumbass",
].filter(Boolean).map((s) => s.toLowerCase());

function normalize(text: string): string {
  return text
    .toLowerCase()
    // common leetspeak substitutions
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/@/g, "a")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/\$/g, "s")
    .replace(/8/g, "b")
    .replace(/7/g, "t")
    .replace(/6/g, "g")
    // strip all non-alpha so "n.i.g.g.e.r" and "n-i-g-g-e-r" match
    .replace(/[^a-z]/g, "");
}

export function containsSlur(text: string): boolean {
  return findProhibitedWord(text) !== null;
}

/** Returns the matched slur from our list, or null if clean. */
export function findProhibitedWord(text: string): string | null {
  const lowered = text.toLowerCase();
  // Split into individual tokens so "flesh. It" doesn't collapse into "fleshit"
  const tokens = text.split(/\s+/);

  for (const slur of SLURS) {
    // Multi-word slurs (e.g. "sand nigger"): match directly in lowered text
    if (slur.includes(" ")) {
      if (lowered.includes(slur)) return slur;
      continue;
    }
    // Single-word slurs: check each token after normalizing for leetspeak/punctuation
    // This catches "n-i-g-g-e-r" or "f.u.c.k" while preserving word boundaries
    const normalizedSlur = normalize(slur);
    for (const token of tokens) {
      if (normalize(token).includes(normalizedSlur)) return slur;
    }
  }
  return null;
}

function censorToken(word: string): string {
  if (word.length <= 2) return word[0] + "*".repeat(word.length - 1);
  if (word.length === 3) return word[0] + "*" + word[2];
  return word[0] + "*".repeat(word.length - 2) + word[word.length - 1];
}

/** Returns a display-safe censored form, e.g. "n****r" or "p****h m****y". */
export function censorWord(word: string): string {
  return word.split(" ").map(censorToken).join(" ");
}

/** Fire-and-forget: log a violation to the server without blocking the UI. */
export function logViolation(word: string, context: string, snippet?: string): void {
  fetch("/api/violations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ word, context, snippet: snippet?.slice(0, 120) }),
  }).catch(() => {});
}
