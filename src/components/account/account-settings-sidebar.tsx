"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { id: "profile", label: "Profile" },
  { id: "email-preferences", label: "Email Preferences" },
  { id: "email-address", label: "Email Address" },
  { id: "password", label: "Password" },
  { id: "seller-payments", label: "Seller Payments" },
  { id: "shipping-settings", label: "Shipping Settings" },
  { id: "plan-billing", label: "Plan & Billing" },
  { id: "bidding", label: "Bidding" },
  { id: "blocked-users", label: "Blocked Users" },
  { id: "danger-zone", label: "Danger Zone" },
];

export default function AccountSettingsSidebar() {
  const [active, setActive] = useState("profile");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) setActive(visible[0].target.id);
      },
      { rootMargin: "-10% 0px -50% 0px", threshold: 0 }
    );

    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <>
      {/* Mobile: horizontal pill nav */}
      <div className="lg:hidden w-full overflow-x-auto pb-1 mb-6 border-b">
        <ul className="flex gap-1.5 whitespace-nowrap pb-3">
          {SECTIONS.map(({ id, label }) => (
            <li key={id}>
              <a
                href={`#${id}`}
                className={cn(
                  "inline-block px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                  active === id
                    ? "bg-[#EBF0E6] text-forest dark:bg-forest/20 dark:text-[#A8BF9A]"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
      </div>

      {/* Desktop: sticky vertical sidebar */}
      <nav className="hidden lg:block w-52 shrink-0 sticky top-24 self-start">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-3 mb-2">
          Settings
        </p>
        <ul className="space-y-0.5">
          {SECTIONS.map(({ id, label }) => (
            <li key={id}>
              <a
                href={`#${id}`}
                className={cn(
                  "block px-3 py-2 rounded-lg text-sm transition-colors",
                  active === id
                    ? "bg-[#EBF0E6] text-forest font-medium dark:bg-forest/20 dark:text-[#A8BF9A]"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
