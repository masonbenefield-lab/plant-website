"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import * as XLSX from "xlsx";

type Row = {
  id: string;
  source: "inventory" | "listing" | "auction";
  plant_name: string;
  variety: string;
  quantity: number;
  description: string;
  status: string;
  price: string;
  created_at: string;
  archived_at: string | null;
};

const statusColor: Record<string, string> = {
  "Draft":         "bg-gray-100 text-gray-600",
  "In Shop":       "bg-green-100 text-green-700",
  "Paused":        "bg-yellow-100 text-yellow-700",
  "Sold Out":      "bg-red-100 text-red-600",
  "Live Auction":  "bg-blue-100 text-blue-700",
  "Auction Ended": "bg-purple-100 text-purple-700",
  "Cancelled":     "bg-gray-100 text-gray-500",
  "Archived":      "bg-orange-100 text-orange-600",
};

function daysUntilPurge(archivedAt: string) {
  const purgeDate = new Date(archivedAt).getTime() + 7 * 24 * 60 * 60 * 1000;
  const diff = Math.ceil((purgeDate - Date.now()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

export default function InventoryClient({ activeRows, archivedRows }: { activeRows: Row[]; archivedRows: Row[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<"active" | "archived">("active");
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function archiveItem(id: string) {
    setLoadingId(id);
    const supabase = createClient();
    const { error } = await supabase
      .from("inventory")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", id);
    setLoadingId(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Item moved to archive.");
    router.refresh();
  }

  async function restoreItem(id: string) {
    setLoadingId(id);
    const supabase = createClient();
    const { error } = await supabase
      .from("inventory")
      .update({ archived_at: null })
      .eq("id", id);
    setLoadingId(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Item restored to inventory.");
    router.refresh();
  }

  function exportExcel(rows: Row[]) {
    const data = rows.map((r) => ({
      "Plant Name":   r.plant_name,
      "Variety":      r.variety,
      "Quantity":     r.quantity,
      "Status":       r.status,
      "Price / Bid":  r.price,
      "Description":  r.description,
      "Date Added":   new Date(r.created_at).toLocaleDateString(),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory");
    XLSX.writeFile(wb, "plantmarket-inventory.xlsx");
  }

  function exportPDF(rows: Row[]) {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const html = `<!DOCTYPE html><html><head><title>PlantMarket Inventory</title>
      <style>
        body{font-family:Arial,sans-serif;font-size:12px;padding:20px}
        h1{font-size:18px;margin-bottom:4px}
        p{color:#666;margin-bottom:16px;font-size:11px}
        table{width:100%;border-collapse:collapse}
        th{background:#166534;color:white;padding:8px 10px;text-align:left;font-size:11px}
        td{padding:7px 10px;border-bottom:1px solid #e5e7eb;font-size:11px}
        tr:nth-child(even) td{background:#f9fafb}
      </style></head><body>
      <h1>PlantMarket — Inventory Report</h1>
      <p>Generated ${new Date().toLocaleDateString()} &nbsp;·&nbsp; ${rows.length} item${rows.length !== 1 ? "s" : ""}</p>
      <table><thead><tr>
        <th>Plant Name</th><th>Variety</th><th>Qty</th><th>Status</th><th>Price / Bid</th><th>Description</th>
      </tr></thead><tbody>
        ${rows.map((r) => `<tr>
          <td>${r.plant_name}</td><td>${r.variety || "—"}</td><td>${r.quantity}</td>
          <td>${r.status}</td><td>${r.price || "—"}</td><td>${r.description || "—"}</td>
        </tr>`).join("")}
      </tbody></table>
      <script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}<\/script>
      </body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();
  }

  const rows = tab === "active" ? activeRows : archivedRows;

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Inventory</h1>
          <p className="text-muted-foreground mt-1">
            {activeRows.length} active · {archivedRows.length} archived
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => exportExcel(rows)} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Download Excel
          </button>
          <button onClick={() => exportPDF(rows)} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Download PDF
          </button>
          <Link href="/dashboard/create" className={cn(buttonVariants({ size: "sm" }), "bg-green-700 hover:bg-green-800")}>
            + Add Item
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b mb-6">
        <button
          onClick={() => setTab("active")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
            tab === "active" ? "border-green-700 text-green-700" : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Active
          <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs">{activeRows.length}</span>
        </button>
        <button
          onClick={() => setTab("archived")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
            tab === "archived" ? "border-green-700 text-green-700" : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Archived
          {archivedRows.length > 0 && (
            <span className="ml-2 rounded-full bg-orange-100 text-orange-600 px-2 py-0.5 text-xs">{archivedRows.length}</span>
          )}
        </button>
      </div>

      {/* Archived notice */}
      {tab === "archived" && archivedRows.length > 0 && (
        <div className="mb-4 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700">
          Archived items are permanently deleted after 7 days. Restore an item to keep it.
        </div>
      )}

      {/* Table */}
      {rows.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-4xl mb-4">{tab === "archived" ? "🗑️" : "📦"}</p>
          <p className="font-medium">{tab === "archived" ? "No archived items" : "No inventory yet"}</p>
          {tab === "active" && (
            <>
              <p className="text-sm mt-1">Add your first item to get started.</p>
              <Link href="/dashboard/create" className={cn(buttonVariants(), "mt-6 bg-green-700 hover:bg-green-800")}>
                + Add Inventory
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Plant</th>
                <th className="text-left px-4 py-3 font-medium">Variety</th>
                <th className="text-left px-4 py-3 font-medium">Qty</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Price / Bid</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Description</th>
                <th className="text-left px-4 py-3 font-medium">
                  {tab === "archived" ? "Expires" : "Actions"}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.id} className={i % 2 === 0 ? "bg-white" : "bg-muted/20"}>
                  <td className="px-4 py-3 font-medium">{row.plant_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.variety || "—"}</td>
                  <td className="px-4 py-3">{row.quantity}</td>
                  <td className="px-4 py-3">
                    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", statusColor[row.status] ?? "bg-gray-100 text-gray-600")}>
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">{row.price || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell max-w-xs truncate">
                    {row.description || "—"}
                  </td>
                  <td className="px-4 py-3">
                    {tab === "archived" && row.archived_at ? (
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-orange-600">
                          {daysUntilPurge(row.archived_at)}d left
                        </span>
                        <button
                          onClick={() => restoreItem(row.id)}
                          disabled={loadingId === row.id}
                          className="text-xs text-green-700 hover:underline disabled:opacity-50"
                        >
                          {loadingId === row.id ? "Restoring…" : "Restore"}
                        </button>
                      </div>
                    ) : row.source === "inventory" ? (
                      <button
                        onClick={() => archiveItem(row.id)}
                        disabled={loadingId === row.id}
                        className="text-xs text-red-500 hover:underline disabled:opacity-50"
                      >
                        {loadingId === row.id ? "Deleting…" : "Delete"}
                      </button>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
