// Single source of truth for username rules.
//
// Two different paths create a profile row and they MUST agree on what a legal
// username is, or a person gets accepted by one and rejected by the other:
//   • email + password signup → the `handle_new_user` DB trigger, which reads
//     the username out of the signup metadata (see migration 029)
//   • Google / Apple sign-in  → /api/auth/complete-profile
//
// Before migration 029 only the OAuth path validated anything, so the email path
// let usernames like "tmom'sshop" and "helenmyork@yahoo.com" into the table —
// they become storefront URLs. The regex below is mirrored inside the trigger;
// if you change one, change both.

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;
export const USERNAME_RE = /^[a-z0-9._-]+$/;

/** What the input fields do on every keystroke — lowercase, no whitespace. */
export function normalizeUsername(raw: string): string {
  return raw.toLowerCase().replace(/\s+/g, "");
}

/** Returns null when the username is legal, or a user-facing reason when not. */
export function validateUsernameFormat(username: string): string | null {
  if (!username) return "Pick a username.";
  if (username.length < USERNAME_MIN) {
    return `Username must be at least ${USERNAME_MIN} characters.`;
  }
  if (username.length > USERNAME_MAX) {
    return `Username must be ${USERNAME_MAX} characters or fewer.`;
  }
  if (!USERNAME_RE.test(username)) {
    return "Username can only use lowercase letters, numbers, periods, hyphens, and underscores.";
  }
  return null;
}
