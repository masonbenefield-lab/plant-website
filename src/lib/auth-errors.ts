// Maps raw auth errors (from Supabase / an OAuth provider like Apple or Google)
// to a small set of stable codes the /login page knows how to explain.
//
// Why this exists: OAuth failures come back to /auth/callback as `?error=...`
// query params with NO `code`, and code/token exchanges can also fail. Without
// classification, every one of these fell through to a single generic
// "Confirmation link expired or already used" message — which badly misleads a
// brand-new user whose Apple sign-in was rejected because their email already
// belongs to another account.

export type AuthErrorCode =
  | "account_exists" // email/identity already tied to another account (collision)
  | "auth_callback_failed" // expired/used email-confirmation or magic link
  | "oauth_failed"; // anything else that went wrong during sign-in

export function classifyAuthError(
  code: string | null | undefined,
  description: string | null | undefined
): AuthErrorCode {
  const text = `${code ?? ""} ${description ?? ""}`.toLowerCase();

  // Collision: the account (or its email/identity) already exists. Covers
  // Supabase codes like identity_already_exists / email_exists / user_already_exists
  // and human-readable variants ("... is already registered", "already linked").
  if (
    text.includes("already") ||
    text.includes("identity_already_exists") ||
    text.includes("email_exists") ||
    text.includes("user_already")
  ) {
    return "account_exists";
  }

  // Expired / invalid one-time link (email confirmation, magic link, recovery).
  // Keep these on the existing code so the "resend confirmation" UI still shows.
  if (
    text.includes("expired") ||
    text.includes("invalid") ||
    text.includes("otp") ||
    text.includes("not found")
  ) {
    return "auth_callback_failed";
  }

  return "oauth_failed";
}

/**
 * Turns a raw GoTrue signUp error into something the person can act on.
 *
 * The case that matters is "Database error saving new user". That is what a
 * duplicate username looked like before migration 029 fixed the profile trigger,
 * and it's what any future trigger failure will look like too. Rendering it
 * verbatim (which the signup form used to do) told people nothing about the
 * actual problem, so they had no way to get past it.
 */
export function friendlySignupError(message: string | null | undefined): string {
  const text = (message ?? "").toLowerCase();

  if (text.includes("database error")) {
    return "We couldn't create your account with that username — it may already be taken. Try a different one.";
  }
  if (text.includes("already registered") || text.includes("already exists")) {
    return "An account with this email already exists. Sign in instead.";
  }
  if (text.includes("rate limit") || text.includes("too many")) {
    return "Too many signup attempts — wait a minute and try again.";
  }

  return message || "Something went wrong creating your account. Please try again.";
}
