// Racial slur blocklist for username and bio validation.
// Normalized before matching (leetspeak, punctuation stripped).

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
  "wop", "dago", "guinea", "greaseball", "mick", "polack", "kraut", "hymie",
  // General
  "whitey",
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
  const normalizedInput = normalize(text);
  // Also check original lowercased (for multi-word slurs with spaces)
  const lowered = text.toLowerCase();

  return SLURS.some((slur) => {
    const normalizedSlur = normalize(slur);
    return normalizedInput.includes(normalizedSlur) || lowered.includes(slur);
  });
}
