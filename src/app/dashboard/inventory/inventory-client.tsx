"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
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
  AlertTriangle, GripVertical, Copy, StickyNote, ArrowUpDown,
  LayoutList, LayoutGrid, Upload,
} from "lucide-react";
import * as XLSX from "xlsx";
import PotSizePicker from "@/components/pot-size-picker";
import PriceSuggestion from "@/components/price-suggestion";
import SellerAgreementDialog from "@/components/seller-agreement-dialog";
import { findProhibitedWord, censorWord, logViolation } from "@/lib/profanity";

const BASE_CATEGORIES = [
  "Tropical", "Succulent", "Cactus", "Carnivorous", "Orchid",
  "Fern", "Herb", "Rare", "Seasonal", "Other",
];
const ADMIN_CATEGORIES = [...BASE_CATEGORIES, "Hidden"];

type AuctionSummary = {
  id: string;
  quantity: number;
  current_bid_cents: number;
  ends_at: string;
  status: string;
};

type Row = {
  id: string;
  plant_name: string;
  variety: string;
  quantity: number;
  listing_id: string | null;
  listing_quantity: number | null;
  listing_price_cents: number | null;
  listing_status: string | null;
  listing_created_at: string | null;
  listing_sale_price_cents: number | null;
  listing_sale_ends_at: string | null;
  listing_bundle_discount_pct: number | null;
  listing_sold_out_behavior: "mark_sold_out" | "auto_pause";
  listing_care_guide_pdf_url: string | null;
  auctions: AuctionSummary[];
  low_stock_threshold: number | null;
  cost_cents: number | null;
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

type ImportRow = {
  plant_name: string;
  variety: string;
  pot_size: string;
  quantity: number;
  category: string;
  description: string;
  notes: string;
  cost_price: string;
  valid: boolean;
  error?: string;
};

type ModalState =
  | { type: "listing"; row: Row }
  | { type: "edit-listing"; row: Row }
  | { type: "auction"; row: Row }
  | { type: "edit"; row: Row }
  | { type: "sold"; row: Row }
  | { type: "sale"; row: Row }
  | { type: "add-variant"; plant_name: string; variety: string; category: string | null }
  | null;

function listingAge(dateStr: string): string {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return "Listed today";
  if (days === 1) return "Listed yesterday";
  if (days < 7) return `Listed ${days} days ago`;
  if (days < 30) return `Listed ${Math.floor(days / 7)}w ago`;
  if (days < 365) return `Listed ${Math.floor(days / 30)}mo ago`;
  return `Listed ${Math.floor(days / 365)}y ago`;
}

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
  isAdmin = false,
  showWelcome = false,
  stripeOnboarded = false,
}: {
  activeRows: Row[];
  archivedRows: Row[];
  termsAccepted: boolean;
  unlinkedListings: UnlinkedListing[];
  unlinkedAuctions: UnlinkedAuction[];
  initialSearch?: string;
  initialCategory?: string;
  isAdmin?: boolean;
  showWelcome?: boolean;
  stripeOnboarded?: boolean;
}) {
  const router = useRouter();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const [welcomeOpen, setWelcomeOpen] = useState(showWelcome);
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
  const [localTermsAccepted, setLocalTermsAccepted] = useState(termsAccepted);
  const [agreementDialogOpen, setAgreementDialogOpen] = useState(false);
  const [pendingModal, setPendingModal] = useState<ModalState>(null);

  // Sale modal
  const [salePrice, setSalePrice] = useState("");
  const [saleEndsAt, setSaleEndsAt] = useState("");

  // Inline qty edit
  const [editingQtyId, setEditingQtyId] = useState<string | null>(null);
  const [editingQtyValue, setEditingQtyValue] = useState("");

  // Inline listing qty edit
  const [editingListingQtyId, setEditingListingQtyId] = useState<string | null>(null);
  const [editingListingQtyValue, setEditingListingQtyValue] = useState("");

  // Listing modal
  const [price, setPrice] = useState("");
  const [listQty, setListQty] = useState("");
  const [bundleDiscountPct, setBundleDiscountPct] = useState("");
  const [soldOutBehavior, setSoldOutBehavior] = useState<"mark_sold_out" | "auto_pause">("mark_sold_out");
  const [careGuidePdfUrl, setCareGuidePdfUrl] = useState<string | null>(null);
  const [careGuidePdfUploading, setCareGuidePdfUploading] = useState(false);

  // Listing templates
  type ListingTemplate = { id: string; name: string; plant_name: string; variety: string | null; category: string | null; pot_size: string | null; description: string | null; price_cents: number | null };
  const [templates, setTemplates] = useState<ListingTemplate[]>([]);
  const [saveTemplateName, setSaveTemplateName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Auction modal
  const [startingBid, setStartingBid] = useState("");
  const [buyNowPrice, setBuyNowPrice] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [reservePrice, setReservePrice] = useState("");
  const [auctionQty, setAuctionQty] = useState("");
  const [auctionAck, setAuctionAck] = useState(false);

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
  const [editLowStockThreshold, setEditLowStockThreshold] = useState("");
  const [dragPhotoIdx, setDragPhotoIdx] = useState<number | null>(null);

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
  const [sortBy, setSortBy] = useState<"name" | "avail-asc" | "date-desc" | "price-asc">("name");
  const [editCostPrice, setEditCostPrice] = useState("");
  const [viewMode, setViewMode] = useState<"grouped" | "flat">("grouped");
  const [importOpen, setImportOpen] = useState(false);
  const categories = isAdmin ? ADMIN_CATEGORIES : BASE_CATEGORIES;
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importSubmitting, setImportSubmitting] = useState(false);

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
    const filtered = groups.filter(g => {
      const matchesSearch = !q || g.plant_name.toLowerCase().includes(q) || g.variety.toLowerCase().includes(q);
      const matchesCategory = !categoryFilter || g.variants.some(v => v.category === categoryFilter);
      return matchesSearch && matchesCategory;
    });
    if (sortBy === "avail-asc") {
      filtered.sort((a, b) =>
        a.variants.reduce((s, v) => s + avail(v), 0) - b.variants.reduce((s, v) => s + avail(v), 0)
      );
    } else if (sortBy === "date-desc") {
      filtered.sort((a, b) =>
        Math.max(...b.variants.map(v => new Date(v.created_at).getTime())) -
        Math.max(...a.variants.map(v => new Date(v.created_at).getTime()))
      );
    } else if (sortBy === "price-asc") {
      filtered.sort((a, b) => {
        const aPrice = Math.min(...a.variants.filter(v => v.listing_price_cents).map(v => v.listing_price_cents!), Infinity);
        const bPrice = Math.min(...b.variants.filter(v => v.listing_price_cents).map(v => v.listing_price_cents!), Infinity);
        return aPrice - bPrice;
      });
    }
    // "name" is already alphabetical from groupRows
    return filtered;
  }, [activeRows, search, categoryFilter, sortBy]);

  const archivedGroups = useMemo(() => groupRows(archivedRows), [archivedRows]);

  function toggleGroup(key: string) {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function avail(row: Row) {
    const auctionQty = row.auctions
      .filter(a => a.status === "active")
      .reduce((sum, a) => sum + a.quantity, 0);
    return row.quantity - (row.listing_quantity ?? 0) - auctionQty;
  }

  function openModal(m: ModalState) {
    if (!m) { setModal(null); return; }
    if ((m.type === "listing" || m.type === "auction") && !localTermsAccepted) {
      setPendingModal(m);
      setAgreementDialogOpen(true);
      return;
    }
    if (m.type === "sale") {
      const active = m.row.listing_sale_price_cents && m.row.listing_sale_ends_at && new Date(m.row.listing_sale_ends_at) > new Date();
      setSalePrice(active ? String(m.row.listing_sale_price_cents! / 100) : "");
      setSaleEndsAt(active && m.row.listing_sale_ends_at ? m.row.listing_sale_ends_at.slice(0, 16) : "");
    }
    if (m.type === "listing") {
      setPrice("");
      setListQty(String(Math.max(1, avail(m.row))));
    }
    if (m.type === "edit-listing") {
      setPrice(m.row.listing_price_cents ? String(m.row.listing_price_cents / 100) : "");
      setListQty(String(m.row.listing_quantity ?? 1));
      setEditPotSize(m.row.pot_size ?? "");
      setBundleDiscountPct(m.row.listing_bundle_discount_pct ? String(m.row.listing_bundle_discount_pct) : "");
      setSoldOutBehavior(m.row.listing_sold_out_behavior ?? "mark_sold_out");
      setCareGuidePdfUrl(m.row.listing_care_guide_pdf_url ?? null);
      setEditImages([...m.row.images]);
    }
    if (m.type === "auction") {
      if (!stripeOnboarded) {
        toast.error("Connect your bank account before creating an auction.", {
          description: "Go to Account Settings → Seller Payments to set up Stripe.",
          action: { label: "Go to Settings", onClick: () => window.location.href = "/account#seller-payments" },
          duration: 6000,
        });
        return;
      }
      setStartingBid(""); setBuyNowPrice(""); setEndsAt(""); setStartsAt(""); setReservePrice("");
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
      setEditLowStockThreshold(m.row.low_stock_threshold != null ? String(m.row.low_stock_threshold) : "");
      setEditCostPrice(m.row.cost_cents != null ? String(m.row.cost_cents / 100) : "");
      setDragPhotoIdx(null);
      setSaveTemplateName("");
      // Load seller's templates
      createClient().from("listing_templates").select("id, name, plant_name, variety, category, pot_size, description, price_cents").then(({ data }) => {
        if (data) setTemplates(data);
      });
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

  async function saveListingQtyEdit(row: Row) {
    const val = parseInt(editingListingQtyValue, 10);
    setEditingListingQtyId(null);
    if (isNaN(val) || val < 0 || !row.listing_id) return;
    const auctionQty = row.auctions.filter(a => a.status === "active").reduce((sum, a) => sum + a.quantity, 0);
    const max = row.quantity - auctionQty;
    if (val > max) {
      toast.error(`Only ${max} available — you can't list more than your total stock. Reverted.`);
      return;
    }
    const supabase = createClient();
    await supabase.from("listings").update({ quantity: val }).eq("id", row.listing_id);
    await supabase.from("inventory").update({ listing_quantity: val }).eq("id", row.id);
    router.refresh();
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
    const qty = Number(listQty);
    const auctionQty = modal.row.auctions.filter(a => a.status === "active").reduce((sum, a) => sum + a.quantity, 0);
    const max = modal.row.quantity - auctionQty;
    if (qty > max) {
      toast.error(`Only ${max} available — you can't list more than your total stock.`);
      return;
    }
    setSubmitting(true);
    const supabase = createClient();
    const discPct = bundleDiscountPct ? Math.min(80, Math.max(1, Number(bundleDiscountPct))) : null;
    await supabase.from("listings").update({
      price_cents: dollarsToCents(price),
      quantity: qty,
      pot_size: editPotSize || null,
      bundle_discount_pct: discPct,
      sold_out_behavior: soldOutBehavior,
      care_guide_pdf_url: careGuidePdfUrl,
      images: editImages,
    }).eq("id", modal.row.listing_id);
    await supabase.from("inventory").update({ listing_quantity: qty, pot_size: editPotSize || null, images: editImages }).eq("id", modal.row.id);
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

  async function unlinkAuction(row: Row, auctionId: string) {
    const supabase = createClient();
    await supabase.from("auctions").update({ inventory_id: null }).eq("id", auctionId);
    toast.success("Auction unlinked");
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
    const scheduledStart = startsAt ? new Date(startsAt) : null;
    const isScheduled = scheduledStart && scheduledStart > new Date();
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
      starts_at: scheduledStart ? scheduledStart.toISOString() : null,
      status: isScheduled ? "scheduled" : "active",
      reserve_price_cents: reservePrice ? dollarsToCents(reservePrice) : null,
      images: modal.row.images,
      category: modal.row.category || null,
      pot_size: modal.row.pot_size || null,
      inventory_id: modal.row.id,
    }).select("id").single();
    if (error) { toast.error(error.message); setSubmitting(false); return; }
    setSubmitting(false);
    toast.success(isScheduled ? `Auction scheduled for ${modal.row.plant_name}!` : `Auction started for ${modal.row.plant_name}!`);
    setModal(null);
    router.refresh();
  }

  async function saveAsTemplate() {
    if (!modal || modal.type !== "edit" || !saveTemplateName.trim()) return;
    setSavingTemplate(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSavingTemplate(false); return; }
    const { error } = await supabase.from("listing_templates").insert({
      seller_id: user.id,
      name: saveTemplateName.trim(),
      plant_name: editPlantName.trim(),
      variety: editVariety.trim() || null,
      category: editCategory || null,
      pot_size: editPotSize || null,
      description: editDescription.trim() || null,
    });
    setSavingTemplate(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Template saved!");
    setSaveTemplateName("");
    createClient().from("listing_templates").select("id, name, plant_name, variety, category, pot_size, description, price_cents").then(({ data }) => {
      if (data) setTemplates(data);
    });
  }

  async function deleteTemplate(id: string) {
    const supabase = createClient();
    await supabase.from("listing_templates").delete().eq("id", id);
    setTemplates(prev => prev.filter(t => t.id !== id));
    toast.success("Template deleted");
  }

  async function uploadCareGuidePdf(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (file.size > 10 * 1024 * 1024) { toast.error("PDF must be under 10 MB"); return; }
    setCareGuidePdfUploading(true);
    const supabase = createClient();
    const path = `care-guides/${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`;
    const { error } = await supabase.storage.from("listings").upload(path, file, { contentType: "application/pdf" });
    if (error) { toast.error("Upload failed: " + error.message); setCareGuidePdfUploading(false); return; }
    const { data } = supabase.storage.from("listings").getPublicUrl(path);
    setCareGuidePdfUrl(data.publicUrl);
    setCareGuidePdfUploading(false);
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
      low_stock_threshold: editLowStockThreshold !== "" ? Number(editLowStockThreshold) : null,
      cost_cents: editCostPrice !== "" ? dollarsToCents(editCostPrice) : null,
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

  async function submitSale(clear = false) {
    if (!modal || modal.type !== "sale" || !modal.row.listing_id) return;
    setSubmitting(true);
    const res = await fetch("/api/listings/sale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(clear
        ? { listingId: modal.row.listing_id, clear: true }
        : { listingId: modal.row.listing_id, salePrice, saleEndsAt }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (data.error) { toast.error(data.error); return; }
    toast.success(clear ? "Sale ended" : "Sale scheduled!");
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

  async function duplicateItem(row: Row) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("inventory").insert({
      seller_id: user.id,
      plant_name: row.plant_name,
      variety: row.variety || null,
      quantity: 1,
      description: row.description || null,
      images: [...row.images],
      category: row.category || null,
      pot_size: row.pot_size || null,
      low_stock_threshold: row.low_stock_threshold ?? null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Item duplicated — update the quantity and size as needed");
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
      "In Shop": r.listing_quantity ?? 0, "In Auction": r.auctions.filter(a => a.status === "active").reduce((s, a) => s + a.quantity, 0),
      "Available": avail(r),
      "Shop Price": r.listing_price_cents ? (r.listing_price_cents / 100).toFixed(2) : "",
      "Status": r.status, "Date Added": new Date(r.created_at).toLocaleDateString(),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory");
    XLSX.writeFile(wb, "inventory.xlsx");
  }

  function parseImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const data = new Uint8Array(ev.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });
      const rows: ImportRow[] = raw.map(r => {
        const plant_name = (r["Plant Name"] || r["plant_name"] || r["name"] || "").toString().trim();
        const qty = parseInt((r["Quantity"] || r["quantity"] || r["qty"] || "0").toString(), 10);
        const valid = !!plant_name && !isNaN(qty) && qty > 0;
        return {
          plant_name,
          variety: (r["Variety"] || r["variety"] || "").toString().trim(),
          pot_size: (r["Pot Size"] || r["pot_size"] || r["size"] || "").toString().trim(),
          quantity: isNaN(qty) ? 0 : qty,
          category: (r["Category"] || r["category"] || "").toString().trim(),
          description: (r["Description"] || r["description"] || "").toString().trim(),
          notes: (r["Notes"] || r["notes"] || "").toString().trim(),
          cost_price: (r["Cost Price"] || r["cost_price"] || r["cost"] || "").toString().trim(),
          valid,
          error: !plant_name ? "Missing plant name" : !valid ? "Invalid quantity" : undefined,
        };
      });
      setImportRows(rows);
      setImportOpen(true);
    };
    reader.readAsArrayBuffer(file);
  }

  async function submitImport() {
    const validRows = importRows.filter(r => r.valid);
    if (!validRows.length) return;
    setImportSubmitting(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setImportSubmitting(false); return; }
    let success = 0;
    for (const r of validRows) {
      const { error } = await supabase.from("inventory").insert({
        seller_id: user.id,
        plant_name: r.plant_name,
        variety: r.variety || null,
        pot_size: r.pot_size || null,
        quantity: r.quantity,
        category: r.category || null,
        description: r.description || null,
        notes: r.notes || null,
        cost_cents: r.cost_price ? dollarsToCents(r.cost_price) : null,
        images: [],
      });
      if (!error) success++;
    }
    setImportSubmitting(false);
    setImportOpen(false);
    setImportRows([]);
    toast.success(`${success} item${success !== 1 ? "s" : ""} added to inventory`);
    router.refresh();
  }

  // ── Flat list row ─────────────────────────────────────────────────────────
  function renderFlatRow(row: Row, plantName: string) {
    const a = avail(row);
    const hasListing = !!row.listing_id;
    const activeAuctions = row.auctions.filter(au => au.status === "active");
    const totalAuctionQty = activeAuctions.reduce((sum, au) => sum + au.quantity, 0);
    return (
      <tr
        key={row.id}
        className="border-t border-border/40 hover:bg-muted/20 transition-colors"
      >
        <td className="py-2.5 pl-4 pr-1 text-sm font-medium max-w-[160px] truncate">{plantName}</td>
        <td className="px-2 py-2.5 text-sm text-muted-foreground max-w-[120px] truncate">{row.variety || "—"}</td>
        <td className="px-2 py-2.5 text-sm">
          {row.pot_size
            ? <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs">{row.pot_size}</span>
            : <span className="text-xs text-muted-foreground italic">—</span>}
        </td>
        <td className="px-2 py-2.5 text-sm tabular-nums">
          <span className="font-medium">{row.quantity}</span>
          {a !== row.quantity && <span className="text-xs text-muted-foreground ml-1">({a} avail)</span>}
          {(row.listing_quantity ?? 0) > 0 && <span className="text-xs text-green-600 block">{row.listing_quantity} in shop</span>}
          {totalAuctionQty > 0 && <span className="text-xs text-blue-600 block">{totalAuctionQty} in auction</span>}
        </td>
        <td className="px-2 py-2.5 text-sm">
          <span className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
            row.status === "In Shop" || row.status === "Shop + Auction" ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" :
            row.status.includes("Auction") ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400" :
            row.status === "Paused" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400" :
            "bg-muted text-muted-foreground"
          )}>
            {row.status}
          </span>
        </td>
        <td className="px-2 py-2.5 text-right w-16">
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
              <MoreHorizontal size={15} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[160px]">
              <DropdownMenuItem onClick={() => openModal({ type: "edit", row })}>Edit item</DropdownMenuItem>
              <DropdownMenuItem onClick={() => duplicateItem(row)}><Copy size={13} className="mr-1.5" /> Duplicate</DropdownMenuItem>
              <DropdownMenuItem onClick={() => openModal({ type: "sold", row })}>Mark as sold</DropdownMenuItem>
              {hasListing && (
                <DropdownMenuItem onClick={() => toggleListingPause(row)}>
                  {row.listing_status === "active" ? "Pause listing" : "Resume listing"}
                </DropdownMenuItem>
              )}
              {a > 0 && !hasListing && (
                <DropdownMenuItem onClick={() => openModal({ type: "listing", row })}><Store size={13} className="mr-1.5" /> List in Shop</DropdownMenuItem>
              )}
              {a > 0 && (
                <DropdownMenuItem onClick={() => openModal({ type: "auction", row })}><Gavel size={13} className="mr-1.5" /> {activeAuctions.length > 0 ? "Add Auction" : "Auction"}</DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => archiveItem(row.id)} disabled={loadingId === row.id} className="text-destructive focus:text-destructive">Archive</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </td>
      </tr>
    );
  }

  // ── Mobile variant card ───────────────────────────────────────────────────
  function renderVariantCard(row: Row) {
    const a = avail(row);
    const hasListing = !!row.listing_id;
    const activeAuctions = row.auctions.filter(au => au.status === "active");
    const endedAuctions = row.auctions.filter(au => au.status !== "active");
    const totalAuctionQty = activeAuctions.reduce((sum, au) => sum + au.quantity, 0);
    const dropdownMenu = (
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
          <MoreHorizontal size={15} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[160px]">
          <DropdownMenuItem onClick={() => openModal({ type: "edit", row })}>Edit item</DropdownMenuItem>
          <DropdownMenuItem onClick={() => duplicateItem(row)}>
            <Copy size={13} className="mr-1.5" /> Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openModal({ type: "sold", row })}>Mark as sold</DropdownMenuItem>
          {hasListing && (
            <DropdownMenuItem onClick={() => { setModal(null); toggleListingPause(row); }}>
              {row.listing_status === "active" ? "Pause listing" : "Resume listing"}
            </DropdownMenuItem>
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
          {row.notes && (
            <div className="relative group/note shrink-0">
              <StickyNote size={13} className="text-muted-foreground cursor-help" />
              <div className="pointer-events-none absolute bottom-full left-0 mb-1.5 hidden group-hover/note:block z-50 w-56 rounded-md bg-popover border shadow-md p-2.5 text-xs text-foreground whitespace-pre-wrap">
                <p className="text-muted-foreground font-medium mb-1">Private note</p>
                {row.notes}
              </div>
            </div>
          )}
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
        {(!!row.listing_id || totalAuctionQty > 0) && (
          <div className="flex gap-3 text-xs">
            {!!row.listing_id && (
              row.listing_id && editingListingQtyId === row.id ? (
                <input
                  type="number" min={0} max={row.quantity - totalAuctionQty}
                  value={editingListingQtyValue}
                  onChange={e => setEditingListingQtyValue(e.target.value)}
                  onBlur={() => saveListingQtyEdit(row)}
                  onKeyDown={e => { if (e.key === "Enter") saveListingQtyEdit(row); if (e.key === "Escape") setEditingListingQtyId(null); }}
                  autoFocus
                  className="w-16 px-1 py-0 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-green-600"
                />
              ) : (
                <button
                  onClick={() => { setEditingListingQtyId(row.id); setEditingListingQtyValue(String(row.listing_quantity ?? 0)); }}
                  className={(row.listing_quantity ?? 0) === 0 ? "text-amber-600 hover:text-amber-800 hover:underline tabular-nums" : "text-green-600 hover:text-green-800 hover:underline tabular-nums"}
                  title="Click to edit shop quantity"
                >
                  {row.listing_quantity ?? 0} in shop
                </button>
              )
            )}
            {totalAuctionQty > 0 && <span className="text-blue-600">{totalAuctionQty} in auction</span>}
            <span className={cn(
              "flex items-center gap-0.5",
              row.low_stock_threshold != null && a <= row.low_stock_threshold ? "text-amber-600 font-semibold" : "text-muted-foreground"
            )}>
              {row.low_stock_threshold != null && a <= row.low_stock_threshold && <AlertTriangle size={10} />}
              {a} avail
            </span>
          </div>
        )}

        {/* Shop */}
        {hasListing ? (
          <div className="space-y-1">
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
              <button onClick={() => openModal({ type: "sale", row })} className={`text-xs hover:underline font-medium ${row.listing_sale_price_cents && row.listing_sale_ends_at && new Date(row.listing_sale_ends_at) > new Date() ? "text-orange-600" : "text-muted-foreground"}`}>
                {row.listing_sale_price_cents && row.listing_sale_ends_at && new Date(row.listing_sale_ends_at) > new Date() ? "✦ Sale active" : "Run a Special"}
              </button>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {row.listing_created_at && (
                <span className="text-xs text-muted-foreground">{listingAge(row.listing_created_at)}</span>
              )}
              {row.cost_cents && row.listing_price_cents && (
                <span className="text-xs text-muted-foreground">
                  Margin: {Math.round(((row.listing_price_cents - row.cost_cents) / row.listing_price_cents) * 100)}%
                </span>
              )}
            </div>
            {a === 0 && row.listing_status === "active" && (
              <div className="flex items-center gap-1 text-xs text-amber-600 font-medium">
                <AlertTriangle size={11} /> Fully committed — consider pausing
              </div>
            )}
          </div>
        ) : a > 0 ? (
          <button onClick={() => openModal({ type: "listing", row })} className="inline-flex items-center gap-1.5 text-sm text-green-700 hover:underline font-medium">
            <Store size={13} /> List in Shop
          </button>
        ) : null}

        {/* Auctions */}
        <div className="space-y-1.5">
          {activeAuctions.map(au => (
            <div key={au.id} className="flex items-center gap-2 flex-wrap text-sm">
              <Gavel size={12} className="text-blue-600 shrink-0" />
              <span className="font-medium">{centsToDisplay(au.current_bid_cents)}</span>
              <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 rounded-full px-2 py-0.5">live · {au.quantity} qty</span>
              <span className="text-xs text-muted-foreground">Ends {new Date(au.ends_at).toLocaleDateString()}</span>
              <Link href={`/auctions/${au.id}`} target="_blank" className="text-xs hover:underline">View</Link>
            </div>
          ))}
          {endedAuctions.map(au => (
            <div key={au.id} className="flex items-center gap-2 text-xs text-muted-foreground">
              <Gavel size={11} className="shrink-0" />
              <span className="capitalize">{au.status}</span>
              <Link href={`/auctions/${au.id}`} target="_blank" className="hover:underline">View</Link>
              <button onClick={() => unlinkAuction(row, au.id)} className="hover:underline hover:text-foreground">Unlink</button>
            </div>
          ))}
          {a > 0 && (
            <button onClick={() => openModal({ type: "auction", row })} className="inline-flex items-center gap-1.5 text-sm text-purple-700 hover:underline font-medium">
              <Gavel size={13} /> {activeAuctions.length > 0 ? "Add Auction" : "Auction"}
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Variant sub-row ───────────────────────────────────────────────────────
  function renderVariantRow(row: Row) {
    const a = avail(row);
    const hasListing = !!row.listing_id;
    const activeAuctions = row.auctions.filter(au => au.status === "active");
    const endedAuctions = row.auctions.filter(au => au.status !== "active");
    const totalAuctionQty = activeAuctions.reduce((sum, au) => sum + au.quantity, 0);

    return (
      <tr key={row.id} className="border-t border-border/40 hover:bg-muted/20 transition-colors">
        {/* Size */}
        <td className="py-3 pl-12 pr-3 w-28">
          <div className="flex items-center gap-1.5">
            {row.pot_size ? (
              <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium">{row.pot_size}</span>
            ) : (
              <span className="text-xs text-muted-foreground italic">No size</span>
            )}
            {row.notes && (
              <div className="relative group/note">
                <StickyNote size={12} className="text-muted-foreground cursor-help shrink-0" />
                <div className="pointer-events-none absolute bottom-full left-0 mb-1.5 hidden group-hover/note:block z-50 w-56 rounded-md bg-popover border shadow-md p-2.5 text-xs text-foreground whitespace-pre-wrap">
                  <p className="text-muted-foreground font-medium mb-1">Private note</p>
                  {row.notes}
                </div>
              </div>
            )}
          </div>
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
          {(!!row.listing_id || totalAuctionQty > 0) && (
            <div className="text-xs mt-0.5 space-y-0.5">
              {!!row.listing_id && (
                row.listing_id && editingListingQtyId === row.id ? (
                  <input
                    type="number" min={0} max={row.quantity - totalAuctionQty}
                    value={editingListingQtyValue}
                    onChange={e => setEditingListingQtyValue(e.target.value)}
                    onBlur={() => saveListingQtyEdit(row)}
                    onKeyDown={e => { if (e.key === "Enter") saveListingQtyEdit(row); if (e.key === "Escape") setEditingListingQtyId(null); }}
                    autoFocus
                    className="w-16 px-1 py-0 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-green-600"
                  />
                ) : (
                  <button
                    onClick={() => { setEditingListingQtyId(row.id); setEditingListingQtyValue(String(row.listing_quantity ?? 0)); }}
                    className={(row.listing_quantity ?? 0) === 0 ? "text-amber-600 hover:text-amber-800 hover:underline tabular-nums block" : "text-green-600 hover:text-green-800 hover:underline tabular-nums block"}
                    title="Click to edit shop quantity"
                  >
                    {row.listing_quantity ?? 0} in shop
                  </button>
                )
              )}
              {totalAuctionQty > 0 && <div className="text-blue-600">{totalAuctionQty} in auction</div>}
              <div className={cn(
                "flex items-center gap-0.5",
                row.low_stock_threshold != null && a <= row.low_stock_threshold ? "text-amber-600 font-semibold" : "text-muted-foreground"
              )}>
                {row.low_stock_threshold != null && a <= row.low_stock_threshold && <AlertTriangle size={11} />}
                {a} available
              </div>
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
              <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                <span>{row.listing_quantity} listed</span>
                <button onClick={() => openModal({ type: "edit-listing", row })} className="text-blue-600 hover:underline">Edit</button>
                <Link href={`/shop/${row.listing_id}`} target="_blank" className="text-muted-foreground hover:underline">View</Link>
                <button onClick={() => openModal({ type: "sale", row })} className={`hover:underline font-medium ${row.listing_sale_price_cents && row.listing_sale_ends_at && new Date(row.listing_sale_ends_at) > new Date() ? "text-orange-600" : "text-muted-foreground"}`}>
                  {row.listing_sale_price_cents && row.listing_sale_ends_at && new Date(row.listing_sale_ends_at) > new Date() ? "✦ Sale active" : "Run a Special"}
                </button>
                {row.listing_created_at && (
                  <span>{listingAge(row.listing_created_at)}</span>
                )}
                {row.cost_cents && row.listing_price_cents && (
                  <span>Margin: {Math.round(((row.listing_price_cents - row.cost_cents) / row.listing_price_cents) * 100)}%</span>
                )}
              </div>
              {a === 0 && row.listing_status === "active" && (
                <div className="flex items-center gap-1 text-xs text-amber-600 font-medium">
                  <AlertTriangle size={11} /> Fully committed — consider pausing
                </div>
              )}
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
          <div className="space-y-1.5">
            {activeAuctions.map(au => (
              <div key={au.id} className="space-y-0.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-medium text-sm">{centsToDisplay(au.current_bid_cents)}</span>
                  <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 rounded-full px-2 py-0.5">live · {au.quantity} qty</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Ends {new Date(au.ends_at).toLocaleDateString()}</span>
                  <Link href={`/auctions/${au.id}`} target="_blank" className="hover:underline">View</Link>
                </div>
              </div>
            ))}
            {endedAuctions.map(au => (
              <div key={au.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="capitalize">{au.status}</span>
                <Link href={`/auctions/${au.id}`} target="_blank" className="hover:underline">View</Link>
                <button onClick={() => unlinkAuction(row, au.id)} className="hover:underline hover:text-foreground">Unlink</button>
              </div>
            ))}
            {a > 0 ? (
              <button
                onClick={() => openModal({ type: "auction", row })}
                className="inline-flex items-center gap-1.5 text-sm text-purple-700 hover:underline font-medium"
              >
                <Gavel size={13} /> {activeAuctions.length > 0 ? "Add Auction" : "Auction"}
              </button>
            ) : row.auctions.length === 0 ? (
              <span className="text-xs text-muted-foreground">—</span>
            ) : null}
          </div>
        </td>

        {/* Actions */}
        <td className="px-3 py-3 text-right w-12">
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
              <MoreHorizontal size={15} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[160px]">
              <DropdownMenuItem onClick={() => openModal({ type: "edit", row })}>Edit item</DropdownMenuItem>
              <DropdownMenuItem onClick={() => duplicateItem(row)}>
                <Copy size={13} className="mr-1.5" /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openModal({ type: "sold", row })}>Mark as sold</DropdownMenuItem>
              {hasListing && (
                <DropdownMenuItem onClick={() => { setModal(null); toggleListingPause(row); }}>
                  {row.listing_status === "active" ? "Pause listing" : "Resume listing"}
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
    const hasLiveAuction = group.variants.some(v => v.auctions.some(au => au.status === "active"));
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
            <Image src={first.images[0]} alt="" width={32} height={32} className="w-8 h-8 rounded object-cover shrink-0 border" />
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
      {/* Inventory welcome modal — shown until first item is added */}
      <Dialog open={welcomeOpen} onOpenChange={setWelcomeOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">Welcome to your Inventory 👋</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mt-1">
              Here&apos;s how it works in 3 steps:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-green-100 text-green-700 font-bold flex items-center justify-center text-sm">1</span>
              <div>
                <p className="font-medium text-sm">Add your plants to inventory</p>
                <p className="text-xs text-muted-foreground">Click <strong>+ Add</strong> to create an inventory item. Enter the plant name, variety, and how many you have in stock.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-green-100 text-green-700 font-bold flex items-center justify-center text-sm">2</span>
              <div>
                <p className="font-medium text-sm">List it in your shop or start an auction</p>
                <p className="text-xs text-muted-foreground">Each inventory row has a <strong>List in Shop</strong> and <strong>Create Auction</strong> button. Allocate some stock to each — you stay in control of how many go where.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-green-100 text-green-700 font-bold flex items-center justify-center text-sm">3</span>
              <div>
                <p className="font-medium text-sm">Stock updates automatically when you sell</p>
                <p className="text-xs text-muted-foreground">When a buyer purchases, your inventory count decrements automatically. You can also log off-platform sales manually.</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground pt-1">Need help later? Click the <strong>?</strong> next to the Inventory heading anytime.</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button className="bg-green-700 hover:bg-green-800" onClick={() => setWelcomeOpen(false)}>
              Got it, let&apos;s go!
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <SellerAgreementDialog
        open={agreementDialogOpen}
        onOpenChange={setAgreementDialogOpen}
        onAccepted={() => {
          setLocalTermsAccepted(true);
          if (pendingModal) {
            setPendingModal(null);
            openModal(pendingModal);
          }
        }}
      />

      {!stripeOnboarded && activeRows.some(r => r.listing_id || r.auctions.length > 0) && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          <strong>Your listings are not visible to buyers yet.</strong> They appear on your personal storefront, but won&apos;t show in the public shop or auctions until you{" "}
          <a href="/account#seller-payments" className="underline font-medium hover:opacity-80">connect your Stripe account</a>.
          Buyers also cannot purchase until this is set up.
        </div>
      )}

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
          <div className="flex items-center rounded-md border overflow-hidden">
            <button
              onClick={() => setViewMode("grouped")}
              className={cn("flex items-center gap-1 px-2.5 py-1.5 text-xs transition-colors", viewMode === "grouped" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")}
              title="Grouped view"
            >
              <LayoutGrid size={14} />
            </button>
            <button
              onClick={() => setViewMode("flat")}
              className={cn("flex items-center gap-1 px-2.5 py-1.5 text-xs transition-colors border-l", viewMode === "flat" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")}
              title="Flat list view"
            >
              <LayoutList size={14} />
            </button>
          </div>
          <button onClick={() => csvInputRef.current?.click()} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "flex items-center gap-1.5")}>
            <Upload size={13} /> Import
          </button>
          <input ref={csvInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={parseImportFile} />
          <button onClick={exportExcel} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>Export</button>
          <Link href="/dashboard/create" className={cn(buttonVariants({ size: "sm" }), "bg-green-700 hover:bg-green-800")}>+ Add</Link>
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
            {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={v => setSortBy(v as typeof sortBy)}>
          <SelectTrigger className="w-44">
            <span className="flex items-center gap-1.5"><ArrowUpDown size={13} /><SelectValue /></span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Name (A–Z)</SelectItem>
            <SelectItem value="avail-asc">Available (low first)</SelectItem>
            <SelectItem value="date-desc">Recently added</SelectItem>
            <SelectItem value="price-asc">Price (low first)</SelectItem>
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
      ) : viewMode === "flat" ? (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30">
                <th className="py-2.5 pl-4 pr-1 text-left text-xs font-medium text-muted-foreground">Plant</th>
                <th className="px-2 py-2.5 text-left text-xs font-medium text-muted-foreground">Variety</th>
                <th className="px-2 py-2.5 text-left text-xs font-medium text-muted-foreground">Size</th>
                <th className="px-2 py-2.5 text-left text-xs font-medium text-muted-foreground">Stock</th>
                <th className="px-2 py-2.5 text-left text-xs font-medium text-muted-foreground">Status</th>
                <th className="px-2 py-2.5 w-16" />
              </tr>
            </thead>
            <tbody>
              {activeGroups.flatMap(g =>
                g.variants.map(row => renderFlatRow(row, g.plant_name))
              )}
            </tbody>
          </table>
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
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
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
                <Input id="edit-list-qty" type="number" min={0} value={listQty} onChange={e => setListQty(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Pot Size</Label>
                <PotSizePicker value={editPotSize} onChange={setEditPotSize} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-bundle-disc">Bundle Discount <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <div className="flex items-center gap-2">
                  <Input id="edit-bundle-disc" type="number" min={1} max={80} step={1} value={bundleDiscountPct} onChange={e => setBundleDiscountPct(e.target.value)} placeholder="e.g. 10" className="w-28" />
                  <span className="text-sm text-muted-foreground">% off when buying 2+</span>
                </div>
              </div>
              <div className="space-y-1">
                <Label>When sold out</Label>
                <Select value={soldOutBehavior} onValueChange={v => setSoldOutBehavior(v as "mark_sold_out" | "auto_pause")}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mark_sold_out">Stay visible as "Sold Out"</SelectItem>
                    <SelectItem value="auto_pause">Auto-hide listing</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Sold Out keeps the page for SEO. Auto-hide removes it from the shop.</p>
              </div>
              <div className="space-y-1">
                <Label>Care Guide PDF <span className="text-muted-foreground font-normal">(optional)</span></Label>
                {careGuidePdfUrl ? (
                  <div className="flex items-center gap-2">
                    <a href={careGuidePdfUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-green-700 hover:underline truncate flex-1">View uploaded PDF</a>
                    <button onClick={() => setCareGuidePdfUrl(null)} className="text-xs text-muted-foreground hover:text-destructive">Remove</button>
                  </div>
                ) : (
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                    <Upload size={14} />
                    {careGuidePdfUploading ? "Uploading…" : "Upload PDF (max 10 MB)"}
                    <input type="file" accept=".pdf,application/pdf" className="hidden" onChange={uploadCareGuidePdf} disabled={careGuidePdfUploading} />
                  </label>
                )}
                <p className="text-xs text-muted-foreground">Buyers get a download link in their order confirmation.</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Photos</Label>
                  {editImages.length > 1 && <span className="text-xs text-muted-foreground">First photo is the cover</span>}
                </div>
                {editImages.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {editImages.map((url, idx) => (
                      <div key={url + idx} className="relative group">
                        <Image src={url} alt="" width={64} height={64} className="w-16 h-16 rounded object-cover border" />
                        {idx === 0 && (
                          <span className="absolute bottom-0 left-0 right-0 text-center text-[9px] font-semibold bg-black/60 text-white rounded-b py-0.5">Cover</span>
                        )}
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
      <Dialog open={modal?.type === "auction"} onOpenChange={o => { if (!o) { setModal(null); setAuctionAck(false); } }}>
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
                  <Label htmlFor="modal-reserve">Reserve Price ($) <span className="font-normal text-muted-foreground">(optional)</span></Label>
                  <Input id="modal-reserve" type="number" min={0.01} step={0.01} value={reservePrice} onChange={e => setReservePrice(e.target.value)} placeholder="Hidden minimum to sell" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="modal-starts">Scheduled Start <span className="font-normal text-muted-foreground">(optional — goes live immediately if blank)</span></Label>
                  <Input id="modal-starts" type="datetime-local" value={startsAt} onChange={e => setStartsAt(e.target.value)} min={new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(0, 16)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="modal-ends">End Date & Time *</Label>
                  <Input id="modal-ends" type="datetime-local" value={endsAt} onChange={e => setEndsAt(e.target.value)} min={new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16)} />
                </div>
                <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3 text-xs text-amber-800 dark:text-amber-300">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={auctionAck}
                      onChange={e => setAuctionAck(e.target.checked)}
                      className="mt-0.5 shrink-0"
                    />
                    <span>I understand that once this auction goes live it <strong>cannot be cancelled, modified, or removed</strong>.</span>
                  </label>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" onClick={() => { setModal(null); setAuctionAck(false); }} className="flex-1">Cancel</Button>
                  <Button onClick={submitAuction} disabled={submitting || !startingBid || !endsAt || !auctionQty || !auctionAck} className="flex-1 bg-green-700 hover:bg-green-800">
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
                    {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
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
                <div className="flex items-center justify-between">
                  <Label>Photos</Label>
                  {editImages.length > 1 && <span className="text-xs text-muted-foreground">Drag to reorder · First photo is the cover</span>}
                </div>
                {editImages.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {editImages.map((url, idx) => (
                      <div
                        key={url + idx}
                        className={cn("relative group cursor-grab active:cursor-grabbing", dragPhotoIdx === idx && "opacity-40")}
                        draggable
                        onDragStart={() => setDragPhotoIdx(idx)}
                        onDragOver={e => e.preventDefault()}
                        onDrop={e => {
                          e.preventDefault();
                          if (dragPhotoIdx === null || dragPhotoIdx === idx) return;
                          const reordered = [...editImages];
                          const [moved] = reordered.splice(dragPhotoIdx, 1);
                          reordered.splice(idx, 0, moved);
                          setEditImages(reordered);
                          setDragPhotoIdx(null);
                        }}
                        onDragEnd={() => setDragPhotoIdx(null)}
                      >
                        <Image src={url} alt="" width={64} height={64} className="w-16 h-16 rounded object-cover border" />
                        {idx === 0 && (
                          <span className="absolute bottom-0 left-0 right-0 text-center text-[9px] font-semibold bg-black/60 text-white rounded-b py-0.5">Cover</span>
                        )}
                        <div className="absolute top-0.5 left-0.5 opacity-0 group-hover:opacity-80 transition-opacity">
                          <GripVertical size={12} className="text-white drop-shadow" />
                        </div>
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
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="edit-cost">Cost per unit ($) <span className="font-normal text-muted-foreground">(optional)</span></Label>
                  <Input
                    id="edit-cost"
                    type="number"
                    min={0}
                    step={0.01}
                    value={editCostPrice}
                    onChange={e => setEditCostPrice(e.target.value)}
                    placeholder="0.00"
                  />
                  <p className="text-xs text-muted-foreground">Private — used to calculate margin</p>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-threshold">Low stock alert <span className="font-normal text-muted-foreground">(optional)</span></Label>
                  <Input
                    id="edit-threshold"
                    type="number"
                    min={0}
                    value={editLowStockThreshold}
                    onChange={e => setEditLowStockThreshold(e.target.value)}
                    placeholder="e.g. 3"
                  />
                  <p className="text-xs text-muted-foreground">Warn when available ≤ this</p>
                </div>
              </div>
              {/* Templates */}
              {templates.length > 0 && (
                <div className="space-y-1 border-t pt-3">
                  <Label>Load template</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {templates.map(t => (
                      <div key={t.id} className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditPlantName(t.plant_name);
                            setEditVariety(t.variety ?? "");
                            setEditCategory(t.category ?? "");
                            setEditPotSize(t.pot_size ?? "");
                            setEditDescription(t.description ?? "");
                            toast.success(`Loaded "${t.name}"`);
                          }}
                          className="text-xs bg-muted hover:bg-muted/70 px-2 py-1 rounded border"
                        >
                          {t.name}
                        </button>
                        <button type="button" onClick={() => deleteTemplate(t.id)} className="text-muted-foreground hover:text-destructive">
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="space-y-1 border-t pt-3">
                <Label>Save as template <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <div className="flex gap-2">
                  <Input
                    value={saveTemplateName}
                    onChange={e => setSaveTemplateName(e.target.value)}
                    placeholder="Template name, e.g. Monstera"
                    className="text-sm"
                    onKeyDown={e => e.key === "Enter" && saveAsTemplate()}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={saveAsTemplate} disabled={savingTemplate || !saveTemplateName.trim()}>
                    {savingTemplate ? "…" : "Save"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Saves current name, variety, category, pot size, and description as a reusable template.</p>
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

      {/* ── CSV Import Preview ── */}
      <Dialog open={importOpen} onOpenChange={o => { if (!o) { setImportOpen(false); setImportRows([]); } }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Preview</DialogTitle>
            <DialogDescription>
              {importRows.filter(r => r.valid).length} of {importRows.length} rows are valid and will be added to inventory.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 border rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/30">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Plant Name</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Variety</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Size</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Qty</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Category</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Cost</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {importRows.map((r, i) => (
                  <tr key={i} className={cn("border-t border-border/40", !r.valid && "bg-red-50 dark:bg-red-900/10")}>
                    <td className="px-3 py-2 font-medium">{r.plant_name || <span className="text-red-500 italic">missing</span>}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.variety || "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.pot_size || "—"}</td>
                    <td className={cn("px-3 py-2 tabular-nums", r.quantity <= 0 && "text-red-500")}>{r.quantity}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.category || "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.cost_price ? `$${r.cost_price}` : "—"}</td>
                    <td className="px-3 py-2">
                      {r.valid
                        ? <span className="text-green-600 font-medium">Ready</span>
                        : <span className="text-red-500">{r.error}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 text-xs text-muted-foreground">
            <p className="font-medium mb-1">Expected columns (case-insensitive):</p>
            <p>Plant Name · Variety · Pot Size · Quantity · Category · Description · Notes · Cost Price</p>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => { setImportOpen(false); setImportRows([]); }} className="flex-1">Cancel</Button>
            <Button
              onClick={submitImport}
              disabled={importSubmitting || importRows.filter(r => r.valid).length === 0}
              className="flex-1 bg-green-700 hover:bg-green-800"
            >
              {importSubmitting ? "Importing…" : `Add ${importRows.filter(r => r.valid).length} Items`}
            </Button>
          </div>
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

      {/* ── Run a Special ── */}
      <Dialog open={modal?.type === "sale"} onOpenChange={o => !o && setModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Run a Special</DialogTitle>
            <DialogDescription>
              {modal?.type === "sale" && `Set a limited-time sale price for ${modal.row.plant_name}${modal.row.variety ? ` ${modal.row.variety}` : ""}. Regular price: ${modal.row.listing_price_cents ? centsToDisplay(modal.row.listing_price_cents) : "—"}.`}
            </DialogDescription>
          </DialogHeader>
          {modal?.type === "sale" && (() => {
            const isActive = !!(modal.row.listing_sale_price_cents && modal.row.listing_sale_ends_at && new Date(modal.row.listing_sale_ends_at) > new Date());
            return (
              <div className="space-y-4 mt-1">
                {isActive && (
                  <div className="rounded-md bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 px-3 py-2 text-sm text-orange-800 dark:text-orange-300">
                    Active sale: <strong>{centsToDisplay(modal.row.listing_sale_price_cents!)}</strong> — ends {new Date(modal.row.listing_sale_ends_at!).toLocaleString()}
                  </div>
                )}
                <div className="space-y-1">
                  <Label>Sale Price ($)</Label>
                  <Input
                    type="number"
                    min={0.01}
                    step={0.01}
                    value={salePrice}
                    onChange={(e) => setSalePrice(e.target.value)}
                    placeholder={modal.row.listing_price_cents ? `Less than ${centsToDisplay(modal.row.listing_price_cents)}` : "Sale price"}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Sale Ends</Label>
                  <Input
                    type="datetime-local"
                    value={saleEndsAt}
                    min={new Date().toISOString().slice(0, 16)}
                    onChange={(e) => setSaleEndsAt(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  {isActive && (
                    <Button variant="outline" onClick={() => submitSale(true)} disabled={submitting} className="flex-1 text-destructive border-destructive/40 hover:bg-destructive/10">
                      End Sale Early
                    </Button>
                  )}
                  <Button
                    onClick={() => submitSale(false)}
                    disabled={submitting || !salePrice || !saleEndsAt}
                    className="flex-1 bg-orange-600 hover:bg-orange-700"
                  >
                    {submitting ? "Saving…" : isActive ? "Update Sale" : "Start Sale"}
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
