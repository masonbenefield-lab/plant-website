"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export function OrdersBadge({ initial }: { initial: number }) {
  const [count, setCount] = useState(initial);
  const pathname = usePathname();

  useEffect(() => {
    fetch("/api/orders/pending-count")
      .then((r) => r.json())
      .then((d) => setCount((d.buyerPending ?? 0) + (d.sellerPending ?? 0)))
      .catch(() => {});
  }, [pathname]);

  if (count <= 0) return null;
  return (
    <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-leaf text-white text-[9px] font-bold flex items-center justify-center">
      {count > 9 ? "9+" : count}
    </span>
  );
}
