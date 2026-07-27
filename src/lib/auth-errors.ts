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
