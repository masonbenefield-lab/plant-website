"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { dollarsToCents, centsToDisplay } from "@/lib/stripe";
import {
  ChevronRight, ChevronDown, MoreHorizontal, Plus,
  ImagePlus, X, Store, Gavel, Pencil, HelpCircle,
} from "lucide-react";
import * as XLSX from "xlsx";
import PotSizePicker from "@/components/pot-size-picker";
import PriceSuggestion from "@/components/price-suggestion";
import { findProhibitedWord, censorWord, logViolation } from "@/lib/profanity";

const CATEGORIES = [
  "Tropical", "Succulent", "Cactus", "Carnivorous", "Orchid",
  "Fern", "Herb", "Rare", "Seasonal", "Other",
];

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

type PlantGroup = {
  key: string;
  plant_name: string;
  variety: string;
  variants: Row[];
};

type UnlinkedListing = {
  id: string;
  plant_name: string;
  variety: string;
  quantity: number;
  price_cents: number;
  status: string;
  images: string[];
  category: string | null;
  pot_size: string | null;
  description: string;
};

type UnlinkedAuction = {
  id: string;
  plant_name: string;
  variety: string;
  quantity: number;
  current_bid_cents: number;
  ends_at: string;
  status: string;
  images: string[];
  category: string | null;
  pot_size: string | null;
  description: string;
};

type UnlinkedGroup = {
  key: string;
  plant_name: string;
  variety: string;
  listings: UnlinkedListing[];
  auctions: UnlinkedAuction[];
};

function groupUnlinked(listings: UnlinkedListing[], auctions: UnlinkedAuction[]): UnlinkedGroup[] {
  const map = new Map<string, UnlinkedGroup>();
  for (const l of listings) {
    const key = `${l.plant_name.toLowerCase()}|||${l.variety.toLowerCase()}`;
    if (!map.has(key)) map.set(key, { key, plant_name: l.plant_name, variety: l.variety, listings: [], auctions: [] });
    map.get(key)!.listings.push(l);
  }
  for (const a of auctions) {
    const key = `${a.plant_name.toLowerCase()}|||${a.variety.toLowerCase()}`;
    if (!map.has(key)) map.set(key, { key, plant_name: a.plant_name, variety: a.variety, listings: [], auctions: [] });
    map.get(key)!.auctions.push(a);
  }
  return Array.from(map.values()).sort((a, b) =>
    a.plant_name.localeCompare(b.plant_name) || a.variety.localeCompare(b.variety)
  );
}

type ModalState =
  | { type: "listing"; row: Row }
  | { type: "edit-listing"; row: Row }
  | { type: "auction"; row: Row }
  | { type: "edit"; row: Row }
  | { type: "sold"; row: Row }
  | { type: "add-variant"; plant_name: string; variety: string; category: string | null }
  | null;

function daysUntilPurge(archivedAt: string) {
  const purge = new Date(archivedAt).getTime() + 30 * 24 * 60 * 60 * 1000;
  return Math.max(0, Math.ceil((purge - Date.now()) / (1000 * 60 * 60 * 24)));
}

function groupRows(rows: Row[]): PlantGroup[] {
  const map = new Map<string, PlantGroup>();
  for (const row of rows) {
    const key = `${row.plant_name.toLowerCase()}|||${(row.variety ?? "").toLowerCase()}`;
    if (!map.has(key)) map.set(key, { key, plant_name: row.plant_name, variety: row.variety, variants: [] });
    map.get(key)!.variants.push(row);
  }
  for (const g of map.values()) {
    g.variants.sort((a, b) => (a.pot_size ?? "zzz").localeCompare(b.pot_size ?? "zzz"));
  }
  return Array.from(map.values()).sort((a, b) =>
    a.plant_name.localeCompare(b.plant_name) || a.variety.localeCompare(b.variety)
  );
}

export default function InventoryClient({
  activeRows,
  archivedRows,
  termsAccepted,
  unlinkedListings,
  unlinkedAuctions,
  initialSearch = "",
  initialCategory = "",
}: {
  activeRows: Row[];
  archivedRows: Row[];
  termsAccepted: boolean;
  unlinkedListings: UnlinkedListing[];
  unlinkedAuctions: UnlinkedAuction[];
  initialSearch?: string;
  initialCategory?: string;
}) {
  const router = useRouter();
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const groups = groupRows(activeRows);
    if (groups.length <= 5) return new Set(groups.map(g => g.key));
    return new Set();
  });
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState(initialSearch);
  const [categoryFilter, setCategoryFilter] = useState(initialCategory);
  const [modal, setModal] = useState<ModalState>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Inline qty edit
  const [editingQtyId, setEditingQtyId] = useState<string | null>(null);
  const [editingQtyValue, setEditingQtyValue] = useState("");

  // Listing modal
  const [price, setPrice] = useState("");
  const [listQty, setListQty] = useState("");

  // Auction modal
  const [startingBid, setStartingBid] = useState("");
  const [buyNowPrice, setBuyNowPrice] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [auctionQty, setAuctionQty] = useState("");

  // Edit item modal
  const [editPlantName, setEditPlantName] = useState("");
  const [editVariety, setEditVariety] = useState("");
  const [editPotSize, setEditPotSize] = useState("");
  const [editQuantity, setEditQuantity] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editImages, setEditImages] = useState<string[]>([]);
  const [imageUploading, setImageUploading] = useState(false);

  // Sold modal
  const [soldPrice, setSoldPrice] = useState("");
  const [soldQuantity, setSoldQuantity] = useState("1");
  const [soldNote, setSoldNote] = useState("");
  const [soldDate, setSoldDate] = useState("");

  // Add variant modal
  const [variantPotSize, setVariantPotSize] = useState("");
  const [variantQty, setVariantQty] = useState("1");
  const [variantNotes, setVariantNotes] = useState("");

  const [importingId, setImportingId] = useState<string | null>(null);
  const [importingAll, setImportingAll] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (categoryFilter) params.set("cat", categoryFilter);
    const qs = params.toString();
    window.history.replaceState({}, "", qs ? `?${qs}` : window.location.pathname);
  }, [search, categoryFilter]);

  const activeGroups = useMemo(() => {
    const groups = groupRows(activeRows);
    const q = search.toLowerCase().trim();
    return groups.filter(g => {
      const matchesSearch = !q || g.plant_name.toLowerCase().includes(q) || g.variety.toLowerCase().includes(q);
      const matchesCategory = !categoryFilter || g.variants.some(v => v.category === categoryFilter);
      return matchesSearch && matchesCategory;
    });
  }, [activeRows, search, categoryFilter]);

  const archivedGroups = useMemo(() => groupRows(archivedRows), [archivedRows]);

  function toggleGroup(key: string) {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function avail(row: Row) {
    return row.quantity - (row.listing_quantity ?? 0) - (row.auction_quantity ?? 0);
  }

  function openModal(m: ModalState) {
    if (!m) { setModal(null); return; }
    if ((m.type === "listing" || m.type === "auction") && !termsAccepted) {
      router.push("/seller-agreement?next=/dashboard/inventory");
      return;
    }
    if (m.type === "listing") {
      setPrice("");
      setListQty(String(Math.max(1, avail(m.row))));
    }
    if (m.type === "edit-listing") {
      setPrice(m.row.listing_price_cents ? String(m.row.listing_price_cents / 100) : "");
      setListQty(String(m.row.listing_quantity ?? 1));
    }
    if (m.type === "auction") {
      setStartingBid(""); setBuyNowPrice(""); setEndsAt("");
      setAuctionQty(String(Math.max(1, avail(m.row))));
    }
    if (m.type === "edit") {
      setEditPlantName(m.row.plant_name);
      setEditVariety(m.row.variety);
      setEditPotSize(m.row.pot_size ?? "");
      setEditQuantity(String(m.row.quantity));
      setEditDescription(m.row.description ?? "");
      setEditNotes(m.row.notes ?? "");
      setEditCategory(m.row.category ?? "");
      setEditImages([...m.row.images]);
    }
    if (m.type === "sold") {
      setSoldPrice(""); setSoldQuantity("1"); setSoldNote("");
      setSoldDate(new Date().toISOString().split("T")[0]);
    }
    if (m.type === "add-variant") {
      setVariantPotSize(""); setVariantQty("1"); setVariantNotes("");
    }
    setModal(m);
  }

  // ── Photo upload ──────────────────────────────────────────────────────────
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
    setEditImages(prev => [...prev, data.publicUrl]);
    setImageUploading(false);
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────
  async function saveQtyEdit(rowId: string) {
    const val = parseInt(editingQtyValue, 10);
    setEditingQtyId(null);
    if (isNaN(val) || val < 0) return;
    const supabase = createClient();
    const { error } = await supabase.from("inventory").update({ quantity: val }).eq("id", rowId);
    if (error) toast.error(error.message); else router.refresh();
  }

  async function submitListing() {
    if (!modal || modal.type !== "listing") return;
    setSubmitting(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Not logged in"); setSubmitting(false); return; }
    const a = avail(modal.row);
    const qty = Math.min(Math.max(1, Number(listQty) || a), a);
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
    toast.success(`${modal.row.plant_name} is live in your shop!`);
    setModal(null);
    router.refresh();
  }

  async function submitEditListing() {
    if (!modal || modal.type !== "edit-listing" || !modal.row.listing_id) return;
    setSubmitting(true);
    const supabase = createClient();
    await supabase.from("listings").update({
      price_cents: dollarsToCents(price),
      quantity: Number(listQty),
    }).eq("id", modal.row.listing_id);
    await supabase.from("inventory").update({ listing_quantity: Number(listQty) }).eq("id", modal.row.id);
    setSubmitting(false);
    toast.success("Listing updated.");
    setModal(null);
    router.refresh();
  }

  async function toggleListingPause(row: Row) {
    if (!row.listing_id) return;
    const supabase = createClient();
    const newStatus = row.listing_status === "active" ? "paused" : "active";
    await supabase.from("listings").update({ status: newStatus }).eq("id", row.listing_id);
    toast.success(newStatus === "paused" ? "Listing paused" : "Listing resumed");
    router.refresh();
  }

  async function unlinkListing(row: Row) {
    if (!row.listing_id) return;
    const supabase = createClient();
    await supabase.from("listings").update({ status: "paused" }).eq("id", row.listing_id);
    await supabase.from("inventory").update({ listing_id: null, listing_quantity: null }).eq("id", row.id);
    setModal(null);
    toast.success("Removed from shop");
    router.refresh();
  }

  async function unlinkAuction(row: Row) {
    if (!row.auction_id) return;
    const supabase = createClient();
    await supabase.from("inventory").update({ auction_id: null, auction_quantity: null }).eq("id", row.id);
    toast.success("Auction unlinked from inventory");
    router.refresh();
  }

  async function submitAuction() {
    if (!modal || modal.type !== "auction") return;
    setSubmitting(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Not logged in"); setSubmitting(false); return; }
    const a = avail(modal.row);
    const qty = Math.min(Math.max(1, Number(auctionQty) || a), a);
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
    const editFields: [string, string][] = [
      [editPlantName, "plant name"],
      [editVariety, "variety"],
      [editDescription, "description"],
      [editNotes, "notes"],
    ];
    for (const [text, label] of editFields) {
      if (!text) continue;
      const hit = findProhibitedWord(text);
      if (hit) {
        toast.error(`Your ${label} contains a prohibited word: "${censorWord(hit)}"`);
        logViolation(hit, `inventory-edit-${label}`, text);
        return;
      }
    }
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
    if (error) { toast.error(error.message); setSubmitting(false); return; }
    if (modal.row.listing_id) {
      await supabase.from("listings").update({
        plant_name: editPlantName.trim(),
        variety: editVariety.trim() || null,
        description: editDescription.trim() || null,
        images: editImages,
        category: editCategory || null,
        pot_size: editPotSize || null,
      }).eq("id", modal.row.listing_id);
    }
    setSubmitting(false);
    toast.success("Item updated.");
    setModal(null);
    router.refresh();
  }

  async function submitSold() {
    if (!modal || modal.type !== "sold") return;
    const qty = Math.max(1, Math.min(Number(soldQuantity) || 1, avail(modal.row)));
    const priceCents = soldPrice ? dollarsToCents(soldPrice) : 0;
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
    toast.success(newQty <= 0 ? `${qty} sold — archived (out of stock)` : `${qty} sold · ${newQty} remaining`);
    setModal(null);
    router.refresh();
  }

  async function submitAddVariant() {
    if (!modal || modal.type !== "add-variant") return;
    setSubmitting(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Not logged in"); setSubmitting(false); return; }
    const { error } = await supabase.from("inventory").insert({
      seller_id: user.id,
      plant_name: modal.plant_name,
      variety: modal.variety || null,
      quantity: Number(variantQty) || 1,
      notes: variantNotes || null,
      category: modal.category || null,
      pot_size: variantPotSize || null,
      images: [],
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Variant added!");
    setModal(null);
    router.refresh();
  }

  async function archiveItem(id: string) {
    setLoadingId(id);
    const supabase = createClient();
    const { error } = await supabase.from("inventory").update({ archived_at: new Date().toISOString() }).eq("id", id);
    setLoadingId(null);
    if (error) { toast.error(error.message); return; }
    router.refresh();
    toast("Item archived", {
      action: {
        label: "Undo",
        onClick: async () => {
          await createClient().from("inventory").update({ archived_at: null }).eq("id", id);
          router.refresh();
          toast.success("Restored!");
        },
      },
    });
  }

  async function restoreItem(id: string) {
    setLoadingId(id);
    const supabase = createClient();
    const { error } = await supabase.from("inventory").update({ archived_at: null }).eq("id", id);
    setLoadingId(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Item restored.");
    router.refresh();
  }

  async function importListing(l: UnlinkedListing) {
    setImportingId(l.id);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setImportingId(null); return; }
    const { data: inv, error } = await supabase.from("inventory").insert({
      seller_id: user.id,
      plant_name: l.plant_name,
      variety: l.variety || null,
      quantity: l.quantity,
      description: l.description || null,
      images: l.images,
      category: l.category || null,
      pot_size: l.pot_size || null,
      listing_id: l.id,
      listing_quantity: l.quantity,
    }).select("id").single();
    if (error) { toast.error(error.message); setImportingId(null); return; }
    await supabase.from("listings").update({ inventory_id: inv.id }).eq("id", l.id);
    setImportingId(null);
    toast.success(`${l.plant_name} imported to inventory!`);
    router.refresh();
  }

  async function importAuction(a: UnlinkedAuction) {
    setImportingId(a.id);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setImportingId(null); return; }
    const { data: inv, error } = await supabase.from("inventory").insert({
      seller_id: user.id,
      plant_name: a.plant_name,
      variety: a.variety || null,
      quantity: a.quantity,
      description: a.description || null,
      images: a.images,
      category: a.category || null,
      pot_size: a.pot_size || null,
      auction_id: a.id,
      auction_quantity: a.quantity,
    }).select("id").single();
    if (error) { toast.error(error.message); setImportingId(null); return; }
    await supabase.from("auctions").update({ inventory_id: inv.id }).eq("id", a.id);
    setImportingId(null);
    toast.success(`${a.plant_name} imported to inventory!`);
    router.refresh();
  }

  async function importAll() {
    setImportingAll(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setImportingAll(false); return; }
    for (const l of unlinkedListings) {
      const { data: inv, error } = await supabase.from("inventory").insert({
        seller_id: user.id, plant_name: l.plant_name, variety: l.variety || null,
        quantity: l.quantity, description: l.description || null, images: l.images,
        category: l.category || null, pot_size: l.pot_size || null,
        listing_id: l.id, listing_quantity: l.quantity,
      }).select("id").single();
      if (!error && inv) await supabase.from("listings").update({ inventory_id: inv.id }).eq("id", l.id);
    }
    for (const a of unlinkedAuctions) {
      const { data: inv, error } = await supabase.from("inventory").insert({
        seller_id: user.id, plant_name: a.plant_name, variety: a.variety || null,
        quantity: a.quantity, description: a.description || null, images: a.images,
        category: a.category || null, pot_size: a.pot_size || null,
        auction_id: a.id, auction_quantity: a.quantity,
      }).select("id").single();
      if (!error && inv) await supabase.from("auctions").update({ inventory_id: inv.id }).eq("id", a.id);
    }
    setImportingAll(false);
    const total = unlinkedListings.length + unlinkedAuctions.length;
    toast.success(`${total} item${total !== 1 ? "s" : ""} imported to inventory!`);
    router.refresh();
  }

  function exportExcel() {
    const data = activeRows.map(r => ({
      "Plant Name": r.plant_name, "Variety": r.variety, "Pot Size": r.pot_size ?? "",
      "Category": r.category ?? "", "Total Stock": r.quantity,
      "In Shop": r.listing_quantity ?? 0, "In Auction": r.auction_quantity ?? 0,
      "Available": avail(r),
      "Shop Price": r.listing_price_cents ? (r.listing_price_cents / 100).toFixed(2) : "",
      "Status": r.status, "Date Added": new Date(r.created_at).toLocaleDateString(),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory");
    XLSX.writeFile(wb, "inventory.xlsx");
  }

  // ── Mobile variant card ───────────────────────────────────────────────────
  function renderVariantCard(row: Row) {
    const a = avail(row);
    const hasListing = !!row.listing_id;
    const hasActiveAuction = !!row.auction_id && row.auction_status === "active";
    const dropdownMenu = (
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
          <MoreHorizontal size={15} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[160px]">
          <DropdownMenuItem onClick={() => openModal({ type: "edit", row })}>Edit item</DropdownMenuItem>
          <DropdownMenuItem onClick={() => openModal({ type: "sold", row })}>Mark as sold</DropdownMenuItem>
          {hasListing && (
            <DropdownMenuItem onClick={() => { setModal(null); toggleListingPause(row); }}>
              {row.listing_status === "active" ? "Pause listing" : "Resume listing"}
            </DropdownMenuItem>
          )}
          {row.auction_id && row.auction_status !== "active" && (
            <DropdownMenuItem onClick={() => unlinkAuction(row)}>Unlink ended auction</DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => archiveItem(row.id)} disabled={loadingId === row.id} className="text-destructive focus:text-destructive">
            Archive
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );

    return (
      <div key={row.id} className="border-t border-border/40 px-4 py-3 space-y-2">
        {/* Size + qty + actions */}
        <div className="flex items-center gap-2">
          {row.pot_size
            ? <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium">{row.pot_size}</span>
            : <span className="text-xs text-muted-foreground italic">No size</span>}
          {editingQtyId === row.id ? (
            <input
              type="number" min={0} value={editingQtyValue}
              onChange={e => setEditingQtyValue(e.target.value)}
              onBlur={() => saveQtyEdit(row.id)}
              onKeyDown={e => { if (e.key === "Enter") saveQtyEdit(row.id); if (e.key === "Escape") setEditingQtyId(null); }}
              autoFocus
              className="w-16 px-1.5 py-0.5 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-green-600"
            />
          ) : (
            <button
              onClick={() => { setEditingQtyId(row.id); setEditingQtyValue(String(row.quantity)); }}
              className="inline-flex items-center gap-1 text-sm font-medium tabular-nums hover:text-green-700 group"
              title="Click to edit total stock"
            >
              {row.quantity} <Pencil size={11} className="opacity-0 group-hover:opacity-50 transition-opacity" />
            </button>
          )}
          <div className="ml-auto">{dropdownMenu}</div>
        </div>

        {/* Stock breakdown */}
        {((row.listing_quantity ?? 0) > 0 || (row.auction_quantity ?? 0) > 0) && (
          <div className="flex gap-3 text-xs">
            {(row.listing_quantity ?? 0) > 0 && <span className="text-green-600">{row.listing_quantity} in shop</span>}
            {(row.auction_quantity ?? 0) > 0 && <span className="text-blue-600">{row.auction_quantity} in auction</span>}
            <span className="text-muted-foreground">{a} avail</span>
          </div>
        )}

        {/* Shop */}
        {hasListing ? (
          <div className="flex items-center gap-2 flex-wrap text-sm">
            <Store size={12} className="text-green-600 shrink-0" />
            <span className="font-medium">{centsToDisplay(row.listing_price_cents ?? 0)}</span>
            <span className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
              row.listing_status === "active" ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" :
              row.listing_status === "paused" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400" :
              "bg-red-100 text-red-600"
            )}>{row.listing_status}</span>
            <button onClick={() => openModal({ type: "edit-listing", row })} className="text-xs text-blue-600 hover:underline">Edit</button>
            <Link href={`/shop/${row.listing_id}`} target="_blank" className="text-xs text-muted-foreground hover:underline">View</Link>
          </div>
        ) : a > 0 ? (
          <button onClick={() => openModal({ type: "listing", row })} className="inline-flex items-center gap-1.5 text-sm text-green-700 hover:underline font-medium">
            <Store size={13} /> List in Shop
          </button>
        ) : null}

        {/* Auction */}
        {hasActiveAuction ? (
          <div className="flex items-center gap-2 flex-wrap text-sm">
            <Gavel size={12} className="text-blue-600 shrink-0" />
            <span className="font-medium">{centsToDisplay(row.auction_bid_cents ?? 0)}</span>
            <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 rounded-full px-2 py-0.5">live</span>
            <span className="text-xs text-muted-foreground">Ends {new Date(row.auction_ends_at!).toLocaleDateString()}</span>
            <Link href={`/auctions/${row.auction_id}`} target="_blank" className="text-xs hover:underline">View</Link>
          </div>
        ) : row.auction_id && row.auction_status !== "active" ? (
          <div className="flex items-center gap-2 text-sm">
            <Gavel size={12} className="text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground capitalize">{row.auction_status}</span>
            <Link href={`/auctions/${row.auction_id}`} target="_blank" className="text-xs text-muted-foreground hover:underline">View</Link>
          </div>
        ) : a > 0 ? (
          <button onClick={() => openModal({ type: "auction", row })} className="inline-flex items-center gap-1.5 text-sm text-purple-700 hover:underline font-medium">
            <Gavel size={13} /> Auction
          </button>
        ) : null}
      </div>
    );
  }

  // ── Variant sub-row ───────────────────────────────────────────────────────
  function renderVariantRow(row: Row) {
    const a = avail(row);
    const hasListing = !!row.listing_id;
    const hasActiveAuction = !!row.auction_id && row.auction_status === "active";

    return (
      <tr key={row.id} className="border-t border-border/40 hover:bg-muted/20 transition-colors">
        {/* Size */}
        <td className="py-3 pl-12 pr-3 w-28">
          {row.pot_size ? (
            <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium">{row.pot_size}</span>
          ) : (
            <span className="text-xs text-muted-foreground italic">No size</span>
          )}
        </td>

        {/* Stock */}
        <td className="px-3 py-3 w-32">
          {editingQtyId === row.id ? (
            <input
              type="number" min={0} value={editingQtyValue}
              onChange={e => setEditingQtyValue(e.target.value)}
              onBlur={() => saveQtyEdit(row.id)}
              onKeyDown={e => { if (e.key === "Enter") saveQtyEdit(row.id); if (e.key === "Escape") setEditingQtyId(null); }}
              autoFocus
              className="w-16 px-1.5 py-0.5 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-green-600"
            />
          ) : (
            <button
              onClick={() => { setEditingQtyId(row.id); setEditingQtyValue(String(row.quantity)); }}
              className="inline-flex items-center gap-1 font-medium tabular-nums hover:text-green-700 group"
              title="Click to edit total stock"
            >
              {row.quantity}
              <Pencil size={11} className="opacity-0 group-hover:opacity-50 transition-opacity" />
            </button>
          )}
          {((row.listing_quantity ?? 0) > 0 || (row.auction_quantity ?? 0) > 0) && (
            <div className="text-xs mt-0.5 space-y-0.5">
              {(row.listing_quantity ?? 0) > 0 && <div className="text-green-600">{row.listing_quantity} in shop</div>}
              {(row.auction_quantity ?? 0) > 0 && <div className="text-blue-600">{row.auction_quantity} in auction</div>}
              <div className="text-muted-foreground">{a} available</div>
            </div>
          )}
        </td>

        {/* Shop */}
        <td className="px-3 py-3">
          {hasListing ? (
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">{centsToDisplay(row.listing_price_cents ?? 0)}</span>
                <span className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                  row.listing_status === "active" ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" :
                  row.listing_status === "paused" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400" :
                  "bg-red-100 text-red-600"
                )}>
                  {row.listing_status}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{row.listing_quantity} listed</span>
                <button onClick={() => openModal({ type: "edit-listing", row })} className="text-blue-600 hover:underline">Edit</button>
                <Link href={`/shop/${row.listing_id}`} target="_blank" className="text-muted-foreground hover:underline">View</Link>
              </div>
            </div>
          ) : a > 0 ? (
            <button
              onClick={() => openModal({ type: "listing", row })}
              className="inline-flex items-center gap-1.5 text-sm text-green-700 hover:underline font-medium"
            >
              <Store size={13} /> List in Shop
            </button>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </td>

        {/* Auction */}
        <td className="px-3 py-3">
          {hasActiveAuction ? (
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-medium text-sm">{centsToDisplay(row.auction_bid_cents ?? 0)}</span>
                <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 rounded-full px-2 py-0.5">live</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Ends {new Date(row.auction_ends_at!).toLocaleDateString()}</span>
                <Link href={`/auctions/${row.auction_id}`} target="_blank" className="hover:underline">View</Link>
              </div>
            </div>
          ) : row.auction_id && row.auction_status !== "active" ? (
            <div className="space-y-0.5">
              <span className="text-xs text-muted-foreground capitalize">{row.auction_status}</span>
              <div>
                <Link href={`/auctions/${row.auction_id}`} target="_blank" className="text-xs text-muted-foreground hover:underline">View</Link>
              </div>
            </div>
          ) : a > 0 ? (
            <button
              onClick={() => openModal({ type: "auction", row })}
              className="inline-flex items-center gap-1.5 text-sm text-purple-700 hover:underline font-medium"
            >
              <Gavel size={13} /> Auction
            </button>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </td>

        {/* Actions */}
        <td className="px-3 py-3 text-right w-12">
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
              <MoreHorizontal size={15} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[160px]">
              <DropdownMenuItem onClick={() => openModal({ type: "edit", row })}>Edit item</DropdownMenuItem>
              <DropdownMenuItem onClick={() => openModal({ type: "sold", row })}>Mark as sold</DropdownMenuItem>
              {hasListing && (
                <DropdownMenuItem onClick={() => { setModal(null); toggleListingPause(row); }}>
                  {row.listing_status === "active" ? "Pause listing" : "Resume listing"}
                </DropdownMenuItem>
              )}
              {row.auction_id && row.auction_status !== "active" && (
                <DropdownMenuItem onClick={() => unlinkAuction(row)}>
                  Unlink ended auction
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => archiveItem(row.id)}
                disabled={loadingId === row.id}
                className="text-destructive focus:text-destructive"
              >
                Archive
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </td>
      </tr>
    );
  }

  // ── Plant group accordion ─────────────────────────────────────────────────
  function renderGroup(group: PlantGroup) {
    const isOpen = openGroups.has(group.key);
    const totalQty = group.variants.reduce((sum, v) => sum + v.quantity, 0);
    const totalAvail = group.variants.reduce((sum, v) => sum + avail(v), 0);
    const hasShop = group.variants.some(v => v.listing_id && v.listing_status === "active");
    const hasLiveAuction = group.variants.some(v => v.auction_id && v.auction_status === "active");
    const first = group.variants[0];

    return (
      <div key={group.key} className="border rounded-lg overflow-hidden mb-2">
        <button
          onClick={() => toggleGroup(group.key)}
          className="w-full flex items-center gap-3 px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
        >
          {isOpen
            ? <ChevronDown size={16} className="shrink-0 text-muted-foreground" />
            : <ChevronRight size={16} className="shrink-0 text-muted-foreground" />}
          {first?.images?.[0] && (
            <img src={first.images[0]} alt="" className="w-8 h-8 rounded object-cover shrink-0 border" />
          )}
          <div className="flex-1 min-w-0">
            <span className="font-semibold">{group.plant_name}</span>
            {group.variety && <span className="text-muted-foreground ml-2 font-normal">· {group.variety}</span>}
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            {hasShop && (
              <span className="hidden sm:inline-flex items-center gap-1 text-xs text-green-700 bg-green-100 dark:bg-green-900/40 dark:text-green-400 rounded-full px-2 py-0.5">
                <Store size={10} /> Shop
              </span>
            )}
            {hasLiveAuction && (
              <span className="hidden sm:inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-100 dark:bg-blue-900/40 dark:text-blue-400 rounded-full px-2 py-0.5">
                <Gavel size={10} /> Live
              </span>
            )}
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {group.variants.length} size{group.variants.length !== 1 ? "s" : ""} · {totalQty} total
              {totalAvail !== totalQty && <span className="ml-1 text-xs">({totalAvail} avail)</span>}
            </span>
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                openModal({ type: "add-variant", plant_name: group.plant_name, variety: group.variety, category: first?.category ?? null });
              }}
              className="inline-flex items-center gap-1 text-xs text-green-700 hover:text-green-800 border border-green-200 hover:border-green-400 rounded-full px-2.5 py-0.5 transition-colors bg-background"
            >
              <Plus size={11} /> Variant
            </button>
          </div>
        </button>

        {isOpen && (
          <>
            {/* Mobile: cards */}
            <div className="sm:hidden">
              {group.variants.map(renderVariantCard)}
            </div>
            {/* Desktop: table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-background border-t border-border/40">
                    <th className="py-2 pl-12 pr-3 text-left text-xs font-medium text-muted-foreground w-28">Size</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-32">Stock</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Shop Listing</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Auction</th>
                    <th className="px-3 py-2 w-12" />
                  </tr>
                </thead>
                <tbody>{group.variants.map(renderVariantRow)}</tbody>
              </table>
            </div>
          </>
        )}
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">Inventory</h1>
            <button
              onClick={() => setShowHelp(true)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="How inventory works"
            >
              <HelpCircle size={18} />
            </button>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {activeRows.length} item{activeRows.length !== 1 ? "s" : ""} · {activeGroups.length} plant{activeGroups.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportExcel} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>Export</button>
          <Link href="/dashboard/create" className={cn(buttonVariants({ size: "sm" }), "bg-green-700 hover:bg-green-800")}>+ Add to Inventory</Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        <Input
          placeholder="Search by plant name or variety…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select value={categoryFilter || "_all"} onValueChange={v => setCategoryFilter(v === "_all" ? "" : (v ?? ""))}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All categories</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        {(search || categoryFilter) && (
          <button
            onClick={() => { setSearch(""); setCategoryFilter(""); }}
            className="text-xs text-muted-foreground hover:text-foreground underline self-center"
          >
            Clear
          </button>
        )}
      </div>

      {activeGroups.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-4xl mb-4">📦</p>
          <p className="font-medium text-lg">{(search.trim() || categoryFilter) ? `No results${search.trim() ? ` for "${search}"` : ""}${categoryFilter ? ` in ${categoryFilter}` : ""}` : "No inventory yet"}</p>
          {!search.trim() && (
            <Link href="/dashboard/create" className={cn(buttonVariants(), "mt-6 bg-green-700 hover:bg-green-800")}>+ Add to Inventory</Link>
          )}
        </div>
      ) : (
        <div>{activeGroups.map(renderGroup)}</div>
      )}

      {/* Unlinked listings & auctions */}
      {(unlinkedListings.length > 0 || unlinkedAuctions.length > 0) && (() => {
        const groups = groupUnlinked(unlinkedListings, unlinkedAuctions);
        return (
          <div className="mt-8 border-t pt-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-base font-semibold">Not yet in inventory</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  These listings and auctions were created before inventory tracking. Import each one to manage it alongside your inventory.
                </p>
              </div>
              <button
                onClick={importAll}
                disabled={importingAll}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0 disabled:opacity-50")}
              >
                {importingAll ? "Importing…" : "Import All"}
              </button>
            </div>
            <div className="space-y-2">
              {groups.map(group => (
                <div key={group.key} className="border rounded-lg overflow-hidden">
                  <div className="px-4 py-3 bg-muted/20 border-b border-border/40">
                    <span className="font-semibold">{group.plant_name}</span>
                    {group.variety && <span className="text-muted-foreground ml-2 font-normal">· {group.variety}</span>}
                  </div>
                  <div className="divide-y divide-border/40">
                    {group.listings.map(l => (
                      <div key={l.id} className="flex items-center gap-3 px-4 py-3 text-sm flex-wrap">
                        <Store size={13} className="text-green-600 shrink-0" />
                        <span className="font-medium">Shop Listing</span>
                        {l.pot_size && <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs">{l.pot_size}</span>}
                        <span>{l.quantity} in stock</span>
                        <span className="font-medium">{centsToDisplay(l.price_cents)}</span>
                        <span className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                          l.status === "active" ? "bg-green-100 text-green-700" :
                          l.status === "paused" ? "bg-yellow-100 text-yellow-700" :
                          "bg-red-100 text-red-600"
                        )}>{l.status}</span>
                        <button
                          onClick={() => importListing(l)}
                          disabled={importingId === l.id}
                          className="ml-auto text-xs text-green-700 hover:underline font-medium disabled:opacity-50"
                        >
                          {importingId === l.id ? "Importing…" : "Import to Inventory"}
                        </button>
                      </div>
                    ))}
                    {group.auctions.map(a => (
                      <div key={a.id} className="flex items-center gap-3 px-4 py-3 text-sm flex-wrap">
                        <Gavel size={13} className="text-purple-600 shrink-0" />
                        <span className="font-medium">Auction</span>
                        {a.pot_size && <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs">{a.pot_size}</span>}
                        <span>{a.quantity} qty</span>
                        <span className="font-medium">Bid: {centsToDisplay(a.current_bid_cents)}</span>
                        <span className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                          a.status === "active" ? "bg-blue-100 text-blue-700" :
                          a.status === "ended" ? "bg-purple-100 text-purple-700" :
                          "bg-muted text-muted-foreground"
                        )}>{a.status}</span>
                        <span className="text-xs text-muted-foreground">Ends {new Date(a.ends_at).toLocaleDateString()}</span>
                        <button
                          onClick={() => importAuction(a)}
                          disabled={importingId === a.id}
                          className="ml-auto text-xs text-green-700 hover:underline font-medium disabled:opacity-50"
                        >
                          {importingId === a.id ? "Importing…" : "Import to Inventory"}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Archived */}
      {archivedRows.length > 0 && (
        <div className="mt-8 border-t pt-6">
          <button
            onClick={() => setShowArchived(v => !v)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
          >
            {showArchived ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            Archived ({archivedRows.length})
            <span className="text-xs bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 rounded-full px-2 py-0.5">Deleted in 30 days</span>
          </button>
          {showArchived && (
            <div className="space-y-2 opacity-80">
              {archivedGroups.map(group => (
                <div key={group.key} className="border rounded-lg overflow-hidden">
                  <div className="px-4 py-2.5 bg-muted/20">
                    <span className="font-medium text-sm text-muted-foreground">
                      {group.plant_name}{group.variety ? ` · ${group.variety}` : ""}
                    </span>
                  </div>
                  <div className="divide-y divide-border/40">
                    {group.variants.map(row => (
                      <div key={row.id} className="flex items-center gap-4 px-4 py-2.5 text-sm">
                        <span className="text-muted-foreground">{row.pot_size ?? "No size"}</span>
                        <span>{row.quantity} in stock</span>
                        {row.archived_at && (
                          <span className="text-xs text-orange-600">{daysUntilPurge(row.archived_at)}d left</span>
                        )}
                        <button
                          onClick={() => restoreItem(row.id)}
                          disabled={loadingId === row.id}
                          className="ml-auto text-xs text-green-700 hover:underline disabled:opacity-50"
                        >
                          {loadingId === row.id ? "Restoring…" : "Restore"}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── List in Shop ── */}
      <Dialog open={modal?.type === "listing"} onOpenChange={o => !o && setModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>List in Shop</DialogTitle>
            {modal?.type === "listing" && (
              <DialogDescription>
                {modal.row.plant_name}{modal.row.variety ? ` · ${modal.row.variety}` : ""}{modal.row.pot_size ? ` · ${modal.row.pot_size}` : ""}
              </DialogDescription>
            )}
          </DialogHeader>
          {modal?.type === "listing" && (() => {
            const a = avail(modal.row);
            return (
              <div className="space-y-4 mt-1">
                <div className="space-y-1">
                  <Label htmlFor="modal-price">Price per item ($) *</Label>
                  <Input id="modal-price" type="number" min={0.01} step={0.01} value={price} onChange={e => setPrice(e.target.value)} placeholder="0.00" autoFocus />
                  <PriceSuggestion plantName={modal.row.plant_name} variety={modal.row.variety} label="price" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="modal-qty">Quantity to list *</Label>
                  <Input id="modal-qty" type="number" min={1} max={a} value={listQty} onChange={e => setListQty(e.target.value)} />
                  <p className="text-xs text-muted-foreground">{a} available</p>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" onClick={() => setModal(null)} className="flex-1">Cancel</Button>
                  <Button onClick={submitListing} disabled={submitting || !price || !listQty} className="flex-1 bg-green-700 hover:bg-green-800">
                    {submitting ? "Publishing…" : "Go Live"}
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ── Edit Listing ── */}
      <Dialog open={modal?.type === "edit-listing"} onOpenChange={o => !o && setModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Listing</DialogTitle>
            {modal?.type === "edit-listing" && (
              <DialogDescription>
                {modal.row.plant_name}{modal.row.variety ? ` · ${modal.row.variety}` : ""}{modal.row.pot_size ? ` · ${modal.row.pot_size}` : ""}
              </DialogDescription>
            )}
          </DialogHeader>
          {modal?.type === "edit-listing" && (
            <div className="space-y-4 mt-1">
              <div className="space-y-1">
                <Label htmlFor="edit-list-price">Price per item ($)</Label>
                <Input id="edit-list-price" type="number" min={0.01} step={0.01} value={price} onChange={e => setPrice(e.target.value)} autoFocus />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-list-qty">Listed quantity</Label>
                <Input id="edit-list-qty" type="number" min={1} value={listQty} onChange={e => setListQty(e.target.value)} />
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button onClick={submitEditListing} disabled={submitting || !price || !listQty} className="bg-green-700 hover:bg-green-800">
                  {submitting ? "Saving…" : "Save Changes"}
                </Button>
                <Button variant="outline" onClick={() => { setModal(null); toggleListingPause(modal.row); }}>
                  {modal.row.listing_status === "active" ? "Pause" : "Resume"}
                </Button>
                <Button variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => unlinkListing(modal.row)}>
                  Remove from Shop
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Create Auction ── */}
      <Dialog open={modal?.type === "auction"} onOpenChange={o => !o && setModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create Auction</DialogTitle>
            {modal?.type === "auction" && (
              <DialogDescription>
                {modal.row.plant_name}{modal.row.variety ? ` · ${modal.row.variety}` : ""}{modal.row.pot_size ? ` · ${modal.row.pot_size}` : ""}
              </DialogDescription>
            )}
          </DialogHeader>
          {modal?.type === "auction" && (() => {
            const a = avail(modal.row);
            return (
              <div className="space-y-4 mt-1">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="modal-bid">Starting Bid ($) *</Label>
                    <Input id="modal-bid" type="number" min={0.01} step={0.01} value={startingBid} onChange={e => setStartingBid(e.target.value)} placeholder="0.00" autoFocus />
                    <PriceSuggestion plantName={modal.row.plant_name} variety={modal.row.variety} label="bid" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="modal-auc-qty">Quantity *</Label>
                    <Input id="modal-auc-qty" type="number" min={1} max={a} value={auctionQty} onChange={e => setAuctionQty(e.target.value)} />
                    <p className="text-xs text-muted-foreground">{a} available</p>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="modal-buy-now">Buy Now Price ($) <span className="font-normal text-muted-foreground">(optional)</span></Label>
                  <Input id="modal-buy-now" type="number" min={0.01} step={0.01} value={buyNowPrice} onChange={e => setBuyNowPrice(e.target.value)} placeholder="Leave blank to disable" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="modal-ends">End Date & Time *</Label>
                  <Input id="modal-ends" type="datetime-local" value={endsAt} onChange={e => setEndsAt(e.target.value)} min={new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16)} />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" onClick={() => setModal(null)} className="flex-1">Cancel</Button>
                  <Button onClick={submitAuction} disabled={submitting || !startingBid || !endsAt || !auctionQty} className="flex-1 bg-green-700 hover:bg-green-800">
                    {submitting ? "Starting…" : "Start Auction"}
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ── Add Variant ── */}
      <Dialog open={modal?.type === "add-variant"} onOpenChange={o => !o && setModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Size Variant</DialogTitle>
            {modal?.type === "add-variant" && (
              <DialogDescription>
                {modal.plant_name}{modal.variety ? ` · ${modal.variety}` : ""}
              </DialogDescription>
            )}
          </DialogHeader>
          {modal?.type === "add-variant" && (
            <div className="space-y-4 mt-1">
              <div className="space-y-1">
                <Label>Pot Size <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <PotSizePicker value={variantPotSize} onChange={setVariantPotSize} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="variant-qty">Quantity *</Label>
                <Input id="variant-qty" type="number" min={1} value={variantQty} onChange={e => setVariantQty(e.target.value)} autoFocus className="max-w-[120px]" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="variant-notes">Notes <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <Input id="variant-notes" value={variantNotes} onChange={e => setVariantNotes(e.target.value)} placeholder="e.g. Just repotted" />
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" onClick={() => setModal(null)} className="flex-1">Cancel</Button>
                <Button onClick={submitAddVariant} disabled={submitting || !variantQty} className="flex-1 bg-green-700 hover:bg-green-800">
                  {submitting ? "Adding…" : "Add Variant"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Edit Item ── */}
      <Dialog open={modal?.type === "edit"} onOpenChange={o => !o && setModal(null)}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Item</DialogTitle></DialogHeader>
          {modal?.type === "edit" && (
            <div className="space-y-4 mt-1">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="edit-name">Plant name *</Label>
                  <Input id="edit-name" value={editPlantName} onChange={e => setEditPlantName(e.target.value)} autoFocus />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-variety">Variety</Label>
                  <Input id="edit-variety" value={editVariety} onChange={e => setEditVariety(e.target.value)} placeholder="Optional" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Pot Size</Label>
                  <PotSizePicker value={editPotSize} onChange={setEditPotSize} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-qty">Quantity</Label>
                  <Input id="edit-qty" type="number" min={0} value={editQuantity} onChange={e => setEditQuantity(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Category</Label>
                <Select value={editCategory || "_none"} onValueChange={v => setEditCategory(v === "_none" ? "" : (v ?? ""))}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— None —</SelectItem>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-desc">Description</Label>
                <Textarea id="edit-desc" value={editDescription} onChange={e => setEditDescription(e.target.value)} rows={3} placeholder="Describe the plant…" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-notes">Private notes</Label>
                <Textarea id="edit-notes" value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={2} placeholder="Not visible to buyers…" />
              </div>
              <div className="space-y-2">
                <Label>Photos</Label>
                {editImages.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {editImages.map((url, idx) => (
                      <div key={url + idx} className="relative group">
                        <img src={url} alt="" className="w-16 h-16 rounded object-cover border" />
                        <button
                          type="button"
                          onClick={() => setEditImages(prev => prev.filter((_, i) => i !== idx))}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageAdd} />
                <Button type="button" variant="outline" size="sm" onClick={() => imageInputRef.current?.click()} disabled={imageUploading} className="flex items-center gap-1.5 text-xs">
                  <ImagePlus size={14} />{imageUploading ? "Uploading…" : "Add Photo"}
                </Button>
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" onClick={() => setModal(null)} className="flex-1">Cancel</Button>
                <Button onClick={submitEdit} disabled={submitting || !editPlantName.trim()} className="flex-1 bg-green-700 hover:bg-green-800">
                  {submitting ? "Saving…" : "Save Changes"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Mark as Sold ── */}
      <Dialog open={modal?.type === "sold"} onOpenChange={o => !o && setModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Mark as Sold</DialogTitle></DialogHeader>
          {modal?.type === "sold" && (
            <div className="space-y-4 mt-1">
              <p className="text-sm text-muted-foreground">
                Off-platform sale for <span className="font-medium text-foreground">
                  {modal.row.plant_name}{modal.row.variety ? ` · ${modal.row.variety}` : ""}{modal.row.pot_size ? ` · ${modal.row.pot_size}` : ""}
                </span>. Appears in analytics.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="sold-price">Sale price ($) <span className="font-normal text-muted-foreground">(optional)</span></Label>
                  <Input id="sold-price" type="number" min={0.01} step={0.01} placeholder="0.00" value={soldPrice} onChange={e => setSoldPrice(e.target.value)} autoFocus />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="sold-qty">Quantity *</Label>
                  <Input id="sold-qty" type="number" min={1} max={avail(modal.row)} value={soldQuantity} onChange={e => setSoldQuantity(e.target.value)} />
                  <p className="text-xs text-muted-foreground">{avail(modal.row)} available</p>
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="sold-date">Date sold</Label>
                <Input id="sold-date" type="date" value={soldDate} onChange={e => setSoldDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sold-note">Note <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <Input id="sold-note" placeholder="e.g. Farmers market" value={soldNote} onChange={e => setSoldNote(e.target.value)} maxLength={200} />
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" onClick={() => setModal(null)} className="flex-1">Cancel</Button>
                <Button onClick={submitSold} disabled={submitting} className="flex-1 bg-orange-600 hover:bg-orange-700 text-white">
                  {submitting ? "Saving…" : "Record Sale"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── How Inventory Works ── */}
      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>How Inventory Works</DialogTitle>
            <DialogDescription>Your inventory is the single source of truth for every plant you have in stock.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 mt-2 text-sm">

            <div className="space-y-1.5">
              <p className="font-semibold">Plants &amp; Variants</p>
              <p className="text-muted-foreground">Each plant (name + variety) gets its own collapsible group. Inside, each pot size is a separate row — so 4", 6", and 8" Monsteras are three rows under one group. Click <strong>+ Variant</strong> in the header to add a new size.</p>
            </div>

            <div className="space-y-1.5">
              <p className="font-semibold">Stock Breakdown</p>
              <p className="text-muted-foreground">Every row tracks four numbers:</p>
              <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
                <li><span className="font-medium text-foreground">Total</span> — everything you own (click the number to edit)</li>
                <li><span className="font-medium text-green-700">In Shop</span> — allocated to an active shop listing</li>
                <li><span className="font-medium text-blue-700">In Auction</span> — reserved for a live auction</li>
                <li><span className="font-medium text-foreground">Available</span> — Total minus In Shop minus In Auction</li>
              </ul>
            </div>

            <div className="space-y-1.5">
              <p className="font-semibold">Listing in the Shop</p>
              <p className="text-muted-foreground">Click <strong>List in Shop</strong> on any row to set a price and go live. Once listed, click <strong>Edit</strong> to update the price or quantity, or <strong>Pause</strong> to hide it from buyers temporarily. When a buyer purchases, your stock decrements automatically.</p>
            </div>

            <div className="space-y-1.5">
              <p className="font-semibold">Running an Auction</p>
              <p className="text-muted-foreground">Click <strong>Auction</strong> to set a starting bid, optional Buy Now price, and an end date. The row shows the live bid and a View link while it&apos;s running. When the auction ends with a winner, stock decrements on checkout. If no one bids, the quantity is released back to Available.</p>
            </div>

            <div className="space-y-1.5">
              <p className="font-semibold">Off-Platform Sales</p>
              <p className="text-muted-foreground">Sold something at a farmers market or locally? Use <strong>Mark as Sold</strong> from the row menu. Enter the quantity and an optional price — it records the sale in your analytics and decrements stock.</p>
            </div>

            <div className="space-y-1.5">
              <p className="font-semibold">Archiving</p>
              <p className="text-muted-foreground">Archive removes an item from your active inventory. Archived items are held for 30 days (visible at the bottom of the page) so you can restore them if needed. Items that sell out are archived automatically.</p>
            </div>

          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
