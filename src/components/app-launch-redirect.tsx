"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { GUEST_BROWSE_KEY } from "@/lib/use-native-app";

/**
 * The iOS/Android shell loads the site at "/", which is the marketing home page
 * — a confusing launch screen for someone who isn't signed in yet. Send those
 * launches to /login instead.
 *
 * Deliberately narrow:
 *   • web is untouched — no-op unless Capacitor reports a native platform
 *   • only fires on "/", so push-notification taps and shared listing links
 *     still land exactly where they point
 *   • signed-in users are left alone; home is a fine place for them to land
 *   • "Browse without signing in" sets a flag that suppresses it for the rest
 *     of the app session, otherwise backing out of login would bounce straight
 *     back to login
 */
export function AppLaunchRedirect() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/") return;

    let cancelled = false;

    (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform()) return;

        if (sessionStorage.getItem(GUEST_BROWSE_KEY) === "1") return;

        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!cancelled && !session) router.replace("/login");
      } catch {
        // Capacitor absent (web) or storage unavailable — leave the page alone.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  return null;
}
