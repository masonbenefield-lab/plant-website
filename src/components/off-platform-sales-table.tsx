"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { centsToDisplay } from "@/lib/stripe";

type ManualSale = {
  id: string;
  plant_name: string;
  variety: string | null;
  price_cents: number;
  quantity: number;
  note: string | null;
  sold_at: string;
};

export default function OffPlatformSalesTable({ sales }: { sales: ManualSale[] }) {
  const router = useRouter();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    setDeletingId(id);
    const res = await fetch(`/api/manual-sales/${id}`, { method: "DELETE" });
    const data = await res.json();
    setDeletingId(null);
    setConfirmId(null);
    if (data.error) {
      toast.error(data.error);
      return;
    }
    toast.success("Sale deleted");
    router.refresh();
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-muted-foreground text-xs uppercase tracking-wide">
            <th className="px-4 py-3 text-left font-medium">Item</th>
            <th className="px-4 py-3 text-right font-medium">Qty</th>
            <th className="px-4 py-3 text-right font-medium">Revenue</th>
            <th className="px-4 py-3 text-left font-medium">Note</th>
            <th className="px-4 py-3 text-right font-medium">Date</th>
            <th className="px-4 py-3 text-right font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {sales.map((s) => (
            <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
              <td className="px-4 py-3 font-medium">{s.plant_name}{s.variety ? ` — ${s.variety}` : ""}</td>
              <td className="px-4 py-3 text-right text-muted-foreground">{s.quantity}</td>
              <td className="px-4 py-3 text-right font-semibold">{centsToDisplay(s.price_cents * s.quantity)}</td>
              <td className="px-4 py-3 text-muted-foreground">{s.note ?? "—"}</td>
              <td className="px-4 py-3 text-right text-muted-foreground whitespace-nowrap">
                {new Date(s.sold_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </td>
              <td className="px-4 py-3 text-right">
                {confirmId === s.id ? (
                  <span className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleDelete(s.id)}
                      disabled={deletingId === s.id}
                      className="text-xs text-destructive font-medium hover:underline disabled:opacity-50"
                    >
                      {deletingId === s.id ? "Deleting…" : "Confirm"}
                    </button>
                    <button
                      onClick={() => setConfirmId(null)}
                      className="text-xs text-muted-foreground hover:underline"
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={() => setConfirmId(s.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                    title="Delete sale"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
