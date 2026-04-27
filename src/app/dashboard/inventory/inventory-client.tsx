"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { dollarsToCents, centsToDisplay } from "@/lib/stripe";
import { FileText, AlertTriangle, X, ImagePlus } from "lucide-react";
import * as XLSX from "xlsx";

const CATEGORIES = [
  "Tropical", "Succulent", "Cactus", "Carnivorous", "Orchid",
  "Fern", "Herb", "Rare", "Seasonal", "Other",
];

type Row = {
  id: string;
  source: "inventory" | "listing" | "auction";
  plant_name: string;
  variety: string;
  quantity: number;
  in_stock: number | null;
  listing_quantity: number | null;
  linked_listing_id: string | null;
  description: string;
  notes: string;
  status: string;
  price: string;
  price_cents: number | null;
  images: string[];
  category: string | null;
  created_at: string;
  archived_at: string | null;
};

type ListingOption = {
  id: string;
  plant_name: string;
  variety: string | null;
};

type ActionModal =
  | { type: "listing"; row: Row }
  | { type: "auction"; row: Row }
  | { type: "link"; row: Row }
  | { type: "edit"; row: Row }
  | { type: "edit-listing"; row: Row }
  | null;

const statusColor: Record<string, string> = {
  "Draft":         "bg-muted text-muted-foreground",
  "In Shop":       "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
  "Paused":        "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400",
  "Sold Out":      "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400",
  "Live Auction":  "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  "Auction Ended": "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400",
  "Cancelled":     "bg-muted text-muted-foreground",
  "Archived":      "bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400",
};

function daysUntilPurge(archivedAt: string) {
  const purgeDate = new Date(archivedAt).getTime() + 30 * 24 * 60 * 60 * 1000;
  return Math.max(0, Math.ceil((purgeDate - Date.now()) / (1000 * 60 * 60 * 24)));
}

function Thumb({ images }: { images: string[] }) {
  return images[0] ? (
    <img src={images[0]} alt="" className="w-9 h-9 rounded object-cover shrink-0" />
  ) : (
    <div className="w-9 h-9 rounded bg-muted flex items-center justify-center text-base shrink-0">🌿</div>
  );
}

export default function InventoryClient({
  activeRows,
  archivedRows,
  listingOptions,
}: {
  activeRows: Row[];
  archivedRows: Row[];
  listingOptions: ListingOption[];
}) {
  const router = useRouter();

  // — Tab / filter / sort
  const [tab, setTab] = useState<"active" | "archived">("active");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [sortCol, setSortCol] = useState<"plant_name" | "variety" | "quantity" | "created_at" | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // — Bulk select
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  // — Row-level loading
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // — Modals
  const [modal, setModal] = useState<ActionModal>(null);
  const [price, setPrice] = useState("");
  const [listQty, setListQty] = useState("");
  const [startingBid, setStartingBid] = useState("");
  const [buyNowPrice, setBuyNowPrice] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [linkListingId, setLinkListingId] = useState("");
  const [linkQty, setLinkQty] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // — Edit modal fields
  const [editPlantName, setEditPlantName] = useState("");
  const [editVariety, setEditVariety] = useState("");
  const [editQuantity, setEditQuantity] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editImages, setEditImages] = useState<string[]>([]);
  const [imageUploading, setImageUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // — Inline quantity editing
  const [editingCell, setEditingCell] = useState<{ rowId: string; field: "quantity" | "listing_quantity" | "in_stock"; source: Row["source"] } | null>(null);
  const [editingValue, setEditingValue] = useState("");

  // — Inline category editing
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryValue, setEditingCategoryValue] = useState("");
  const [editingCategorySource, setEditingCategorySource] = useState<Row["source"]>("inventory");

  // ── Sort ──────────────────────────────────────────────────────────────────

  function toggleSort(col: typeof sortCol) {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  }

  function sortIndicator(col: typeof sortCol) {
    if (sortCol !== col) return "↕";
    return sortDir === "asc" ? "↑" : "↓";
  }

  // ── Inline quantity editing ───────────────────────────────────────────────

  function startEdit(rowId: string, field: "quantity" | "listing_quantity" | "in_stock", current: number | null, source: Row["source"]) {
    setEditingCell({ rowId, field, source });
    setEditingValue(current !== null ? String(current) : "");
  }

  async function saveEdit() {
    if (!editingCell) return;
    const { rowId, field, source } = editingCell;
    const num = editingValue === "" ? null : Number(editingValue);
    setEditingCell(null);
    if (num !== null && isNaN(num)) return;
    const supabase = createClient();
    if (source === "listing" && field === "in_stock") {
      const { error } = await supabase.from("listings").update({ in_stock: num }).eq("id", rowId);
      if (error) toast.error(error.message); else router.refresh();
    } else if (source === "listing") {
      const { error } = await supabase.from("listings").update({ quantity: num ?? 0 }).eq("id", rowId);
      if (error) toast.error(error.message); else router.refresh();
    } else if (field === "quantity") {
      const { error } = await supabase.from("inventory").update({ quantity: num ?? 0 }).eq("id", rowId);
      if (error) toast.error(error.message); else router.refresh();
    } else {
      const { error } = await supabase.from("inventory").update({ listing_quantity: num }).eq("id", rowId);
      if (error) toast.error(error.message); else router.refresh();
    }
  }

  function cancelEdit() { setEditingCell(null); }

  // ── Inline category editing ───────────────────────────────────────────────

  function startCategoryEdit(rowId: string, current: string | null, source: Row["source"]) {
    setEditingCategoryId(rowId);
    setEditingCategoryValue(current ?? "");
    setEditingCategorySource(source);
  }

  async function saveCategoryEdit() {
    if (!editingCategoryId) return;
    const id = editingCategoryId;
    const value = editingCategoryValue || null;
    const source = editingCategorySource;
    setEditingCategoryId(null);
    const supabase = createClient();
    if (source === "inventory") {
      const { error } = await supabase.from("inventory").update({ category: value }).eq("id", id);
      if (error) toast.error(error.message); else router.refresh();
    } else if (source === "listing") {
      const { error } = await supabase.from("listings").update({ category: value }).eq("id", id);
      if (error) toast.error(error.message); else router.refresh();
    }
  }

  // ── Bulk actions ──────────────────────────────────────────────────────────

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === rows.length && rows.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(rows.map((r) => r.id)));
    }
  }

  async function bulkArchive() {
    const ids = [...selectedIds].filter((id) => rows.find((r) => r.id === id)?.source === "inventory");
    if (!ids.length) { toast.error("Select inventory drafts to archive"); return; }
    setBulkLoading(true);
    const supabase = createClient();
    const { error } = await supabase.from("inventory").update({ archived_at: new Date().toISOString() }).in("id", ids);
    setBulkLoading(false);
    if (error) toast.error(error.message);
    else {
      toast.success(`${ids.length} item${ids.length !== 1 ? "s" : ""} archived`);
      setSelectedIds(new Set());
      router.refresh();
    }
  }

  async function bulkPauseListing() {
    const ids = [...selectedIds].filter((id) => {
      const row = rows.find((r) => r.id === id);
      return row?.source === "listing" && row.status === "In Shop";
    });
    if (!ids.length) { toast.error("Select active shop listings to pause"); return; }
    setBulkLoading(true);
    const supabase = createClient();
    const { error } = await supabase.from("listings").update({ status: "paused" }).in("id", ids);
    setBulkLoading(false);
    if (error) toast.error(error.message);
    else {
      toast.success(`${ids.length} listing${ids.length !== 1 ? "s" : ""} paused`);
      setSelectedIds(new Set());
      router.refresh();
    }
  }

  // ── Modal helpers ─────────────────────────────────────────────────────────

  function openModal(type: "listing" | "auction" | "link" | "edit" | "edit-listing", row: Row) {
    setPrice(type === "edit-listing" && row.price_cents ? (row.price_cents / 100).toFixed(2) : "");
    setListQty(String(row.quantity));
    setStartingBid("");
    setBuyNowPrice("");
    setEndsAt("");
    setLinkListingId(row.linked_listing_id ?? "");
    setLinkQty(row.listing_quantity !== null ? String(row.listing_quantity) : "");
    setEditPlantName(row.plant_name);
    setEditVariety(row.variety);
    setEditQuantity(String(row.quantity));
    setEditDescription(row.description);
    setEditNotes(row.notes);
    setEditCategory(row.category ?? "");
    setEditImages([...row.images]);
    setModal({ type, row });
  }

  // ── Photo editing helpers ─────────────────────────────────────────────────

  async function handleImageAdd(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setImageUploading(true);
    const supabase = createClient();
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `inventory/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("listings").upload(path, file);
    if (error) {
      toast.error("Upload failed: " + error.message);
      setImageUploading(false);
      return;
    }
    const { data } = supabase.storage.from("listings").getPublicUrl(path);
    setEditImages((prev) => [...prev, data.publicUrl]);
    setImageUploading(false);
  }

  function removeEditImage(url: string) {
    setEditImages((prev) => prev.filter((u) => u !== url));
  }

  // ── CRUD actions ──────────────────────────────────────────────────────────

  async function submitListing() {
    if (!modal || modal.type !== "listing") return;
    setSubmitting(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Not logged in"); setSubmitting(false); return; }
    const qty = Number(listQty) || modal.row.quantity;
    const { data: newListing, error } = await supabase.from("listings").insert({
      seller_id: user.id,
      plant_name: modal.row.plant_name,
      variety: modal.row.variety || null,
      quantity: qty,
      description: modal.row.description || null,
      price_cents: dollarsToCents(price),
      images: modal.row.images,
      category: modal.row.category || null,
    }).select("id").single();
    if (error) { toast.error(error.message); setSubmitting(false); return; }
    await supabase.from("inventory").update({ listing_id: newListing.id, listing_quantity: qty }).eq("id", modal.row.id);
    setSubmitting(false);
    toast.success(`${modal.row.plant_name} is now live in your shop!`);
    setModal(null);
    router.refresh();
  }

  async function submitAuction() {
    if (!modal || modal.type !== "auction") return;
    setSubmitting(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Not logged in"); setSubmitting(false); return; }
    const { error } = await supabase.from("auctions").insert({
      seller_id: user.id,
      plant_name: modal.row.plant_name,
      variety: modal.row.variety || null,
      quantity: modal.row.quantity,
      description: modal.row.description || null,
      starting_bid_cents: dollarsToCents(startingBid),
      current_bid_cents: dollarsToCents(startingBid),
      buy_now_price_cents: buyNowPrice ? dollarsToCents(buyNowPrice) : null,
      ends_at: new Date(endsAt).toISOString(),
      images: modal.row.images,
      category: modal.row.category || null,
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Auction started for ${modal.row.plant_name}!`);
    setModal(null);
    router.refresh();
  }

  async function submitLink() {
    if (!modal || modal.type !== "link") return;
    if (!linkListingId) { toast.error("Select a listing to link"); return; }
    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.from("inventory").update({
      listing_id: linkListingId,
      listing_quantity: linkQty ? Number(linkQty) : null,
    }).eq("id", modal.row.id);
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Linked to listing.");
    setModal(null);
    router.refresh();
  }

  async function submitEdit() {
    if (!modal || modal.type !== "edit") return;
    if (!editPlantName.trim()) { toast.error("Plant name is required"); return; }
    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.from("inventory").update({
      plant_name: editPlantName.trim(),
      variety: editVariety.trim() || null,
      quantity: Number(editQuantity) || 0,
      description: editDescription.trim() || null,
      notes: editNotes.trim() || null,
      category: editCategory || null,
      images: editImages,
    }).eq("id", modal.row.id);
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Item updated.");
    setModal(null);
    router.refresh();
  }

  async function submitEditListing() {
    if (!modal || modal.type !== "edit-listing") return;
    if (!editPlantName.trim()) { toast.error("Plant name is required"); return; }
    if (!price) { toast.error("Price is required"); return; }
    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.from("listings").update({
      plant_name: editPlantName.trim(),
      variety: editVariety.trim() || null,
      quantity: Number(editQuantity) || 0,
      price_cents: dollarsToCents(price),
      description: editDescription.trim() || null,
      category: editCategory || null,
      images: editImages,
    }).eq("id", modal.row.id);
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Listing updated.");
    setModal(null);
    router.refresh();
  }

  async function cloneItem(row: Row) {
    const cloneKey = row.id + "_clone";
    setLoadingId(cloneKey);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Not logged in"); setLoadingId(null); return; }
    const { error } = await supabase.from("inventory").insert({
      seller_id: user.id,
      plant_name: `${row.plant_name} (copy)`,
      variety: row.variety || null,
      quantity: row.quantity,
      description: row.description || null,
      notes: row.notes || null,
      images: row.images,
      category: row.category || null,
    });
    setLoadingId(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Item cloned.");
    router.refresh();
  }

  async function unlinkItem(id: string) {
    setLoadingId(id);
    const supabase = createClient();
    const { error } = await supabase.from("inventory").update({ listing_id: null, listing_quantity: null }).eq("id", id);
    setLoadingId(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Unlinked from listing.");
    router.refresh();
  }

  async function archiveItem(id: string) {
    setLoadingId(id);
    const supabase = createClient();
    const { error } = await supabase.from("inventory").update({ archived_at: new Date().toISOString() }).eq("id", id);
    setLoadingId(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Item moved to archive.");
    router.refresh();
  }

  async function deleteAuction(id: string) {
    setLoadingId(id);
    const supabase = createClient();
    const { error } = await supabase.from("auctions").delete().eq("id", id);
    setLoadingId(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Auction removed.");
    router.refresh();
  }

  async function restoreItem(id: string) {
    setLoadingId(id);
    const supabase = createClient();
    const { error } = await supabase.from("inventory").update({ archived_at: null }).eq("id", id);
    setLoadingId(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Item restored to inventory.");
    router.refresh();
  }

  // ── Export ────────────────────────────────────────────────────────────────

  function exportExcel(exportRows: Row[]) {
    const data = exportRows.map((r) => ({
      "Plant Name": r.plant_name,
      "Variety": r.variety,
      "Category": r.category ?? "",
      "In Stock": r.quantity,
      "Listed Qty": r.listing_quantity ?? "",
      "Status": r.status,
      "Price / Bid": r.price,
      "Description": r.description,
      "Date Added": new Date(r.created_at).toLocaleDateString(),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory");
    XLSX.writeFile(wb, "plantmarket-inventory.xlsx");
  }

  function exportPDF(exportRows: Row[]) {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html><html><head><title>PlantMarket Inventory</title>
      <style>body{font-family:Arial,sans-serif;font-size:12px;padding:20px}h1{font-size:18px;margin-bottom:4px}
      p{color:#666;margin-bottom:16px;font-size:11px}table{width:100%;border-collapse:collapse}
      th{background:#166534;color:white;padding:8px 10px;text-align:left;font-size:11px}
      td{padding:7px 10px;border-bottom:1px solid #e5e7eb;font-size:11px}
      tr:nth-child(even) td{background:#f9fafb}</style></head><body>
      <h1>PlantMarket — Inventory Report</h1>
      <p>Generated ${new Date().toLocaleDateString()} · ${exportRows.length} item${exportRows.length !== 1 ? "s" : ""}</p>
      <table><thead><tr><th>Plant Name</th><th>Variety</th><th>Category</th><th>In Stock</th><th>Listed Qty</th><th>Status</th><th>Price / Bid</th></tr></thead>
      <tbody>${exportRows.map((r) => `<tr><td>${r.plant_name}</td><td>${r.variety || "—"}</td><td>${r.category || "—"}</td><td>${r.quantity}</td><td>${r.listing_quantity ?? "—"}</td><td>${r.status}</td><td>${r.price || "—"}</td></tr>`).join("")}</tbody>
      </table><script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}<\/script></body></html>`);
    printWindow.document.close();
  }

  // ── Filter + sort pipeline ────────────────────────────────────────────────

  const allRows = tab === "active" ? activeRows : archivedRows;
  const allStatuses = ["All", ...Array.from(new Set(allRows.map((r) => r.status)))];
  const allCategories = ["All", ...Array.from(new Set(allRows.map((r) => r.category).filter((c): c is string => c !== null && c !== ""))).values()];

  const afterStatusFilter = statusFilter !== "All" ? allRows.filter((r) => r.status === statusFilter) : allRows;
  const afterCategoryFilter = categoryFilter !== "All" ? afterStatusFilter.filter((r) => r.category === categoryFilter) : afterStatusFilter;
  const filtered = search.trim()
    ? afterCategoryFilter.filter((r) => {
        const q = search.toLowerCase();
        return r.plant_name.toLowerCase().includes(q) || r.variety.toLowerCase().includes(q);
      })
    : afterCategoryFilter;
  const rows = sortCol
    ? [...filtered].sort((a, b) => {
        if (sortCol === "quantity") return sortDir === "asc" ? a.quantity - b.quantity : b.quantity - a.quantity;
        if (sortCol === "created_at") {
          const ad = new Date(a.created_at).getTime();
          const bd = new Date(b.created_at).getTime();
          return sortDir === "asc" ? ad - bd : bd - ad;
        }
        const av = (a[sortCol] ?? "").toLowerCase();
        const bv = (b[sortCol] ?? "").toLowerCase();
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      })
    : filtered;

  const totalListedValue = rows.reduce((sum, r) => sum + (r.price_cents !== null ? r.price_cents * r.quantity : 0), 0);

  // ── Render helpers ────────────────────────────────────────────────────────

  function rowActions(row: Row) {
    if (tab === "archived" && row.archived_at) {
      return (
        <div className="flex items-center gap-3">
          <span className="text-xs text-orange-600">{daysUntilPurge(row.archived_at)}d left</span>
          <button onClick={() => restoreItem(row.id)} disabled={loadingId === row.id} className="text-xs text-green-700 hover:underline disabled:opacity-50">
            {loadingId === row.id ? "Restoring…" : "Restore"}
          </button>
        </div>
      );
    }
    if (row.source === "inventory") {
      const cloneKey = row.id + "_clone";
      return (
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => openModal("edit", row)} className="text-xs text-foreground hover:underline font-medium">Edit</button>
          <button onClick={() => cloneItem(row)} disabled={loadingId === cloneKey} className="text-xs text-blue-500 hover:underline font-medium disabled:opacity-50">
            {loadingId === cloneKey ? "…" : "Clone"}
          </button>
          {row.linked_listing_id ? (
            <>
              <button onClick={() => openModal("link", row)} className="text-xs text-blue-600 hover:underline font-medium">Edit Link</button>
              <button onClick={() => unlinkItem(row.id)} disabled={loadingId === row.id} className="text-xs text-muted-foreground hover:underline disabled:opacity-50">
                {loadingId === row.id ? "…" : "Unlink"}
              </button>
            </>
          ) : (
            <>
              <button onClick={() => openModal("link", row)} className="text-xs text-blue-600 hover:underline font-medium">Link</button>
              <button onClick={() => openModal("listing", row)} className="text-xs text-green-700 hover:underline font-medium">List in Shop</button>
            </>
          )}
          <button onClick={() => openModal("auction", row)} className="text-xs text-purple-600 hover:underline font-medium">Auction</button>
          <button onClick={() => archiveItem(row.id)} disabled={loadingId === row.id} className="text-xs text-red-500 hover:underline disabled:opacity-50">
            {loadingId === row.id ? "…" : "Delete"}
          </button>
        </div>
      );
    }
    if (row.source === "listing") {
      return (
        <button onClick={() => openModal("edit-listing", row)} className="text-xs text-foreground hover:underline font-medium">
          Edit
        </button>
      );
    }
    if (row.source === "auction" && row.status === "Cancelled") {
      return (
        <button onClick={() => deleteAuction(row.id)} disabled={loadingId === row.id} className="text-xs text-red-500 hover:underline disabled:opacity-50">
          {loadingId === row.id ? "Deleting…" : "Delete"}
        </button>
      );
    }
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  function inStockCell(row: Row) {
    if (row.source === "inventory") {
      return editingCell?.rowId === row.id && editingCell?.field === "quantity" ? (
        <input type="number" min={0} value={editingValue} onChange={(e) => setEditingValue(e.target.value)}
          onBlur={saveEdit} onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") cancelEdit(); }}
          autoFocus className="w-16 px-1.5 py-0.5 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-green-600" />
      ) : (
        <button onClick={() => startEdit(row.id, "quantity", row.quantity, row.source)} className="hover:text-green-700 hover:underline tabular-nums" title="Click to edit">
          {row.quantity}
        </button>
      );
    }
    if (row.source === "listing") {
      return editingCell?.rowId === row.id && editingCell?.field === "in_stock" ? (
        <input type="number" min={0} value={editingValue} onChange={(e) => setEditingValue(e.target.value)}
          onBlur={saveEdit} onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") cancelEdit(); }}
          autoFocus className="w-16 px-1.5 py-0.5 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-green-600" />
      ) : (
        <button onClick={() => startEdit(row.id, "in_stock", row.in_stock, row.source)} className={cn("hover:text-green-700 hover:underline tabular-nums", row.in_stock === null && "text-muted-foreground")} title="Click to edit">
          {row.in_stock ?? "—"}
        </button>
      );
    }
    return <span className="text-muted-foreground">{row.quantity}</span>;
  }

  function listedQtyCell(row: Row, linkedListing?: ListingOption | null) {
    const hiddenGap =
      row.source === "inventory" &&
      row.linked_listing_id &&
      row.listing_quantity !== null &&
      row.quantity > row.listing_quantity
        ? row.quantity - row.listing_quantity
        : null;

    const listingHiddenGap =
      row.source === "listing" &&
      row.in_stock !== null &&
      row.in_stock > row.quantity
        ? row.in_stock - row.quantity
        : null;

    if (row.source === "inventory") {
      return (
        <div>
          <div className="flex items-center gap-1.5">
            {editingCell?.rowId === row.id && editingCell?.field === "listing_quantity" ? (
              <input type="number" min={0} value={editingValue} onChange={(e) => setEditingValue(e.target.value)}
                onBlur={saveEdit} onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") cancelEdit(); }}
                autoFocus className="w-16 px-1.5 py-0.5 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-green-600" />
            ) : (
              <button onClick={() => startEdit(row.id, "listing_quantity", row.listing_quantity, row.source)} className={cn("hover:text-green-700 hover:underline tabular-nums", row.listing_quantity === null && "text-muted-foreground")} title="Click to edit">
                {row.listing_quantity ?? "—"}
              </button>
            )}
            {hiddenGap !== null && (
              <span className="inline-flex items-center gap-0.5 text-xs text-orange-600" title={`${hiddenGap} units hidden from buyers`}>
                <AlertTriangle size={11} />
                {hiddenGap} hidden
              </span>
            )}
          </div>
          {linkedListing && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[120px]">
              {linkedListing.plant_name}{linkedListing.variety ? ` · ${linkedListing.variety}` : ""}
            </p>
          )}
        </div>
      );
    }
    if (row.source === "listing") {
      return (
        <div className="flex items-center gap-1.5">
          {editingCell?.rowId === row.id && editingCell?.field === "listing_quantity" ? (
            <input type="number" min={0} value={editingValue} onChange={(e) => setEditingValue(e.target.value)}
              onBlur={saveEdit} onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") cancelEdit(); }}
              autoFocus className="w-16 px-1.5 py-0.5 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-green-600" />
          ) : (
            <button onClick={() => startEdit(row.id, "listing_quantity", row.quantity, row.source)} className="hover:text-green-700 hover:underline tabular-nums" title="Click to edit">
              {row.quantity}
            </button>
          )}
          {listingHiddenGap !== null && (
            <span className="inline-flex items-center gap-0.5 text-xs text-orange-600" title={`${listingHiddenGap} units in stock not shown to buyers`}>
              <AlertTriangle size={11} />
              {listingHiddenGap} hidden
            </span>
          )}
        </div>
      );
    }
    return <span className="text-muted-foreground">—</span>;
  }

  function categoryCell(row: Row) {
    const canEdit = row.source === "inventory" || row.source === "listing";
    if (canEdit && editingCategoryId === row.id) {
      return (
        <select
          value={editingCategoryValue}
          onChange={(e) => setEditingCategoryValue(e.target.value)}
          onBlur={saveCategoryEdit}
          autoFocus
          className="text-xs border rounded px-1 py-0.5 bg-background max-w-[110px]"
        >
          <option value="">— None —</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      );
    }
    if (canEdit) {
      return (
        <button
          onClick={() => startCategoryEdit(row.id, row.category, row.source)}
          className={cn("text-xs hover:underline hover:text-green-700", row.category ? "text-foreground" : "text-muted-foreground")}
          title="Click to edit category"
        >
          {row.category ?? "—"}
        </button>
      );
    }
    return <span className="text-xs text-muted-foreground">{row.category ?? "—"}</span>;
  }

  // ── Derived bulk state ────────────────────────────────────────────────────

  const hasSelectedInventory = [...selectedIds].some((id) => rows.find((r) => r.id === id)?.source === "inventory");
  const hasSelectedActiveListings = [...selectedIds].some((id) => {
    const row = rows.find((r) => r.id === id);
    return row?.source === "listing" && row.status === "In Shop";
  });

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Inventory</h1>
          <p className="text-muted-foreground mt-1">{activeRows.length} active · {archivedRows.length} archived</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => exportExcel(rows)} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>Download Excel</button>
          <button onClick={() => exportPDF(rows)} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>Download PDF</button>
          <Link href="/dashboard/create" className={cn(buttonVariants({ size: "sm" }), "bg-green-700 hover:bg-green-800")}>+ Add Item</Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b mb-6">
        {(["active", "archived"] as const).map((t) => (
          <button key={t} onClick={() => { setTab(t); setSelectedIds(new Set()); setStatusFilter("All"); setCategoryFilter("All"); }} className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors capitalize",
            tab === t ? "border-green-700 text-green-700" : "border-transparent text-muted-foreground hover:text-foreground"
          )}>
            {t}
            <span className={cn("ml-2 rounded-full px-2 py-0.5 text-xs", t === "archived" && archivedRows.length > 0 ? "bg-orange-100 text-orange-600" : "bg-muted text-muted-foreground")}>
              {t === "active" ? activeRows.length : archivedRows.length}
            </span>
          </button>
        ))}
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4 flex-wrap">
        <Input
          placeholder="Search by plant name or variety…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "All")}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            {allStatuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        {allCategories.length > 1 && (
          <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v ?? "All")}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              {allCategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Archive warning */}
      {tab === "archived" && archivedRows.length > 0 && (
        <div className="mb-4 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700">
          Archived items are permanently deleted after 30 days. Restore an item to keep it.
        </div>
      )}

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 mb-4 px-4 py-2.5 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg text-sm">
          <span className="font-medium text-green-800 dark:text-green-300">{selectedIds.size} selected</span>
          <div className="flex gap-2">
            {hasSelectedInventory && (
              <Button size="sm" variant="outline" onClick={bulkArchive} disabled={bulkLoading} className="text-xs h-7">
                Archive selected
              </Button>
            )}
            {hasSelectedActiveListings && (
              <Button size="sm" variant="outline" onClick={bulkPauseListing} disabled={bulkLoading} className="text-xs h-7">
                Pause listings
              </Button>
            )}
          </div>
          <button onClick={() => setSelectedIds(new Set())} className="ml-auto text-xs text-muted-foreground hover:text-foreground">
            Clear
          </button>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-4xl mb-4">{tab === "archived" ? "🗑️" : "📦"}</p>
          <p className="font-medium">
            {search.trim()
              ? `No results for "${search}"`
              : tab === "archived" ? "No archived items" : "No inventory yet"}
          </p>
          {tab === "active" && !search.trim() && (
            <Link href="/dashboard/create" className={cn(buttonVariants(), "mt-6 bg-green-700 hover:bg-green-800")}>+ Add Inventory</Link>
          )}
        </div>
      ) : (
        <>
          {/* Mobile card layout */}
          <div className="sm:hidden space-y-3">
            {rows.map((row) => {
              const linkedListing = row.linked_listing_id ? listingOptions.find((l) => l.id === row.linked_listing_id) : null;
              return (
                <div key={row.id} className="rounded-lg border bg-card p-4 space-y-3">
                  <div className="flex gap-3 items-start">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(row.id)}
                      onChange={() => toggleSelect(row.id)}
                      className="mt-0.5 rounded border-border shrink-0"
                    />
                    <Thumb images={row.images} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-medium truncate">{row.plant_name}</p>
                        {row.notes && (
                          <span title={row.notes} className="shrink-0 cursor-default">
                            <FileText size={13} className="text-muted-foreground" />
                          </span>
                        )}
                      </div>
                      {row.variety && <p className="text-sm text-muted-foreground truncate">{row.variety}</p>}
                      {row.category && (
                        <span className="inline-block text-xs text-green-700 bg-green-100 dark:bg-green-900/40 dark:text-green-400 px-1.5 py-0.5 rounded-full mt-0.5">
                          {row.category}
                        </span>
                      )}
                    </div>
                    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium shrink-0", statusColor[row.status] ?? "bg-gray-100 text-gray-600")}>
                      {row.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">In Stock</p>
                      {inStockCell(row)}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Listed Qty</p>
                      {listedQtyCell(row, linkedListing)}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Price / Bid</p>
                      <p className="font-medium">{row.price || "—"}</p>
                    </div>
                  </div>
                  <div>{rowActions(row)}</div>
                </div>
              );
            })}
          </div>

          {/* Desktop table layout */}
          <div className="hidden sm:block rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="w-10 px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === rows.length && rows.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-border"
                    />
                  </th>
                  <th className="w-12 px-2 py-3"></th>
                  <th className="text-left px-4 py-3 font-medium">
                    <button onClick={() => toggleSort("plant_name")} className="flex items-center gap-1 hover:text-foreground transition-colors">
                      Plant <span className="text-xs">{sortIndicator("plant_name")}</span>
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 font-medium">
                    <button onClick={() => toggleSort("variety")} className="flex items-center gap-1 hover:text-foreground transition-colors">
                      Variety <span className="text-xs">{sortIndicator("variety")}</span>
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Category</th>
                  <th className="text-left px-4 py-3 font-medium">
                    <button onClick={() => toggleSort("quantity")} className="flex items-center gap-1 hover:text-foreground transition-colors">
                      In Stock <span className="text-xs">{sortIndicator("quantity")}</span>
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 font-medium">Listed Qty</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Price / Bid</th>
                  <th className="text-left px-4 py-3 font-medium hidden xl:table-cell">
                    <button onClick={() => toggleSort("created_at")} className="flex items-center gap-1 hover:text-foreground transition-colors">
                      Added <span className="text-xs">{sortIndicator("created_at")}</span>
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const linkedListing = row.linked_listing_id ? listingOptions.find((l) => l.id === row.linked_listing_id) : null;
                  return (
                    <tr key={row.id} className={cn(i % 2 === 0 ? "bg-card" : "bg-muted/20", selectedIds.has(row.id) && "ring-1 ring-inset ring-green-400/50 bg-green-50/30 dark:bg-green-950/10")}>
                      <td className="px-3 py-3">
                        <input type="checkbox" checked={selectedIds.has(row.id)} onChange={() => toggleSelect(row.id)} className="rounded border-border" />
                      </td>
                      <td className="px-2 py-3">
                        <Thumb images={row.images} />
                      </td>
                      <td className="px-4 py-3 font-medium">
                        <div className="flex items-center gap-1.5">
                          {row.plant_name}
                          {row.notes && (
                            <span title={row.notes} className="shrink-0 cursor-default">
                              <FileText size={13} className="text-muted-foreground" />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{row.variety || "—"}</td>
                      <td className="px-4 py-3 hidden lg:table-cell">{categoryCell(row)}</td>
                      <td className="px-4 py-3">{inStockCell(row)}</td>
                      <td className="px-4 py-3">{listedQtyCell(row, linkedListing)}</td>
                      <td className="px-4 py-3">
                        <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", statusColor[row.status] ?? "bg-gray-100 text-gray-600")}>
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{row.price || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs hidden xl:table-cell">
                        {new Date(row.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">{rowActions(row)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Summary footer */}
          <div className="mt-3 flex flex-wrap gap-4 px-1 text-sm text-muted-foreground">
            <span>{rows.length} item{rows.length !== 1 ? "s" : ""}</span>
            {totalListedValue > 0 && (
              <span>Total listed value: <span className="font-semibold text-foreground">{centsToDisplay(totalListedValue)}</span></span>
            )}
          </div>
        </>
      )}

      {/* Link to Listing modal */}
      <Dialog open={modal?.type === "link"} onOpenChange={(o) => !o && setModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{modal?.row.linked_listing_id ? "Edit Listing Link" : "Link to Listing"}</DialogTitle></DialogHeader>
          {modal && (
            <div className="space-y-4 mt-1">
              <p className="text-sm text-muted-foreground">Connect <span className="font-medium text-foreground">{modal.row.plant_name}</span> to an existing listing.</p>
              <div className="space-y-1">
                <Label>Listing *</Label>
                <Select value={linkListingId} onValueChange={(v) => setLinkListingId(v ?? "")}>
                  <SelectTrigger><SelectValue placeholder="Select a listing…" /></SelectTrigger>
                  <SelectContent>
                    {listingOptions.map((l) => (
                      <SelectItem key={l.id} value={l.id}>{l.plant_name}{l.variety ? ` · ${l.variety}` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="link-qty">Listed quantity <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <Input id="link-qty" type="number" min={0} step={1} value={linkQty} onChange={(e) => setLinkQty(e.target.value)} placeholder={`e.g. ${modal.row.quantity}`} />
                <p className="text-xs text-muted-foreground">Buyers see this number. Full stock ({modal.row.quantity}) stays private.</p>
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" onClick={() => setModal(null)} className="flex-1">Cancel</Button>
                <Button onClick={submitLink} disabled={submitting || !linkListingId} className="flex-1 bg-green-700 hover:bg-green-800">{submitting ? "Saving…" : "Save Link"}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* List in Shop modal */}
      <Dialog open={modal?.type === "listing"} onOpenChange={(o) => !o && setModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>List in Shop</DialogTitle></DialogHeader>
          {modal && (
            <div className="space-y-4 mt-1">
              <p className="text-sm text-muted-foreground">Listing <span className="font-medium text-foreground">{modal.row.plant_name}</span>{modal.row.variety ? ` — ${modal.row.variety}` : ""} in your shop.</p>
              <div className="space-y-1">
                <Label htmlFor="modal-price">Price per item ($) *</Label>
                <Input id="modal-price" type="number" min={0.01} step={0.01} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" autoFocus />
              </div>
              <div className="space-y-1">
                <Label htmlFor="modal-list-qty">Quantity to list *</Label>
                <Input id="modal-list-qty" type="number" min={1} step={1} value={listQty} onChange={(e) => setListQty(e.target.value)} placeholder={String(modal.row.quantity)} />
                <p className="text-xs text-muted-foreground">Buyers see this number. Full stock ({modal.row.quantity}) stays in inventory.</p>
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" onClick={() => setModal(null)} className="flex-1">Cancel</Button>
                <Button onClick={submitListing} disabled={submitting || !price || !listQty} className="flex-1 bg-green-700 hover:bg-green-800">{submitting ? "Publishing…" : "Go Live"}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Auction modal */}
      <Dialog open={modal?.type === "auction"} onOpenChange={(o) => !o && setModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Create Auction</DialogTitle></DialogHeader>
          {modal && (
            <div className="space-y-4 mt-1">
              <p className="text-sm text-muted-foreground">Starting an auction for <span className="font-medium text-foreground">{modal.row.plant_name}</span>{modal.row.variety ? ` — ${modal.row.variety}` : ""}.</p>
              <div className="space-y-1">
                <Label htmlFor="modal-bid">Starting Bid ($) *</Label>
                <Input id="modal-bid" type="number" min={0.01} step={0.01} value={startingBid} onChange={(e) => setStartingBid(e.target.value)} placeholder="0.00" autoFocus />
              </div>
              <div className="space-y-1">
                <Label htmlFor="modal-buy-now">Buy Now Price ($) <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <Input id="modal-buy-now" type="number" min={0.01} step={0.01} value={buyNowPrice} onChange={(e) => setBuyNowPrice(e.target.value)} placeholder="Leave blank to disable" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="modal-ends">End Date & Time *</Label>
                <Input id="modal-ends" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} min={new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16)} />
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" onClick={() => setModal(null)} className="flex-1">Cancel</Button>
                <Button onClick={submitAuction} disabled={submitting || !startingBid || !endsAt} className="flex-1 bg-green-700 hover:bg-green-800">{submitting ? "Starting…" : "Start Auction"}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit inventory item modal */}
      <Dialog open={modal?.type === "edit"} onOpenChange={(o) => !o && setModal(null)}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Item</DialogTitle></DialogHeader>
          {modal && (
            <div className="space-y-4 mt-1">
              <div className="space-y-1">
                <Label htmlFor="edit-name">Plant name *</Label>
                <Input id="edit-name" value={editPlantName} onChange={(e) => setEditPlantName(e.target.value)} autoFocus />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-variety">Variety <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <Input id="edit-variety" value={editVariety} onChange={(e) => setEditVariety(e.target.value)} placeholder="e.g. Thai Constellation" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-qty">Quantity</Label>
                <Input id="edit-qty" type="number" min={0} value={editQuantity} onChange={(e) => setEditQuantity(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Category <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <Select value={editCategory || "_none"} onValueChange={(v) => setEditCategory(v === "_none" ? "" : (v ?? ""))}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— None —</SelectItem>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-desc">Description <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <Textarea id="edit-desc" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={3} placeholder="Describe the plant…" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-notes">Private notes <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <Textarea id="edit-notes" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={2} placeholder="Internal notes, not visible to buyers…" />
              </div>

              {/* Photos */}
              <div className="space-y-2">
                <Label>Photos</Label>
                {editImages.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {editImages.map((url, idx) => (
                      <div key={url + idx} className="relative group">
                        <img src={url} alt="" className="w-16 h-16 rounded object-cover border" />
                        <button
                          type="button"
                          onClick={() => removeEditImage(url)}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageAdd} />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={imageUploading}
                  className="flex items-center gap-1.5 text-xs"
                >
                  <ImagePlus size={14} />
                  {imageUploading ? "Uploading…" : "Add Photo"}
                </Button>
              </div>

              <div className="flex gap-2 pt-1">
                <Button variant="outline" onClick={() => setModal(null)} className="flex-1">Cancel</Button>
                <Button onClick={submitEdit} disabled={submitting || !editPlantName.trim()} className="flex-1 bg-green-700 hover:bg-green-800">{submitting ? "Saving…" : "Save Changes"}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit listing modal */}
      <Dialog open={modal?.type === "edit-listing"} onOpenChange={(o) => !o && setModal(null)}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Listing</DialogTitle></DialogHeader>
          {modal && (
            <div className="space-y-4 mt-1">
              <div className="space-y-1">
                <Label htmlFor="el-name">Plant name *</Label>
                <Input id="el-name" value={editPlantName} onChange={(e) => setEditPlantName(e.target.value)} autoFocus />
              </div>
              <div className="space-y-1">
                <Label htmlFor="el-variety">Variety <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <Input id="el-variety" value={editVariety} onChange={(e) => setEditVariety(e.target.value)} placeholder="e.g. Thai Constellation" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="el-price">Price ($) *</Label>
                  <Input id="el-price" type="number" min={0.01} step={0.01} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="el-qty">Quantity *</Label>
                  <Input id="el-qty" type="number" min={0} value={editQuantity} onChange={(e) => setEditQuantity(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Category <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <Select value={editCategory || "_none"} onValueChange={(v) => setEditCategory(v === "_none" ? "" : (v ?? ""))}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— None —</SelectItem>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="el-desc">Description <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <Textarea id="el-desc" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={3} placeholder="Describe the plant…" />
              </div>

              {/* Photos */}
              <div className="space-y-2">
                <Label>Photos</Label>
                {editImages.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {editImages.map((url, idx) => (
                      <div key={url + idx} className="relative group">
                        <img src={url} alt="" className="w-16 h-16 rounded object-cover border" />
                        <button
                          type="button"
                          onClick={() => removeEditImage(url)}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageAdd} />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={imageUploading}
                  className="flex items-center gap-1.5 text-xs"
                >
                  <ImagePlus size={14} />
                  {imageUploading ? "Uploading…" : "Add Photo"}
                </Button>
              </div>

              <div className="flex gap-2 pt-1">
                <Button variant="outline" onClick={() => setModal(null)} className="flex-1">Cancel</Button>
                <Button onClick={submitEditListing} disabled={submitting || !editPlantName.trim() || !price} className="flex-1 bg-green-700 hover:bg-green-800">
                  {submitting ? "Saving…" : "Save Changes"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
