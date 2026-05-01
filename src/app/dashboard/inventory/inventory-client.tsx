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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  FileText, X, ImagePlus, Info,
  MoreHorizontal, SlidersHorizontal, AlertCircle, Check, Store, Gavel,
} from "lucide-react";
import * as XLSX from "xlsx";
import PotSizePicker from "@/components/pot-size-picker";

const CATEGORIES = [
  "Tropical", "Succulent", "Cactus", "Carnivorous", "Orchid",
  "Fern", "Herb", "Rare", "Seasonal", "Other",
];

const TOGGLEABLE_COLS = [
  { key: "variety",  label: "Variety" },
  { key: "category", label: "Category" },
  { key: "price",    label: "Price / Bid" },
  { key: "added",    label: "Added" },
] as const;
type ColKey = (typeof TOGGLEABLE_COLS)[number]["key"];

type Row = {
  id: string;
  plant_name: string;
  variety: string;
  quantity: number;
  listing_id: string | null;
  listing_quantity: number | null;
  listing_price_cents: number | null;
  listing_status: string | null;
  auction_id: string | null;
  auction_quantity: number | null;
  auction_bid_cents: number | null;
  auction_ends_at: string | null;
  auction_status: string | null;
  status: string;
  description: string;
  notes: string;
  images: string[];
  category: string | null;
  pot_size: string | null;
  created_at: string;
  archived_at: string | null;
};

type ActionModal =
  | { type: "listing"; row: Row }
  | { type: "auction"; row: Row }
  | { type: "edit"; row: Row }
  | { type: "sold"; row: Row }
  | null;

const statusColor: Record<string, string> = {
  "Draft":          "bg-muted text-muted-foreground",
  "In Shop":        "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
  "Shop + Auction": "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-400",
  "Paused":         "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400",
  "Sold Out":       "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400",
  "Live Auction":   "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  "Auction Ended":  "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400",
  "Archived":       "bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400",
};

const statusDot: Record<string, string> = {
  "Draft":          "bg-gray-400",
  "In Shop":        "bg-green-500",
  "Shop + Auction": "bg-teal-500",
  "Paused":         "bg-yellow-500",
  "Sold Out":       "bg-red-500",
  "Live Auction":   "bg-blue-500",
  "Auction Ended":  "bg-purple-500",
  "Archived":       "bg-orange-500",
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
  termsAccepted,
}: {
  activeRows: Row[];
  archivedRows: Row[];
  termsAccepted: boolean;
}) {
  const router = useRouter();

  const [tab, setTab] = useState<"active" | "archived">("active");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [sortCol, setSortCol] = useState<"plant_name" | "variety" | "quantity" | "created_at" | "status" | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [attentionFilter, setAttentionFilter] = useState(false);

  const [visibleCols, setVisibleCols] = useState<Set<ColKey>>(
    new Set<ColKey>(["variety", "category", "price", "added"])
  );

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkCategoryOpen, setBulkCategoryOpen] = useState(false);
  const [bulkCategory, setBulkCategory] = useState("");

  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string } | null>(null);

  const [modal, setModal] = useState<ActionModal>(null);
  const [price, setPrice] = useState("");
  const [listQty, setListQty] = useState("");
  const [startingBid, setStartingBid] = useState("");
  const [buyNowPrice, setBuyNowPrice] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [soldPrice, setSoldPrice] = useState("");
  const [soldQuantity, setSoldQuantity] = useState("1");
  const [soldNote, setSoldNote] = useState("");
  const [soldDate, setSoldDate] = useState("");

  const [editPlantName, setEditPlantName] = useState("");
  const [editVariety, setEditVariety] = useState("");
  const [editPotSize, setEditPotSize] = useState("");
  const [editQuantity, setEditQuantity] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editImages, setEditImages] = useState<string[]>([]);
  const [imageUploading, setImageUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [editingCell, setEditingCell] = useState<{ rowId: string } | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryValue, setEditingCategoryValue] = useState("");

  // ── Column visibility ──────────────────────────────────────────────────────
  function toggleCol(key: ColKey) {
    setVisibleCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }
  const col = (key: ColKey) => visibleCols.has(key);

  // ── Sort ──────────────────────────────────────────────────────────────────
  function toggleSort(c: typeof sortCol) {
    if (sortCol === c) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(c); setSortDir("asc"); }
  }
  function sortIndicator(c: typeof sortCol) {
    if (sortCol !== c) return "↕";
    return sortDir === "asc" ? "↑" : "↓";
  }

  // ── Inline quantity editing ────────────────────────────────────────────────
  function startEdit(rowId: string, current: number) {
    setEditingCell({ rowId });
    setEditingValue(String(current));
  }

  async function saveEdit() {
    if (!editingCell) return;
    const { rowId } = editingCell;
    const num = editingValue === "" ? null : Number(editingValue);
    setEditingCell(null);
    if (num !== null && isNaN(num)) return;
    const supabase = createClient();
    const { error } = await supabase.from("inventory").update({ quantity: num ?? 0 }).eq("id", rowId);
    if (error) toast.error(error.message); else router.refresh();
  }

  function cancelEdit() { setEditingCell(null); }

  // ── Bulk actions ──────────────────────────────────────────────────────────
  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === rows.length && rows.length > 0) setSelectedIds(new Set());
    else setSelectedIds(new Set(rows.map((r) => r.id)));
  }

  async function bulkArchive() {
    if (!selectedIds.size) { toast.error("Select items to archive"); return; }
    setBulkLoading(true);
    const supabase = createClient();
    const { error } = await supabase.from("inventory").update({ archived_at: new Date().toISOString() }).in("id", [...selectedIds]);
    setBulkLoading(false);
    if (error) toast.error(error.message);
    else { toast.success(`${selectedIds.size} item${selectedIds.size !== 1 ? "s" : ""} archived`); setSelectedIds(new Set()); router.refresh(); }
  }

  async function bulkSetCategory() {
    if (!bulkCategory) { toast.error("Select a category"); return; }
    setBulkLoading(true);
    const supabase = createClient();
    await supabase.from("inventory").update({ category: bulkCategory }).in("id", [...selectedIds]);
    setBulkLoading(false);
    setBulkCategoryOpen(false);
    setBulkCategory("");
    toast.success("Category updated.");
    setSelectedIds(new Set());
    router.refresh();
  }

  // ── Modal helpers ─────────────────────────────────────────────────────────
  function openModal(type: "listing" | "auction" | "edit" | "sold", row: Row) {
    if ((type === "listing" || type === "auction") && !termsAccepted) {
      router.push("/seller-agreement?next=/dashboard/inventory");
      return;
    }
    setPrice("");
    setStartingBid(""); setBuyNowPrice(""); setEndsAt("");
    setEditPlantName(row.plant_name);
    setEditVariety(row.variety);
    setEditQuantity(String(row.quantity));
    setEditDescription(row.description);
    setEditNotes(row.notes);
    setEditCategory(row.category ?? "");
    setEditPotSize(row.pot_size ?? "");
    setEditImages([...row.images]);

    if (type === "sold") {
      setSoldPrice(""); setSoldQuantity("1"); setSoldNote("");
      setSoldDate(new Date().toISOString().split("T")[0]);
    }
    if (type === "listing") {
      const avail = row.quantity - (row.auction_quantity ?? 0);
      setListQty(String(Math.max(1, avail)));
    }
    if (type === "auction") {
      const avail = row.quantity - (row.listing_quantity ?? 0);
      setListQty(String(Math.max(1, avail)));
    }
    setModal({ type, row });
  }

  // ── Photo helpers ─────────────────────────────────────────────────────────
  async function handleImageAdd(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setImageUploading(true);
    const supabase = createClient();
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `inventory/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("listings").upload(path, file);
    if (error) { toast.error("Upload failed: " + error.message); setImageUploading(false); return; }
    const { data } = supabase.storage.from("listings").getPublicUrl(path);
    setEditImages((prev) => [...prev, data.publicUrl]);
    setImageUploading(false);
  }

  function removeEditImage(url: string) { setEditImages((prev) => prev.filter((u) => u !== url)); }

  // ── CRUD ──────────────────────────────────────────────────────────────────
  async function submitListing() {
    if (!modal || modal.type !== "listing") return;
    setSubmitting(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Not logged in"); setSubmitting(false); return; }
    const available = modal.row.quantity - (modal.row.auction_quantity ?? 0);
    const qty = Math.min(Math.max(1, Number(listQty) || available), available);
    if (qty < 1) { toast.error("No stock available to list"); setSubmitting(false); return; }
    const { data: newListing, error } = await supabase.from("listings").insert({
      seller_id: user.id,
      plant_name: modal.row.plant_name,
      variety: modal.row.variety || null,
      quantity: qty,
      description: modal.row.description || null,
      price_cents: dollarsToCents(price),
      images: modal.row.images,
      category: modal.row.category || null,
      pot_size: modal.row.pot_size || null,
      inventory_id: modal.row.id,
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
    const available = modal.row.quantity - (modal.row.listing_quantity ?? 0);
    const qty = Math.min(Math.max(1, Number(listQty) || available), available);
    if (qty < 1) { toast.error("No stock available for auction"); setSubmitting(false); return; }
    const { data: newAuction, error } = await supabase.from("auctions").insert({
      seller_id: user.id,
      plant_name: modal.row.plant_name,
      variety: modal.row.variety || null,
      quantity: qty,
      description: modal.row.description || null,
      starting_bid_cents: dollarsToCents(startingBid),
      current_bid_cents: dollarsToCents(startingBid),
      buy_now_price_cents: buyNowPrice ? dollarsToCents(buyNowPrice) : null,
      ends_at: new Date(endsAt).toISOString(),
      images: modal.row.images,
      category: modal.row.category || null,
      pot_size: modal.row.pot_size || null,
      inventory_id: modal.row.id,
    }).select("id").single();
    if (error) { toast.error(error.message); setSubmitting(false); return; }
    await supabase.from("inventory").update({ auction_id: newAuction.id, auction_quantity: qty }).eq("id", modal.row.id);
    setSubmitting(false);
    toast.success(`Auction started for ${modal.row.plant_name}!`);
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
      pot_size: editPotSize || null,
      images: editImages,
    }).eq("id", modal.row.id);
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Item updated.");
    setModal(null);
    router.refresh();
  }

  async function submitSold() {
    if (!modal || modal.type !== "sold") return;
    const qty = Math.max(1, Math.min(Number(soldQuantity) || 1, modal.row.quantity));
    const priceCents = dollarsToCents(soldPrice);
    if (!soldPrice || priceCents <= 0) { toast.error("Enter a sale price"); return; }
    setSubmitting(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Not logged in"); setSubmitting(false); return; }
    const { error: saleError } = await supabase.from("manual_sales").insert({
      seller_id: user.id,
      inventory_id: modal.row.id,
      plant_name: modal.row.plant_name,
      variety: modal.row.variety || null,
      price_cents: priceCents,
      quantity: qty,
      note: soldNote || null,
      sold_at: soldDate ? new Date(soldDate + "T12:00:00").toISOString() : new Date().toISOString(),
    });
    if (saleError) { toast.error(saleError.message); setSubmitting(false); return; }
    const newQty = modal.row.quantity - qty;
    if (newQty <= 0) {
      await supabase.from("inventory").update({ quantity: 0, archived_at: new Date().toISOString() }).eq("id", modal.row.id);
    } else {
      await supabase.from("inventory").update({ quantity: newQty }).eq("id", modal.row.id);
    }
    setSubmitting(false);
    toast.success(newQty <= 0 ? `${qty} sold — item archived (out of stock)` : `${qty} sold · ${newQty} remaining`);
    setModal(null);
    router.refresh();
  }

  async function cloneItem(row: Row) {
    const cloneKey = row.id + "_clone";
    setLoadingId(cloneKey);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Not logged in"); setLoadingId(null); return; }
    const { data: newItem, error } = await supabase.from("inventory").insert({
      seller_id: user.id,
      plant_name: `${row.plant_name} (copy)`,
      variety: row.variety || null,
      quantity: row.quantity,
      description: row.description || null,
      notes: row.notes || null,
      images: row.images,
      category: row.category || null,
    }).select("id").single();
    setLoadingId(null);
    if (error || !newItem) { toast.error(error?.message ?? "Clone failed"); return; }
    const cloneRow: Row = {
      ...row, id: newItem.id, plant_name: `${row.plant_name} (copy)`,
      listing_id: null, listing_quantity: null, listing_price_cents: null, listing_status: null,
      auction_id: null, auction_quantity: null, auction_bid_cents: null, auction_ends_at: null, auction_status: null,
      status: "Draft",
    };
    setFlashId(newItem.id);
    setTimeout(() => setFlashId(null), 3000);
    toast.success("Item cloned.", {
      action: { label: "Edit now", onClick: () => openModal("edit", cloneRow) },
    });
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

  async function confirmDelete() {
    if (!deleteConfirm) return;
    await archiveItem(deleteConfirm.id);
    setDeleteConfirm(null);
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
    const data = exportRows.map((r) => {
      const avail = r.quantity - (r.listing_quantity ?? 0) - (r.auction_quantity ?? 0);
      return {
        "Plant Name": r.plant_name, "Variety": r.variety, "Category": r.category ?? "",
        "Total Stock": r.quantity, "In Shop": r.listing_quantity ?? 0,
        "In Auction": r.auction_quantity ?? 0, "Available": avail,
        "Status": r.status, "Description": r.description,
        "Date Added": new Date(r.created_at).toLocaleDateString(),
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory");
    XLSX.writeFile(wb, "plantet-inventory.xlsx");
  }

  function exportPDF(exportRows: Row[]) {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Plantet Inventory</title>
      <style>body{font-family:Arial,sans-serif;font-size:12px;padding:20px}h1{font-size:18px;margin-bottom:4px}
      p{color:#666;margin-bottom:16px;font-size:11px}table{width:100%;border-collapse:collapse}
      th{background:#166534;color:white;padding:8px 10px;text-align:left;font-size:11px}
      td{padding:7px 10px;border-bottom:1px solid #e5e7eb;font-size:11px}
      tr:nth-child(even) td{background:#f9fafb}</style></head><body>
      <h1>Plantet — Inventory Report</h1>
      <p>Generated ${new Date().toLocaleDateString()} · ${exportRows.length} item${exportRows.length !== 1 ? "s" : ""}</p>
      <table><thead><tr><th>Plant Name</th><th>Variety</th><th>Category</th><th>Total</th><th>In Shop</th><th>In Auction</th><th>Available</th><th>Status</th></tr></thead>
      <tbody>${exportRows.map((r) => {
        const avail = r.quantity - (r.listing_quantity ?? 0) - (r.auction_quantity ?? 0);
        return `<tr><td>${r.plant_name}</td><td>${r.variety || "—"}</td><td>${r.category || "—"}</td><td>${r.quantity}</td><td>${r.listing_quantity ?? 0}</td><td>${r.auction_quantity ?? 0}</td><td>${avail}</td><td>${r.status}</td></tr>`;
      }).join("")}</tbody>
      </table><script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}<\/script></body></html>`);
    printWindow.document.close();
  }

  // ── Filter + sort pipeline ────────────────────────────────────────────────
  const allRows = tab === "active" ? activeRows : archivedRows;
  const allCategories = ["All", ...Array.from(new Set(allRows.map((r) => r.category).filter((c): c is string => c !== null && c !== ""))).values()];
  const statusCounts = allRows.reduce<Record<string, number>>((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});

  const needsAttentionRows = allRows.filter((r) =>
    r.images.length === 0 || r.status === "Sold Out" || !r.description.trim()
  );

  const afterStatusFilter = statusFilter !== "All" ? allRows.filter((r) => r.status === statusFilter) : allRows;
  const afterCategoryFilter = categoryFilter !== "All" ? afterStatusFilter.filter((r) => r.category === categoryFilter) : afterStatusFilter;
  const afterAttentionFilter = attentionFilter
    ? afterCategoryFilter.filter((r) => needsAttentionRows.some((n) => n.id === r.id))
    : afterCategoryFilter;
  const filtered = search.trim()
    ? afterAttentionFilter.filter((r) => {
        const q = search.toLowerCase();
        return r.plant_name.toLowerCase().includes(q) || r.variety.toLowerCase().includes(q);
      })
    : afterAttentionFilter;
  const rows = sortCol
    ? [...filtered].sort((a, b) => {
        if (sortCol === "quantity") return sortDir === "asc" ? a.quantity - b.quantity : b.quantity - a.quantity;
        if (sortCol === "created_at") {
          const ad = new Date(a.created_at).getTime(), bd = new Date(b.created_at).getTime();
          return sortDir === "asc" ? ad - bd : bd - ad;
        }
        const av = ((sortCol === "status" ? a.status : a[sortCol as "plant_name" | "variety"]) ?? "").toLowerCase();
        const bv = ((sortCol === "status" ? b.status : b[sortCol as "plant_name" | "variety"]) ?? "").toLowerCase();
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      })
    : filtered;

  const totalListedValue = rows.reduce((sum, r) => sum + (r.listing_price_cents !== null ? r.listing_price_cents * (r.listing_quantity ?? 0) : 0), 0);

  // ── Render helpers ────────────────────────────────────────────────────────
  function stockCell(row: Row) {
    const available = row.quantity - (row.listing_quantity ?? 0) - (row.auction_quantity ?? 0);
    const hasAllocations = (row.listing_quantity ?? 0) > 0 || (row.auction_quantity ?? 0) > 0;

    return (
      <div>
        {editingCell?.rowId === row.id ? (
          <input type="number" min={0} value={editingValue}
            onChange={(e) => setEditingValue(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") cancelEdit(); }}
            autoFocus className="w-16 px-1.5 py-0.5 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-green-600" />
        ) : (
          <button onClick={() => startEdit(row.id, row.quantity)}
            className="font-medium hover:text-green-700 hover:underline tabular-nums" title="Click to edit total stock">
            {row.quantity}
          </button>
        )}
        {hasAllocations && (
          <div className="text-xs mt-0.5 space-y-0.5">
            {(row.listing_quantity ?? 0) > 0 && <div className="text-green-600">{row.listing_quantity} in shop</div>}
            {(row.auction_quantity ?? 0) > 0 && <div className="text-blue-600">{row.auction_quantity} in auction</div>}
            <div className="text-muted-foreground">{available} available</div>
          </div>
        )}
      </div>
    );
  }

  function priceBidCell(row: Row) {
    const parts: string[] = [];
    if (row.listing_price_cents) parts.push(centsToDisplay(row.listing_price_cents));
    if (row.auction_bid_cents) parts.push(`${centsToDisplay(row.auction_bid_cents)} bid`);
    return <span className="text-muted-foreground text-sm">{parts.join(" · ") || "—"}</span>;
  }

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

    const available = row.quantity - (row.listing_quantity ?? 0) - (row.auction_quantity ?? 0);
    const cloneKey = row.id + "_clone";

    return (
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => openModal("edit", row)} className="text-xs text-foreground hover:underline font-medium">Edit</button>
        <button onClick={() => openModal("sold", row)} className="text-xs text-orange-600 hover:underline font-medium">Sold</button>

        {row.listing_id ? (
          <Link href="/dashboard/listings" className="inline-flex items-center gap-0.5 text-xs text-green-700 hover:underline font-medium">
            <Store size={11} />Listing
          </Link>
        ) : available > 0 ? (
          <button onClick={() => openModal("listing", row)} className="text-xs text-green-700 hover:underline font-medium">List in Shop</button>
        ) : null}

        {row.auction_id ? (
          <Link href="/dashboard/auctions" className="inline-flex items-center gap-0.5 text-xs text-blue-600 hover:underline font-medium">
            <Gavel size={11} />Auction
          </Link>
        ) : available > 0 ? (
          <button onClick={() => openModal("auction", row)} className="text-xs text-purple-600 hover:underline font-medium">Auction</button>
        ) : null}

        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center justify-center w-6 h-6 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="More actions">
            <MoreHorizontal size={14} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[160px]">
            <DropdownMenuItem onClick={() => cloneItem(row)} disabled={loadingId === cloneKey}>
              {loadingId === cloneKey ? "Cloning…" : "Clone"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setDeleteConfirm({ id: row.id })} className="text-destructive focus:text-destructive">
              Archive
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  function categoryCell(row: Row) {
    if (editingCategoryId === row.id) {
      const doSave = (v: string | null) => {
        const saveVal = !v || v === "_none" ? null : v;
        const id = row.id;
        setEditingCategoryId(null);
        const supabase = createClient();
        supabase.from("inventory").update({ category: saveVal } as never).eq("id", id).then(({ error }) => {
          if (error) toast.error(error.message); else router.refresh();
        });
      };
      return (
        <Select defaultOpen value={editingCategoryValue || "_none"} onValueChange={doSave} onOpenChange={(open) => { if (!open) setEditingCategoryId(null); }}>
          <SelectTrigger className="h-7 text-xs max-w-[120px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">— None —</SelectItem>
            {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    }
    return (
      <button onClick={() => { setEditingCategoryId(row.id); setEditingCategoryValue(row.category ?? ""); }}
        className={cn("text-xs hover:underline hover:text-green-700", row.category ? "text-foreground" : "text-muted-foreground")}
        title="Click to edit category">
        {row.category ?? "—"}
      </button>
    );
  }

  function PhotoSection({ refProp }: { refProp: React.RefObject<HTMLInputElement | null> }) {
    return (
      <div className="space-y-2">
        <Label>Photos</Label>
        {editImages.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {editImages.map((url, idx) => (
              <div key={url + idx} className="relative group">
                <img src={url} alt="" className="w-16 h-16 rounded object-cover border" />
                <button type="button" onClick={() => removeEditImage(url)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}
        <input ref={refProp} type="file" accept="image/*" className="hidden" onChange={handleImageAdd} />
        <Button type="button" variant="outline" size="sm" onClick={() => refProp.current?.click()} disabled={imageUploading} className="flex items-center gap-1.5 text-xs">
          <ImagePlus size={14} />{imageUploading ? "Uploading…" : "Add Photo"}
        </Button>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
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

      <div className="flex gap-1 border-b mb-6">
        {(["active", "archived"] as const).map((t) => (
          <button key={t} onClick={() => { setTab(t); setSelectedIds(new Set()); setStatusFilter("All"); setCategoryFilter("All"); setAttentionFilter(false); }} className={cn(
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

      <div className="flex flex-col sm:flex-row gap-3 mb-4 flex-wrap items-center">
        <Input placeholder="Search by plant name or variety…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        {allCategories.length > 1 && (
          <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v ?? "All")}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="All categories" /></SelectTrigger>
            <SelectContent>
              {allCategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {needsAttentionRows.length > 0 && (
          <button
            onClick={() => setAttentionFilter((f) => !f)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition-all",
              attentionFilter
                ? "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/40 dark:text-orange-400 dark:border-orange-700"
                : "bg-background text-muted-foreground border-border hover:border-orange-400 hover:text-orange-600"
            )}
          >
            <AlertCircle size={12} />
            {needsAttentionRows.length} need{needsAttentionRows.length === 1 ? "s" : ""} attention
          </button>
        )}
        {statusFilter !== "All" && rows.length > 0 && (
          <button onClick={() => setSelectedIds(new Set(rows.map((r) => r.id)))} className="text-xs text-green-700 hover:underline">
            Select all {rows.length} visible
          </button>
        )}
        <div className="sm:ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}>
              <SlidersHorizontal size={14} /> Columns
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[160px]">
              {TOGGLEABLE_COLS.map(({ key, label }) => (
                <DropdownMenuItem key={key} onClick={() => toggleCol(key)} className="gap-2">
                  <span className={cn("w-4 h-4 flex items-center justify-center", visibleCols.has(key) ? "text-green-700" : "text-transparent")}>
                    <Check size={13} />
                  </span>
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {tab === "archived" && archivedRows.length > 0 && (
        <div className="mb-4 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700">
          Archived items are permanently deleted after 30 days. Restore an item to keep it.
        </div>
      )}

      {Object.keys(statusCounts).length > 1 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {Object.entries(statusCounts).map(([status, count]) => (
            <button
              key={status}
              onClick={() => setStatusFilter(statusFilter === status ? "All" : status)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-all",
                statusFilter === status
                  ? (statusColor[status] ?? "bg-gray-100 text-gray-600") + " border-transparent"
                  : "bg-background text-muted-foreground border-border hover:border-green-400 hover:text-foreground"
              )}
            >
              <span className={cn("w-2 h-2 rounded-full shrink-0", statusDot[status] ?? "bg-gray-400")} />
              {status} <span className="opacity-60">({count})</span>
            </button>
          ))}
          {statusFilter !== "All" && (
            <button onClick={() => setStatusFilter("All")} className="text-xs text-muted-foreground hover:text-foreground underline self-center">Clear</button>
          )}
        </div>
      )}

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 mb-4 px-4 py-2.5 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg text-sm">
          <span className="font-medium text-green-800 dark:text-green-300">{selectedIds.size} selected</span>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={bulkArchive} disabled={bulkLoading} className="text-xs h-7">Archive selected</Button>
            <Button size="sm" variant="outline" onClick={() => setBulkCategoryOpen(true)} disabled={bulkLoading} className="text-xs h-7">Set category</Button>
          </div>
          <button onClick={() => setSelectedIds(new Set())} className="ml-auto text-xs text-muted-foreground hover:text-foreground">Clear</button>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-4xl mb-4">{tab === "archived" ? "🗑️" : "📦"}</p>
          <p className="font-medium">
            {search.trim() ? `No results for "${search}"` : attentionFilter ? "No items need attention right now" : tab === "archived" ? "No archived items" : "No inventory yet"}
          </p>
          {tab === "active" && !search.trim() && !attentionFilter && (
            <Link href="/dashboard/create" className={cn(buttonVariants(), "mt-6 bg-green-700 hover:bg-green-800")}>+ Add Inventory</Link>
          )}
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {rows.map((row) => {
              const available = row.quantity - (row.listing_quantity ?? 0) - (row.auction_quantity ?? 0);
              return (
                <div key={row.id} className={cn("rounded-lg border bg-card p-4 space-y-3", flashId === row.id && "ring-2 ring-green-400 bg-green-50/30 dark:bg-green-950/10")}>
                  <div className="flex gap-3 items-start">
                    <input type="checkbox" checked={selectedIds.has(row.id)} onChange={() => toggleSelect(row.id)} className="mt-0.5 rounded border-border shrink-0" />
                    <Thumb images={row.images} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-medium truncate">{row.plant_name}</p>
                        {row.notes && <span title={row.notes} className="shrink-0 cursor-default"><FileText size={13} className="text-muted-foreground" /></span>}
                        {row.images.length === 0 && <span title="No photos" className="shrink-0 cursor-default"><AlertCircle size={13} className="text-orange-400" /></span>}
                      </div>
                      {row.variety && <p className="text-sm text-muted-foreground truncate">{row.variety}</p>}
                      {row.category && <span className="inline-block text-xs text-green-700 bg-green-100 dark:bg-green-900/40 dark:text-green-400 px-1.5 py-0.5 rounded-full mt-0.5">{row.category}</span>}
                    </div>
                    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium shrink-0", statusColor[row.status] ?? "bg-gray-100 text-gray-600")}>{row.status}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Total</p>
                      <p className="font-medium">{row.quantity}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Available</p>
                      <p className="font-medium">{available}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Allocated</p>
                      <div className="text-xs">
                        {(row.listing_quantity ?? 0) > 0 && <p className="text-green-600">{row.listing_quantity} shop</p>}
                        {(row.auction_quantity ?? 0) > 0 && <p className="text-blue-600">{row.auction_quantity} auction</p>}
                        {!(row.listing_quantity) && !(row.auction_quantity) && <p className="text-muted-foreground">—</p>}
                      </div>
                    </div>
                  </div>
                  <div>{rowActions(row)}</div>
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="w-10 px-3 py-3">
                    <input type="checkbox" checked={selectedIds.size === rows.length && rows.length > 0} onChange={toggleSelectAll} className="rounded border-border" />
                  </th>
                  <th className="w-12 px-2 py-3"></th>
                  <th className="text-left px-4 py-3 font-medium">
                    <button onClick={() => toggleSort("plant_name")} className="flex items-center gap-1 hover:text-foreground transition-colors">Plant <span className="text-xs">{sortIndicator("plant_name")}</span></button>
                  </th>
                  {col("variety") && (
                    <th className="text-left px-4 py-3 font-medium">
                      <button onClick={() => toggleSort("variety")} className="flex items-center gap-1 hover:text-foreground transition-colors">Variety <span className="text-xs">{sortIndicator("variety")}</span></button>
                    </th>
                  )}
                  {col("category") && <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Category</th>}
                  <th className="text-left px-4 py-3 font-medium">
                    <button onClick={() => toggleSort("quantity")} className="flex items-center gap-1 hover:text-foreground transition-colors">
                      Stock
                      <span className="cursor-default text-muted-foreground" title="Total stock. Shows breakdown when allocated to listings or auctions."><Info size={12} /></span>
                      <span className="text-xs">{sortIndicator("quantity")}</span>
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 font-medium">
                    <button onClick={() => toggleSort("status")} className="flex items-center gap-1 hover:text-foreground transition-colors">Status <span className="text-xs">{sortIndicator("status")}</span></button>
                  </th>
                  {col("price") && <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Price / Bid</th>}
                  {col("added") && (
                    <th className="text-left px-4 py-3 font-medium hidden xl:table-cell">
                      <button onClick={() => toggleSort("created_at")} className="flex items-center gap-1 hover:text-foreground transition-colors">Added <span className="text-xs">{sortIndicator("created_at")}</span></button>
                    </th>
                  )}
                  <th className="text-left px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.id} className={cn(
                    i % 2 === 0 ? "bg-card" : "bg-muted/20",
                    selectedIds.has(row.id) && "ring-1 ring-inset ring-green-400/50 bg-green-50/30 dark:bg-green-950/10",
                    flashId === row.id && "ring-2 ring-inset ring-green-500 bg-green-50/40 dark:bg-green-950/20"
                  )}>
                    <td className="px-3 py-3"><input type="checkbox" checked={selectedIds.has(row.id)} onChange={() => toggleSelect(row.id)} className="rounded border-border" /></td>
                    <td className="px-2 py-3"><Thumb images={row.images} /></td>
                    <td className="px-4 py-3 font-medium">
                      <div className="flex items-center gap-1.5">
                        {row.plant_name}
                        {row.notes && <span title={row.notes} className="shrink-0 cursor-default"><FileText size={13} className="text-muted-foreground" /></span>}
                        {row.images.length === 0 && <span title="No photos" className="shrink-0 cursor-default"><AlertCircle size={13} className="text-orange-400" /></span>}
                      </div>
                    </td>
                    {col("variety") && <td className="px-4 py-3 text-muted-foreground">{row.variety || "—"}</td>}
                    {col("category") && <td className="px-4 py-3 hidden lg:table-cell">{categoryCell(row)}</td>}
                    <td className="px-4 py-3">{stockCell(row)}</td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", statusColor[row.status] ?? "bg-gray-100 text-gray-600")}>{row.status}</span>
                    </td>
                    {col("price") && <td className="px-4 py-3 hidden md:table-cell">{priceBidCell(row)}</td>}
                    {col("added") && <td className="px-4 py-3 text-muted-foreground text-xs hidden xl:table-cell">{new Date(row.created_at).toLocaleDateString()}</td>}
                    <td className="px-4 py-3">{rowActions(row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-wrap gap-4 px-1 text-sm text-muted-foreground">
            <span>{rows.length < allRows.length ? `Showing ${rows.length} of ${allRows.length} items` : `${rows.length} item${rows.length !== 1 ? "s" : ""}`}</span>
            {totalListedValue > 0 && <span>Listed value: <span className="font-semibold text-foreground">{centsToDisplay(totalListedValue)}</span></span>}
          </div>
        </>
      )}

      {/* Delete confirm */}
      <Dialog open={!!deleteConfirm} onOpenChange={(o) => !o && setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Archive item?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground mt-1">This moves the item to your archive. You can restore it within 30 days.</p>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)} className="flex-1">Cancel</Button>
            <Button onClick={confirmDelete} disabled={!!loadingId} className="flex-1 bg-orange-600 hover:bg-orange-700">Archive</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk category */}
      <Dialog open={bulkCategoryOpen} onOpenChange={(o) => { if (!o) setBulkCategoryOpen(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Set Category</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-1">
            <p className="text-sm text-muted-foreground">Apply a category to {selectedIds.size} selected item{selectedIds.size !== 1 ? "s" : ""}.</p>
            <Select value={bulkCategory || "_none"} onValueChange={(v) => setBulkCategory(v === "_none" ? "" : (v ?? ""))}>
              <SelectTrigger><SelectValue placeholder="Select category…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">— None —</SelectItem>
                {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setBulkCategoryOpen(false)} className="flex-1">Cancel</Button>
              <Button onClick={bulkSetCategory} disabled={bulkLoading || !bulkCategory} className="flex-1 bg-green-700 hover:bg-green-800">
                {bulkLoading ? "Saving…" : "Apply"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* List in Shop modal */}
      <Dialog open={modal?.type === "listing"} onOpenChange={(o) => !o && setModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>List in Shop</DialogTitle></DialogHeader>
          {modal && modal.type === "listing" && (() => {
            const available = modal.row.quantity - (modal.row.auction_quantity ?? 0);
            return (
              <div className="space-y-4 mt-1">
                <p className="text-sm text-muted-foreground">Listing <span className="font-medium text-foreground">{modal.row.plant_name}</span>{modal.row.variety ? ` — ${modal.row.variety}` : ""} in your shop.</p>
                <div className="space-y-1">
                  <Label htmlFor="modal-price">Price per item ($) *</Label>
                  <Input id="modal-price" type="number" min={0.01} step={0.01} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" autoFocus />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="modal-list-qty">Quantity to list *</Label>
                  <Input id="modal-list-qty" type="number" min={1} max={available} step={1} value={listQty} onChange={(e) => setListQty(e.target.value)} />
                  <p className="text-xs text-muted-foreground">{available} available · {modal.row.quantity} total stock</p>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" onClick={() => setModal(null)} className="flex-1">Cancel</Button>
                  <Button onClick={submitListing} disabled={submitting || !price || !listQty} className="flex-1 bg-green-700 hover:bg-green-800">{submitting ? "Publishing…" : "Go Live"}</Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Auction modal */}
      <Dialog open={modal?.type === "auction"} onOpenChange={(o) => !o && setModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Create Auction</DialogTitle></DialogHeader>
          {modal && modal.type === "auction" && (() => {
            const available = modal.row.quantity - (modal.row.listing_quantity ?? 0);
            return (
              <div className="space-y-4 mt-1">
                <p className="text-sm text-muted-foreground">Starting an auction for <span className="font-medium text-foreground">{modal.row.plant_name}</span>{modal.row.variety ? ` — ${modal.row.variety}` : ""}.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="modal-bid">Starting Bid ($) *</Label>
                    <Input id="modal-bid" type="number" min={0.01} step={0.01} value={startingBid} onChange={(e) => setStartingBid(e.target.value)} placeholder="0.00" autoFocus />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="modal-auction-qty">Quantity *</Label>
                    <Input id="modal-auction-qty" type="number" min={1} max={available} step={1} value={listQty} onChange={(e) => setListQty(e.target.value)} />
                    <p className="text-xs text-muted-foreground">{available} available</p>
                  </div>
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
                  <Button onClick={submitAuction} disabled={submitting || !startingBid || !endsAt || !listQty} className="flex-1 bg-green-700 hover:bg-green-800">{submitting ? "Starting…" : "Start Auction"}</Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Edit item modal */}
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
                <Label>Pot Size <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <PotSizePicker value={editPotSize} onChange={setEditPotSize} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-qty">Total quantity</Label>
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
              <PhotoSection refProp={imageInputRef} />
              <div className="flex gap-2 pt-1">
                <Button variant="outline" onClick={() => setModal(null)} className="flex-1">Cancel</Button>
                <Button onClick={submitEdit} disabled={submitting || !editPlantName.trim()} className="flex-1 bg-green-700 hover:bg-green-800">{submitting ? "Saving…" : "Save Changes"}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Mark as Sold modal */}
      <Dialog open={modal?.type === "sold"} onOpenChange={(o) => !o && setModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Mark as Sold</DialogTitle></DialogHeader>
          {modal && (
            <div className="space-y-4 mt-1">
              <p className="text-sm text-muted-foreground">
                Record an off-platform sale for{" "}
                <span className="font-medium text-foreground">{modal.row.plant_name}{modal.row.variety ? ` — ${modal.row.variety}` : ""}</span>.
                {" "}This will update your inventory and appear in analytics as an off-platform sale.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="sold-price">Sale price ($) *</Label>
                  <Input id="sold-price" type="number" min={0.01} step={0.01} placeholder="0.00" value={soldPrice} onChange={(e) => setSoldPrice(e.target.value)} autoFocus />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="sold-qty">Quantity *</Label>
                  <Input id="sold-qty" type="number" min={1} max={modal.row.quantity} step={1} value={soldQuantity} onChange={(e) => setSoldQuantity(e.target.value)} />
                  <p className="text-xs text-muted-foreground">{modal.row.quantity} total</p>
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="sold-date">Date sold</Label>
                <Input id="sold-date" type="date" value={soldDate} onChange={(e) => setSoldDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sold-note">Note <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <Input id="sold-note" placeholder="e.g. Farmers market, local pickup…" value={soldNote} onChange={(e) => setSoldNote(e.target.value)} maxLength={200} />
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" onClick={() => setModal(null)} className="flex-1">Cancel</Button>
                <Button onClick={submitSold} disabled={submitting || !soldPrice || Number(soldPrice) <= 0 || !soldQuantity || Number(soldQuantity) < 1} className="flex-1 bg-orange-600 hover:bg-orange-700 text-white">
                  {submitting ? "Saving…" : "Record Sale"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
