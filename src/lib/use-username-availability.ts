"use client";

import { useEffect, useState } from "react";
import { USERNAME_MIN, validateUsernameFormat } from "@/lib/username";

export type UsernameStatus =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "available" }
  | { state: "unavailable"; message: string };

/**
 * Debounced "is this username free?" check for the two signup forms.
 *
 * Deliberately fails open: if the lookup errors, is rate limited, or is still in
 * flight, the status goes back to `idle` and the submit button stays enabled.
 * The server is the authority either way — this only exists so people find out
 * about a collision while typing instead of after submitting.
 */
export function useUsernameAvailability(username: string): UsernameStatus {
  const [status, setStatus] = useState<UsernameStatus>({ state: "idle" });

  useEffect(() => {
    if (!username) {
      setStatus({ state: "idle" });
      return;
    }

    const formatError = validateUsernameFormat(username);
    if (formatError) {
      // Stay quiet while they're still typing up to the minimum length —
      // flashing "too short" at 1 character is just noise.
      setStatus(
        username.length < USERNAME_MIN
          ? { state: "idle" }
          : { state: "unavailable", message: formatError }
      );
      return;
    }

    setStatus({ state: "checking" });

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/auth/check-username?username=${encodeURIComponent(username)}`
        );
        const data = await res.json();
        if (cancelled) return;
        if (data.available === true) {
          setStatus({ state: "available" });
        } else if (data.available === false) {
          setStatus({
            state: "unavailable",
            message: data.error ?? "That username is already taken.",
          });
        } else {
          setStatus({ state: "idle" });
        }
      } catch {
        if (!cancelled) setStatus({ state: "idle" });
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [username]);

  return status;
}
