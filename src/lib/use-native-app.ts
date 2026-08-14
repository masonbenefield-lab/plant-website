"use client";

import { useEffect, useState } from "react";

/**
 * True when running inside the Capacitor iOS/Android shell, false on the web.
 *
 * Starts false and flips after mount, so anything gated on it renders web-first
 * and never causes a hydration mismatch.
 */
export function useIsNativeApp(): boolean {
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    let cancelled = false;
    import("@capacitor/core")
      .then(({ Capacitor }) => {
        if (!cancelled) setIsNative(Capacitor.isNativePlatform());
      })
      .catch(() => {
        // Not in the app shell — stays false.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return isNative;
}

/** Set when someone taps "Browse without signing in" on the login screen. */
export const GUEST_BROWSE_KEY = "plantet:browsing-as-guest";
