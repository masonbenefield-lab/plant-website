"use client";

import { useEffect } from "react";

/**
 * Fires a single lightweight ping per browser session so the server can record a
 * hashed-IP auth event for the logged-in user. Mounted only for authenticated
 * users (see RootLayout). The sessionStorage guard keeps it to one call per tab
 * session rather than one per navigation.
 */
export default function SessionTracker() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem("ae_tracked")) return;
      sessionStorage.setItem("ae_tracked", "1");
    } catch {
      // sessionStorage blocked (private mode, etc.) — still attempt the ping
    }
    fetch("/api/track-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "session" }),
      keepalive: true,
    }).catch(() => {});
  }, []);

  return null;
}
