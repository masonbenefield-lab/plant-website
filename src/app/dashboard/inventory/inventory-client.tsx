"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { compressImage } from "@/lib/compress-image";
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
import { SUPPLY_CATEGORIES } from "@/lib/categories";
import PriceSuggestion from "@/components/price-suggestion";
import SellerAgreementDialog from "@/components/seller-agreement-dialog";
import { findProhibitedWord, censorWord, logViolation } from "@/lib/profanity";
import type { PlanLimits } from "@/lib/plan-limits";

const BASE_CATEGORIES = [
  "Aroids", "Succulents & Cacti", "Orchids", "Carnivorous Plants",
  "Ferns & Mosses", "Herbs & Edibles", "Fruit Trees", "Outdoor & Perennials",
  "Rare & Exotic", "Seasonal", "Garden Supplies", "Other",
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
  listing_last_activated_at: string | null;
  auctions: AuctionSummary[];
  shipping_weight_oz: number | null;
  shipping_cost_cents: number | null;
  free_shipping: boolean;
  low_stock_threshold: number | null;
  cost_cents: number | null;
  status: string;
  description: string;
  notes: string;
  images: string[];
  category: string | null;
  pot_size: string | null;
  item_type: string;
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
  | { type: "auction"; row: Row }
  | { type: "edit"; row: Row }
  | { type: "sold"; row: Row }
  | { type: "add-variant"; plant_name: string; variety: string; category: string | null }
  | null;

function daysUntilPurge(archivedAt: string) {
  const purge = new Date(archivedAt).getTime() + 30 * 24 * 60 * 60 * 1000;
  return Math.max(0, Math.ceil((purge - Date.now()) / (1000 * 60 * 60 * 24)));
}

const SUPPLY_ONLY = new Set<string>(SUPPLY_CATEGORIES.filter(c => c !== "Other"));
function isSupply(row: Row): boolean {
  if (row.item_type === "supply") return true;
  if (row.item_type === "plant") return false;
  return !!(row.category && SUPPLY_ONLY.has(row.category));
}

function groupRows(rows: Row[]): PlantGroup[] {
  const map = new Map<string, PlantGroup>();
  for (const row of rows) {
    const supply = isSupply(row);
    // Supplies: group by item name only — variety is the per-row variant label
    // Plants: group by name + variety — pot_size is the per-row size
    const key = supply
      ? row.plant_name.toLowerCase()
      : `${row.plant_name.toLowerCase()}|||${(row.variety ?? "").toLowerCase()}`;
    if (!map.has(key)) {
      map.set(key, { key, plant_name: row.plant_name, variety: supply ? "" : row.variety, variants: [] });
    }
    map.get(key)!.variants.push(row);
  }
  for (const g of map.values()) {
    const firstIsSupply = g.variants[0] ? isSupply(g.variants[0]) : false;
    g.variants.sort((a, b) =>
      firstIsSupply
        ? (a.variety ?? "zzz").localeCompare(b.variety ?? "zzz")
        : (a.pot_size ?? "zzz").localeCompare(b.pot_size ?? "zzz")
    );
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
  hasReturnPolicy = true,
  hasShippingTimeline = true,
  hasShipFrom = true,
  calculatedShippingEnabled = true,
  planLimits = { listings: null, auctions: 5, photos: 5 },
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
  hasReturnPolicy?: boolean;
  hasShippingTimeline?: boolean;
  hasShipFrom?: boolean;
  calculatedShippingEnabled?: boolean;
  planLimits?: PlanLimits;
}) {
  const router = useRouter();
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [welcomeOpen, setWelcomeOpen] = useState(showWelcome);
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const groups = groupRows(activeRows);
    if (groups.length <= 5) return new Set(groups.map(g => g.key));
    return new Set();
  });
  const [showArchived, setShowArchived] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [selectedArchivedIds, setSelectedArchivedIds] = useState<Set<string>>(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [bulkOperating, setBulkOperating] = useState(false);
  const [search, setSearch] = useState(initialSearch);
  const [categoryFilter, setCategoryFilter] = useState(initialCategory);
  const [modal, setModal] = useState<ModalState>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [localTermsAccepted, setLocalTermsAccepted] = useState(termsAccepted);
  const [agreementDialogOpen, setAgreementDialogOpen] = useState(false);
  const [pendingModal, setPendingModal] = useState<ModalState>(null);

  // Inline qty edit
  const [editingQtyId, setEditingQtyId] = useState<string | null>(null);
  const [editingQtyValue, setEditingQtyValue] = useState("");
  const [highlightStockId, setHighlightStockId] = useState<string | null>(null);
  const [editingListingQtyId, setEditingListingQtyId] = useState<string | null>(null);
  const [editingListingQtyValue, setEditingListingQtyValue] = useState("");
  const [relistingId, setRelistingId] = useState<string | null>(null);
  const [relistStock, setRelistStock] = useState("");
  const [relistShopQty, setRelistShopQty] = useState("");

  // Sold-out banner dismiss — stores IDs that were acknowledged; re-shows if a new one appears
  const [dismissedSoldOutIds, setDismissedSoldOutIds] = useState<Set<string>>(() => {
    try {
      const stored = typeof window !== "undefined" ? localStorage.getItem("plantet:dismissed-soldout-ids") : null;
      return new Set(stored ? JSON.parse(stored) : []);
    } catch { return new Set(); }
  });
  const soldOutRows = activeRows.filter(r => r.listing_status === "sold_out");
  const undismissedSoldOut = soldOutRows.filter(r => !dismissedSoldOutIds.has(r.id));

  function dismissSoldOutBanner() {
    const ids = soldOutRows.map(r => r.id);
    const next = new Set([...dismissedSoldOutIds, ...ids]);
    setDismissedSoldOutIds(next);
    try { localStorage.setItem("plantet:dismissed-soldout-ids", JSON.stringify([...next])); } catch { /* ignore */ }
  }

  function dismissSoldOutItem(id: string) {
    const next = new Set([...dismissedSoldOutIds, id]);
    setDismissedSoldOutIds(next);
    try { localStorage.setItem("plantet:dismissed-soldout-ids", JSON.stringify([...next])); } catch { /* ignore */ }
  }

  // Listing modal
  const [price, setPrice] = useState("");
  const [listQty, setListQty] = useState("");
  const [listModalStockQty, setListModalStockQty] = useState("");
  const [listingShippingMode, setListingShippingMode] = useState<"" | "free" | "flat" | "weight">("");
  const [listingShippingCost, setListingShippingCost] = useState("");
  const [listingShippingWeightOz, setListingShippingWeightOz] = useState("");

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
  const [auctionShippingMode, setAuctionShippingMode] = useState<"" | "free" | "flat" | "weight">("");
  const [auctionShippingCost, setAuctionShippingCost] = useState("");
  const [auctionShippingWeightOz, setAuctionShippingWeightOz] = useState("");

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
  const [editShippingMode, setEditShippingMode] = useState<"" | "free" | "flat" | "weight">("");
  const [editShippingCost, setEditShippingCost] = useState("");
  const [editWeightOz, setEditWeightOz] = useState("");
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

  // Edit Item advanced section
  const [showEditAdvanced, setShowEditAdvanced] = useState(false);

  // Inline listing management panel
  const [managingListingId, setManagingListingId] = useState<string | null>(null);
  const [inlinePrice, setInlinePrice] = useState("");
  const [inlineSavingPrice, setInlineSavingPrice] = useState(false);
  const [inlineSalePrice, setInlineSalePrice] = useState("");
  const [inlineSaleEndsAt, setInlineSaleEndsAt] = useState("");
  const [inlineSavingSale, setInlineSavingSale] = useState(false);
  const [inlineShowSale, setInlineShowSale] = useState(false);
  const [inlineDeleteConfirm, setInlineDeleteConfirm] = useState<string | null>(null);
  const [inlineDeleting, setInlineDeleting] = useState(false);

  const [confirmDeleteAuctionId, setConfirmDeleteAuctionId] = useState<string | null>(null);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [importingAll, setImportingAll] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [sortBy, setSortBy] = useState<"name" | "avail-asc" | "date-desc" | "price-asc">("name");
  const [editCostPrice, setEditCostPrice] = useState("");
  const [viewMode, setViewMode] = useState<"grouped" | "flat">("grouped");
  const categories = isAdmin ? ADMIN_CATEGORIES : BASE_CATEGORIES;
  const shippingModes = ["free", "flat", "weight"] as const;
  const [stockTab, setStockTab] = useState<"plants" | "supplies">("plants");

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

  const hasSupplies = useMemo(() => activeRows.some(r => isSupply(r)), [activeRows]);
  const plantGroups = useMemo(() => activeGroups.filter(g => !isSupply(g.variants[0])), [activeGroups]);
  const supplyGroups = useMemo(() => activeGroups.filter(g => isSupply(g.variants[0])), [activeGroups]);
  const visibleGroups = hasSupplies ? (stockTab === "plants" ? plantGroups : supplyGroups) : activeGroups;

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
    if (m.type === "listing") {
      if (!hasShipFrom) {
        toast.error("Ship-from address required", {
          description: "Add your ship-from address in Account Settings before listing items.",
          action: { label: "Account Settings", onClick: () => window.location.href = "/account#shipping-settings" },
          duration: 6000,
        });
        return;
      }
      setPrice(m.row.listing_price_cents ? (m.row.listing_price_cents / 100).toFixed(2) : "");
      setListQty(String(Math.max(1, avail(m.row))));
      setListModalStockQty(String(m.row.quantity));
      if (m.row.free_shipping) {
        setListingShippingMode("free");
        setListingShippingCost("");
        setListingShippingWeightOz("");
      } else if (m.row.shipping_cost_cents) {
        setListingShippingMode("flat");
        setListingShippingCost((m.row.shipping_cost_cents / 100).toFixed(2));
        setListingShippingWeightOz("");
      } else if (m.row.shipping_weight_oz) {
        setListingShippingMode("weight");
        setListingShippingWeightOz(String(m.row.shipping_weight_oz));
        setListingShippingCost("");
      } else {
        setListingShippingMode("");
        setListingShippingCost("");
        setListingShippingWeightOz("");
      }
    }
    if (m.type === "auction") {
      if (!hasShipFrom) {
        toast.error("Ship-from address required", {
          description: "Add your ship-from address in Account Settings before starting an auction.",
          action: { label: "Account Settings", onClick: () => window.location.href = "/account#shipping-settings" },
          duration: 6000,
        });
        return;
      }
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
      if (m.row.free_shipping) {
        setAuctionShippingMode("free");
        setAuctionShippingCost("");
        setAuctionShippingWeightOz("");
      } else if (m.row.shipping_cost_cents) {
        setAuctionShippingMode("flat");
        setAuctionShippingCost(String(m.row.shipping_cost_cents / 100));
        setAuctionShippingWeightOz("");
      } else if (m.row.shipping_weight_oz) {
        setAuctionShippingMode("weight");
        setAuctionShippingWeightOz(String(m.row.shipping_weight_oz));
        setAuctionShippingCost("");
      } else {
        setAuctionShippingMode("");
        setAuctionShippingCost("");
        setAuctionShippingWeightOz("");
      }
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
      if (m.row.free_shipping) {
        setEditShippingMode("free");
        setEditWeightOz("");
        setEditShippingCost("");
      } else if (m.row.shipping_cost_cents) {
        setEditShippingMode("flat");
        setEditShippingCost(String(m.row.shipping_cost_cents / 100));
        setEditWeightOz("");
      } else if (m.row.shipping_weight_oz) {
        setEditShippingMode("weight");
        setEditWeightOz(String(m.row.shipping_weight_oz));
        setEditShippingCost("");
      } else {
        setEditShippingMode("");
        setEditWeightOz("");
        setEditShippingCost("");
      }
      setDragPhotoIdx(null);
      setSaveTemplateName("");
      // Load seller's templates
      createClient().from("listing_templates").select("id, name, plant_name, variety, category, pot_size, description, price_cents").then(({ data }) => {
        if (data) setTemplates(data);
      });
    }
    if (m.type === "edit") {
      const hasAdvanced = !!(
        m.row.cost_cents || m.row.low_stock_threshold ||
        m.row.free_shipping || m.row.shipping_cost_cents || m.row.shipping_weight_oz
      );
      setShowEditAdvanced(hasAdvanced);
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
    if (planLimits.photos !== null && editImages.length >= planLimits.photos) {
      toast.error(`Your plan allows up to ${planLimits.photos} photos per listing. Upgrade to add more.`);
      return;
    }
    setImageUploading(true);
    const supabase = createClient();
    const compressed = await compressImage(file);
    const path = `inventory/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
    const { error } = await supabase.storage.from("listings").upload(path, compressed);
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
    if (error) { toast.error(error.message); return; }
    router.refresh();
  }

  async function saveListingQtyEdit(row: Row) {
    const val = parseInt(editingListingQtyValue, 10);
    setEditingListingQtyId(null);
    if (isNaN(val) || val < 0 || !row.listing_id) return;
    if (val > row.quantity) {
      toast.error(`Only ${row.quantity} in stock — can't list more than you have`);
      setHighlightStockId(row.id);
      setTimeout(() => setHighlightStockId(null), 2000);
      return;
    }
    const newQty = Math.max(0, val);
    const supabase = createClient();
    await Promise.all([
      supabase.from("listings").update({
        quantity: newQty,
        ...(row.listing_status === "sold_out" && newQty > 0 ? { status: "active" } :
            row.listing_status === "active" && newQty === 0 ? { status: "sold_out" } : {}),
      }).eq("id", row.listing_id),
      supabase.from("inventory").update({ listing_quantity: newQty }).eq("id", row.id),
    ]);
    if (row.listing_status === "sold_out" && newQty > 0) {
      // Item is back — clear its dismiss so the banner re-alerts if it sells out again later
      const next = new Set(dismissedSoldOutIds);
      next.delete(row.id);
      setDismissedSoldOutIds(next);
      try { localStorage.setItem("plantet:dismissed-soldout-ids", JSON.stringify([...next])); } catch { /* ignore */ }
      toast.success(`${row.plant_name} is back in your shop!`);
    } else if (row.listing_status === "active" && newQty === 0) {
      toast.info(`${row.plant_name} marked as sold out`);
    }
    router.refresh();
  }

  async function saveRelist(row: Row) {
    const stockVal = parseInt(relistStock, 10);
    const shopVal = parseInt(relistShopQty, 10);
    setRelistingId(null);
    if (isNaN(shopVal) || shopVal < 0 || !row.listing_id) return;
    const newShopQty = Math.max(0, shopVal);
    const supabase = createClient();
    await Promise.all([
      supabase.from("listings").update({
        quantity: newShopQty,
        ...(newShopQty > 0 ? { status: "active" } : {}),
      }).eq("id", row.listing_id),
      !isNaN(stockVal) && stockVal >= 0
        ? supabase.from("inventory").update({ quantity: stockVal, listing_quantity: newShopQty }).eq("id", row.id)
        : supabase.from("inventory").update({ listing_quantity: newShopQty }).eq("id", row.id),
    ]);
    if (newShopQty > 0) {
      const next = new Set(dismissedSoldOutIds);
      next.delete(row.id);
      setDismissedSoldOutIds(next);
      try { localStorage.setItem("plantet:dismissed-soldout-ids", JSON.stringify([...next])); } catch { /* ignore */ }
      toast.success(`${row.plant_name} is back in your shop!`);
    }
    router.refresh();
  }

  async function submitListing() {
    if (!modal || modal.type !== "listing") return;
    setSubmitting(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Not logged in"); setSubmitting(false); return; }

    const { data: profile } = await supabase.from("profiles").select("ship_from_address, calculated_shipping_enabled").eq("id", user.id).single();
    const addr = profile?.ship_from_address as { street1?: string; city?: string; zip?: string } | null;
    const hasShipFrom = !!(addr?.street1?.trim() && addr?.city?.trim() && addr?.zip?.trim());
    const calcShippingOk = (profile as { calculated_shipping_enabled?: boolean | null } | null)?.calculated_shipping_enabled === true;

    if (!hasShipFrom) {
      toast.error("Ship-from address required", {
        description: "Add your ship-from address in Account Settings before creating a listing.",
        action: { label: "Account Settings", onClick: () => router.push("/account#shipping-settings") },
      });
      setSubmitting(false);
      return;
    }

    if (listingShippingMode === "weight" && !calcShippingOk) {
      toast.error("Enable calculated shipping first", {
        description: "Complete your ship-from address and turn on calculated shipping in Shipping Settings.",
        action: { label: "Shipping Settings", onClick: () => router.push("/account#shipping-settings") },
      });
      setSubmitting(false);
      return;
    }

    if (planLimits.listings !== null) {
      const { count } = await supabase.from("listings").select("id", { count: "exact", head: true }).eq("seller_id", user.id).eq("status", "active");
      if ((count ?? 0) >= planLimits.listings) {
        toast.error(`You've reached your ${planLimits.listings}-listing limit. Upgrade your plan to add more.`);
        setSubmitting(false);
        return;
      }
    }

    const modalStockVal = parseInt(listModalStockQty, 10);
    const newTotalStock = !isNaN(modalStockVal) && modalStockVal >= 0 ? modalStockVal : modal.row.quantity;
    // Re-derive available using possibly-updated stock (other allocations remain the same)
    const otherAllocs = (modal.row.listing_quantity ?? 0) + modal.row.auctions.filter(a => a.status === "active").reduce((s, a) => s + a.quantity, 0);
    const a = Math.max(0, newTotalStock - otherAllocs);
    const qty = Math.max(1, Math.min(Number(listQty) || 1, newTotalStock));
    if (qty < 1) { toast.error("No stock available to list"); setSubmitting(false); return; }
    if (qty > newTotalStock) {
      toast.error(`Only ${newTotalStock} in stock — can't list more than you have`);
      setSubmitting(false);
      return;
    }
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
      item_type: modal.row.item_type || null,
      free_shipping: listingShippingMode === "free",
      shipping_cost_cents: listingShippingMode === "flat" ? dollarsToCents(listingShippingCost) : null,
      shipping_weight_oz: listingShippingMode === "weight" ? Number(listingShippingWeightOz) : null,
    }).select("id").single();
    if (error) { toast.error(error.message); setSubmitting(false); return; }
    await supabase.from("inventory").update({
      listing_id: newListing.id,
      listing_quantity: qty,
      ...(newTotalStock !== modal.row.quantity ? { quantity: newTotalStock } : {}),
      free_shipping: listingShippingMode === "free",
      shipping_cost_cents: listingShippingMode === "flat" ? dollarsToCents(listingShippingCost) : null,
      shipping_weight_oz: listingShippingMode === "weight" ? Number(listingShippingWeightOz) : null,
    }).eq("id", modal.row.id);
    setSubmitting(false);
    toast.success(`${modal.row.plant_name} is live in your shop!`);
    setModal(null);
    router.refresh();
  }

  async function toggleListingPause(row: Row) {
    if (!row.listing_id) return;
    const supabase = createClient();
    const newStatus = row.listing_status === "active" ? "paused" : "active";
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const lastActivated = row.listing_last_activated_at ? new Date(row.listing_last_activated_at) : null;
    const bumpActivatedAt = newStatus === "active" && (!lastActivated || lastActivated < sevenDaysAgo);
    await supabase.from("listings").update({
      status: newStatus,
      ...(bumpActivatedAt ? { last_activated_at: new Date().toISOString() } : {}),
    }).eq("id", row.listing_id);
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

    const { data: profile } = await supabase.from("profiles").select("ship_from_address, calculated_shipping_enabled").eq("id", user.id).single();
    const addr2 = profile?.ship_from_address as { street1?: string; city?: string; zip?: string } | null;
    const hasShipFrom2 = !!(addr2?.street1?.trim() && addr2?.city?.trim() && addr2?.zip?.trim());
    const calcShippingOk2 = (profile as { calculated_shipping_enabled?: boolean | null } | null)?.calculated_shipping_enabled === true;

    if (!hasShipFrom2) {
      toast.error("Ship-from address required", {
        description: "Add your ship-from address in Account Settings before starting an auction.",
        action: { label: "Account Settings", onClick: () => router.push("/account#shipping-settings") },
      });
      setSubmitting(false);
      return;
    }

    if (auctionShippingMode === "weight" && !calcShippingOk2) {
      toast.error("Enable calculated shipping first", {
        description: "Complete your ship-from address and turn on calculated shipping in Shipping Settings.",
        action: { label: "Shipping Settings", onClick: () => router.push("/account#shipping-settings") },
      });
      setSubmitting(false);
      return;
    }

    if (planLimits.auctions !== null) {
      const { count } = await supabase.from("auctions").select("id", { count: "exact", head: true }).eq("seller_id", user.id).eq("status", "active");
      if ((count ?? 0) >= planLimits.auctions) {
        toast.error(`You've reached your ${planLimits.auctions}-auction limit. Upgrade your plan to add more.`);
        setSubmitting(false);
        return;
      }
    }

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
      free_shipping: auctionShippingMode === "free",
      shipping_cost_cents: auctionShippingMode === "flat" ? dollarsToCents(auctionShippingCost) : null,
      shipping_weight_oz: auctionShippingMode === "weight" ? Number(auctionShippingWeightOz) : null,
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
      free_shipping: editShippingMode === "free",
      shipping_cost_cents: editShippingMode === "flat" ? dollarsToCents(editShippingCost) : null,
      shipping_weight_oz: editShippingMode === "weight" && editWeightOz !== "" ? Math.max(1, Math.round(parseFloat(editWeightOz))) : null,
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
        free_shipping: editShippingMode === "free",
        shipping_cost_cents: editShippingMode === "flat" ? dollarsToCents(editShippingCost) : null,
        shipping_weight_oz: editShippingMode === "weight" && editWeightOz !== "" ? Math.max(1, Math.round(parseFloat(editWeightOz))) : null,
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
      if (modal.row.listing_id) await supabase.from("listings").update({ status: "paused" }).eq("id", modal.row.listing_id);
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

  async function toggleUnlinkedListingPause(id: string, currentStatus: string) {
    const supabase = createClient();
    const newStatus = currentStatus === "active" ? "paused" : "active";
    const { error } = await supabase.from("listings").update({ status: newStatus }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(newStatus === "paused" ? "Listing paused" : "Listing resumed");
    router.refresh();
  }

  async function deleteUnlinkedListing(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("listings").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Listing deleted");
    router.refresh();
  }

  async function deleteUnlinkedAuction(id: string) {
    const supabase = createClient();
    // Cancel rather than hard-delete to preserve any order/bid history
    const { error } = await supabase.from("auctions").update({ status: "cancelled" }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Auction removed");
    router.refresh();
  }

  async function archiveItem(id: string, listingId: string | null) {
    setLoadingId(id);
    const supabase = createClient();
    const { error } = await supabase.from("inventory").update({ archived_at: new Date().toISOString() }).eq("id", id);
    if (!error) {
      // Pause by direct listing_id reference (primary link)
      if (listingId) {
        await supabase.from("listings").update({ status: "paused" }).eq("id", listingId);
      }
      // Always also pause any listings that reference this inventory row (catches legacy/standalone listings)
      await supabase.from("listings").update({ status: "paused" }).eq("inventory_id", id);
    }
    setLoadingId(null);
    if (error) { toast.error(error.message); return; }
    router.refresh();
    toast("Item archived", {
      action: {
        label: "Undo",
        onClick: async () => {
          const db = createClient();
          await db.from("inventory").update({ archived_at: null }).eq("id", id);
          if (listingId) await db.from("listings").update({ status: "active" }).eq("id", listingId);
          router.refresh();
          toast.success("Restored!");
        },
      },
    });
  }

  async function restoreItem(id: string, listingId: string | null) {
    setLoadingId(id);
    const supabase = createClient();
    const { error } = await supabase.from("inventory").update({ archived_at: null }).eq("id", id);
    if (!error && listingId) {
      await supabase.from("listings").update({ status: "active" }).eq("id", listingId);
    }
    setLoadingId(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Item restored.");
    router.refresh();
  }

  async function deleteArchivedItem(row: Row) {
    setDeletingItemId(row.id);
    const supabase = createClient();
    // Pause linked listings (don't delete — they may have order history)
    if (row.listing_id) {
      await supabase.from("listings").update({ status: "paused" }).eq("id", row.listing_id);
    }
    await supabase.from("listings").update({ status: "paused" }).eq("inventory_id", row.id);
    const { error } = await supabase.from("inventory").delete().eq("id", row.id);
    setDeletingItemId(null);
    setConfirmDeleteId(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Item permanently deleted");
    router.refresh();
  }

  function toggleArchivedSelection(id: string) {
    setSelectedArchivedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function bulkRestoreArchived() {
    setBulkOperating(true);
    const supabase = createClient();
    const ids = [...selectedArchivedIds];
    const rows = archivedRows.filter(r => ids.includes(r.id));
    await Promise.all([
      supabase.from("inventory").update({ archived_at: null }).in("id", ids),
      ...rows.filter(r => r.listing_id).map(r =>
        supabase.from("listings").update({ status: "active" }).eq("id", r.listing_id!)
      ),
    ]);
    setBulkOperating(false);
    setSelectedArchivedIds(new Set());
    toast.success(`${ids.length} item${ids.length !== 1 ? "s" : ""} restored`);
    router.refresh();
  }

  async function bulkDeleteArchived() {
    setBulkOperating(true);
    const supabase = createClient();
    const ids = [...selectedArchivedIds];
    const rows = archivedRows.filter(r => ids.includes(r.id));
    const listingIds = rows.filter(r => r.listing_id).map(r => r.listing_id!);
    await Promise.all([
      ...(listingIds.length ? [supabase.from("listings").update({ status: "paused" }).in("id", listingIds)] : []),
      supabase.from("listings").update({ status: "paused" }).in("inventory_id", ids),
    ]);
    const { error } = await supabase.from("inventory").delete().in("id", ids);
    setBulkOperating(false);
    setConfirmBulkDelete(false);
    setSelectedArchivedIds(new Set());
    if (error) { toast.error(error.message); return; }
    toast.success(`${ids.length} item${ids.length !== 1 ? "s" : ""} permanently deleted`);
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

  function openManageListing(row: Row) {
    if (managingListingId === row.id) {
      setManagingListingId(null);
      return;
    }
    setManagingListingId(row.id);
    setInlinePrice(row.listing_price_cents ? String(row.listing_price_cents / 100) : "");
    const saleActive = !!(row.listing_sale_price_cents && row.listing_sale_ends_at && new Date(row.listing_sale_ends_at) > new Date());
    setInlineSalePrice(saleActive && row.listing_sale_price_cents ? String(row.listing_sale_price_cents / 100) : "");
    setInlineSaleEndsAt(saleActive && row.listing_sale_ends_at ? row.listing_sale_ends_at.slice(0, 16) : "");
    setInlineShowSale(false);
    setInlineDeleteConfirm(null);
  }

  async function saveInlinePrice(row: Row) {
    if (!row.listing_id) return;
    setInlineSavingPrice(true);
    const supabase = createClient();
    const { error } = await supabase.from("listings").update({ price_cents: dollarsToCents(inlinePrice) }).eq("id", row.listing_id);
    setInlineSavingPrice(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Price updated");
    router.refresh();
  }

  async function saveInlineSale(row: Row) {
    if (!row.listing_id) return;
    setInlineSavingSale(true);
    const res = await fetch("/api/listings/sale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId: row.listing_id, salePrice: inlineSalePrice, saleEndsAt: inlineSaleEndsAt }),
    });
    const data = await res.json();
    setInlineSavingSale(false);
    if (data.error) { toast.error(data.error); return; }
    toast.success("Sale scheduled!");
    setInlineShowSale(false);
    router.refresh();
  }

  async function clearInlineSale(row: Row) {
    if (!row.listing_id) return;
    setInlineSavingSale(true);
    const res = await fetch("/api/listings/sale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId: row.listing_id, clear: true }),
    });
    const data = await res.json();
    setInlineSavingSale(false);
    if (data.error) { toast.error(data.error); return; }
    toast.success("Sale ended");
    router.refresh();
  }

  async function deleteInlineListing(row: Row) {
    if (!row.listing_id) return;
    setInlineDeleting(true);
    const res = await fetch("/api/listings/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId: row.listing_id }),
    });
    const data = await res.json();
    setInlineDeleting(false);
    if (!res.ok) { toast.error(data.error ?? "Failed to remove listing"); return; }
    toast.success("Removed from shop");
    setManagingListingId(null);
    setInlineDeleteConfirm(null);
    router.refresh();
  }

  function renderInlineManagePanel(row: Row) {
    const saleActive = !!(row.listing_sale_price_cents && row.listing_sale_ends_at && new Date(row.listing_sale_ends_at) > new Date());
    return (
      <div className="bg-muted/20 border-t border-border/40 px-4 py-3 space-y-3">
        {/* Price + status row */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-muted-foreground w-10 shrink-0">Price</span>
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">$</span>
            <input
              type="number" min={0.01} step={0.01} value={inlinePrice}
              onChange={e => setInlinePrice(e.target.value)}
              className="w-24 h-7 px-2 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-leaf bg-background"
            />
          </div>
          <button
            onClick={() => saveInlinePrice(row)}
            disabled={inlineSavingPrice || !inlinePrice}
            className="h-7 px-2.5 text-xs bg-leaf hover:bg-forest text-white rounded disabled:opacity-50 transition-colors"
          >
            {inlineSavingPrice ? "Saving…" : "Save"}
          </button>
          <button
            onClick={() => toggleListingPause(row)}
            className={cn(
              "h-7 px-2.5 text-xs rounded border font-medium transition-colors",
              row.listing_status === "active"
                ? "border-yellow-400 text-yellow-700 hover:bg-yellow-50 dark:hover:bg-yellow-900/20"
                : "border-leaf text-leaf hover:bg-[#EBF0E6] dark:hover:bg-forest/20"
            )}
          >
            {row.listing_status === "active" ? "Pause" : "Resume"}
          </button>
          <button
            onClick={() => setInlineShowSale(v => !v)}
            className={cn(
              "h-7 px-2.5 text-xs rounded border font-medium transition-colors",
              saleActive
                ? "border-orange-400 text-orange-600 bg-orange-50 dark:bg-orange-900/20"
                : "border-input text-muted-foreground hover:text-foreground hover:border-foreground"
            )}
          >
            {saleActive ? "✦ Sale" : "Run a Special"}
          </button>
          <button
            onClick={() => setInlineDeleteConfirm(inlineDeleteConfirm === row.listing_id ? null : (row.listing_id ?? null))}
            className="h-7 px-2.5 text-xs rounded border border-destructive/40 text-destructive hover:bg-destructive/10 transition-colors ml-auto"
          >
            Remove
          </button>
        </div>

        {/* Sale section */}
        {inlineShowSale && (
          <div className="flex items-end gap-2 flex-wrap pt-2 border-t border-border/40">
            {saleActive && (
              <p className="text-xs text-orange-600 w-full">
                Active: <strong>{centsToDisplay(row.listing_sale_price_cents!)}</strong> — ends {new Date(row.listing_sale_ends_at!).toLocaleString()}
              </p>
            )}
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-muted-foreground">Sale $</label>
              <input
                type="number" min={0.01} step={0.01} value={inlineSalePrice}
                onChange={e => setInlineSalePrice(e.target.value)}
                placeholder="0.00"
                className="w-24 h-7 px-2 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-orange-500 bg-background"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-muted-foreground">Ends</label>
              <input
                type="datetime-local" value={inlineSaleEndsAt}
                min={new Date().toISOString().slice(0, 16)}
                onChange={e => setInlineSaleEndsAt(e.target.value)}
                className="h-7 px-2 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-orange-500 bg-background"
              />
            </div>
            <button
              onClick={() => saveInlineSale(row)}
              disabled={inlineSavingSale || !inlineSalePrice || !inlineSaleEndsAt}
              className="h-7 px-2.5 text-xs bg-orange-600 hover:bg-orange-700 text-white rounded disabled:opacity-50 transition-colors"
            >
              {inlineSavingSale ? "Saving…" : saleActive ? "Update" : "Start Sale"}
            </button>
            {saleActive && (
              <button
                onClick={() => clearInlineSale(row)}
                disabled={inlineSavingSale}
                className="h-7 px-2.5 text-xs border border-destructive/40 text-destructive hover:bg-destructive/10 rounded disabled:opacity-50 transition-colors"
              >
                End Sale
              </button>
            )}
          </div>
        )}

        {/* Delete confirm */}
        {inlineDeleteConfirm === row.listing_id && (
          <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-border/40">
            <span className="text-xs text-muted-foreground">Remove this listing from your shop?</span>
            <button
              onClick={() => deleteInlineListing(row)}
              disabled={inlineDeleting}
              className="h-7 px-2.5 text-xs bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded disabled:opacity-50 transition-colors"
            >
              {inlineDeleting ? "Removing…" : "Yes, Remove"}
            </button>
            <button
              onClick={() => setInlineDeleteConfirm(null)}
              className="h-7 px-2.5 text-xs border rounded text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    );
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
        <td className="py-2.5 pl-3 pr-1 text-sm font-medium max-w-[160px] truncate">{plantName}</td>
        <td className="px-2 py-2.5 text-sm text-muted-foreground max-w-[120px] truncate">{row.variety || "—"}</td>
        <td className="px-2 py-2.5 text-sm">
          {row.pot_size
            ? <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs">{row.pot_size}</span>
            : <span className="text-xs text-muted-foreground italic">—</span>}
        </td>
        <td className="px-2 py-2.5 text-sm tabular-nums">
          <span className="font-medium">{row.quantity}</span>
          {a !== row.quantity && <span className="text-xs text-muted-foreground ml-1">({a} avail)</span>}
          {(row.listing_quantity ?? 0) > 0 && <span className="text-xs text-leaf block">{row.listing_quantity} in shop</span>}
          {totalAuctionQty > 0 && <span className="text-xs text-blue-600 block">{totalAuctionQty} in auction</span>}
        </td>
        <td className="px-2 py-2.5 text-sm">
          <span className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
            row.status === "In Shop" || row.status === "Shop + Auction" ? "bg-[#DFE7D4] text-leaf dark:bg-forest/40 dark:text-sage" :
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
              <DropdownMenuItem onClick={() => archiveItem(row.id, row.listing_id)} disabled={loadingId === row.id} className="text-destructive focus:text-destructive">Archive</DropdownMenuItem>
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
          <DropdownMenuItem onClick={() => archiveItem(row.id, row.listing_id)} disabled={loadingId === row.id} className="text-destructive focus:text-destructive">
            Archive
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );

    return (
      <div key={row.id} className={cn("border-t border-border/40 px-4 py-3 space-y-2", row.listing_status === "sold_out" && "border-l-2 border-l-amber-400 bg-amber-50/50 dark:bg-amber-950/20")}>
        {/* Size / Variant + qty + actions */}
        <div className="flex items-center gap-2">
          {row.images[0] ? (
            <Image src={row.images[0]} alt="" width={36} height={36} className="w-9 h-9 rounded object-cover border shrink-0" />
          ) : (
            <div className="w-9 h-9 rounded border bg-muted flex items-center justify-center text-base shrink-0">🌿</div>
          )}
          {(() => {
            const label = isSupply(row) ? row.variety : row.pot_size;
            return label
              ? <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium">{label}</span>
              : <span className="text-xs text-muted-foreground italic">{isSupply(row) ? "No variant" : "No size"}</span>;
          })()}
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
              className="w-16 px-1.5 py-0.5 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-leaf"
            />
          ) : (
            <button
              onClick={() => { setEditingQtyId(row.id); setEditingQtyValue(String(row.quantity)); }}
              className={cn(
                "inline-flex items-center gap-1 text-sm font-medium tabular-nums hover:text-leaf group rounded px-0.5 transition-all",
                highlightStockId === row.id && "ring-2 ring-destructive ring-offset-1 text-destructive"
              )}
              title="Click to edit total stock"
            >
              {row.quantity} <Pencil size={11} className="opacity-0 group-hover:opacity-50 transition-opacity" />
            </button>
          )}
          <div className="ml-auto">{dropdownMenu}</div>
        </div>

        {/* Stock breakdown */}
        {(!!row.listing_id || totalAuctionQty > 0) && (
          <div className="flex gap-3 text-xs flex-wrap">
            {!!row.listing_id && (
              editingListingQtyId === row.id ? (
                <input
                  type="number" min={0} max={row.quantity} value={editingListingQtyValue}
                  onChange={e => setEditingListingQtyValue(e.target.value)}
                  onBlur={() => saveListingQtyEdit(row)}
                  onKeyDown={e => { if (e.key === "Enter") saveListingQtyEdit(row); if (e.key === "Escape") setEditingListingQtyId(null); }}
                  autoFocus
                  className="w-14 px-1.5 py-0.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-leaf bg-background"
                />
              ) : (
                <button
                  onClick={() => { setEditingListingQtyId(row.id); setEditingListingQtyValue(String(row.listing_quantity ?? 0)); }}
                  className={(row.listing_quantity ?? 0) === 0 ? "text-amber-600 tabular-nums hover:underline" : "text-leaf tabular-nums hover:underline"}
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
            <div className="flex items-center gap-2 flex-wrap">
              <Store size={12} className="text-leaf shrink-0" />
              <span className="text-sm font-medium">{centsToDisplay(row.listing_price_cents ?? 0)}</span>
              <span className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                row.listing_status === "active" ? "bg-[#DFE7D4] text-leaf dark:bg-forest/40 dark:text-sage" :
                row.listing_status === "paused" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400" :
                "bg-red-100 text-red-600"
              )}>{row.listing_status}</span>
              {row.listing_status === "sold_out" && !dismissedSoldOutIds.has(row.id) && (
                <button
                  onClick={() => dismissSoldOutItem(row.id)}
                  className="text-xs text-amber-600 dark:text-amber-400 hover:underline"
                  title="Hide the sold-out warning for this item"
                >
                  Dismiss alert
                </button>
              )}
              {row.listing_sale_price_cents && row.listing_sale_ends_at && new Date(row.listing_sale_ends_at) > new Date() && (
                <span className="text-xs text-orange-600 font-medium">✦ Sale</span>
              )}
              {row.free_shipping ? (
                <span className="text-xs text-muted-foreground">Free shipping</span>
              ) : row.shipping_cost_cents ? (
                <span className="text-xs text-muted-foreground">{centsToDisplay(row.shipping_cost_cents)} shipping</span>
              ) : row.shipping_weight_oz ? (
                <span className="text-xs text-muted-foreground">Calculated shipping</span>
              ) : null}
              {row.listing_status !== "sold_out" && (
                <button
                  onClick={() => openManageListing(row)}
                  className={cn("text-xs hover:underline", managingListingId === row.id ? "text-foreground font-medium" : "text-blue-600")}
                >
                  {managingListingId === row.id ? "Hide ↑" : "Manage ↓"}
                </button>
              )}
            </div>
            {row.listing_status === "sold_out" && (
              relistingId === row.id ? (
                <div className="flex items-center gap-1.5 flex-wrap mt-1">
                  <div className="flex items-center gap-1">
                    <label className="text-xs text-muted-foreground">Stock</label>
                    <input type="number" min={0} value={relistStock} onChange={e => setRelistStock(e.target.value)} autoFocus
                      className="w-14 px-1.5 py-0.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-amber-500 bg-background" />
                  </div>
                  <div className="flex items-center gap-1">
                    <label className="text-xs text-muted-foreground">In shop</label>
                    <input type="number" min={0} value={relistShopQty} onChange={e => setRelistShopQty(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") saveRelist(row); if (e.key === "Escape") setRelistingId(null); }}
                      className="w-14 px-1.5 py-0.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-amber-500 bg-background" />
                  </div>
                  <button onClick={() => saveRelist(row)} className="text-xs bg-leaf hover:bg-forest text-white px-2 py-0.5 rounded transition-colors">Relist</button>
                  <button onClick={() => setRelistingId(null)} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
                </div>
              ) : (
                <button
                  onClick={() => { setRelistingId(row.id); setRelistStock(String(row.quantity)); setRelistShopQty(String(row.listing_quantity ?? 0)); }}
                  className="text-xs text-amber-700 dark:text-amber-400 hover:underline font-medium text-left"
                >
                  + Add stock to relist
                </button>
              )
            )}
          </div>
        ) : a > 0 ? (
          <button onClick={() => openModal({ type: "listing", row })} className="inline-flex items-center gap-1.5 text-sm text-leaf hover:underline font-medium">
            <Store size={13} /> List in Shop
          </button>
        ) : null}

        {managingListingId === row.id && renderInlineManagePanel(row)}

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
      <>
      <tr key={row.id} className={cn("border-t border-border/40 hover:bg-muted/20 transition-colors", row.listing_status === "sold_out" && "bg-amber-50/50 dark:bg-amber-950/20")}>
        {/* Size / Variant */}
        <td className={cn("py-3 pl-3 pr-3 w-44", row.listing_status === "sold_out" && "border-l-2 border-l-amber-400")}>
          <div className="flex items-center gap-2">
            {row.images[0] ? (
              <Image src={row.images[0]} alt="" width={36} height={36} className="w-9 h-9 rounded object-cover border shrink-0" />
            ) : (
              <div className="w-9 h-9 rounded border bg-muted flex items-center justify-center text-base shrink-0">🌿</div>
            )}
            <div className="flex items-center gap-1.5">
            {(() => {
              const label = isSupply(row) ? row.variety : row.pot_size;
              return label
                ? <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium">{label}</span>
                : <span className="text-xs text-muted-foreground italic">{isSupply(row) ? "No variant" : "No size"}</span>;
            })()}
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
              className="w-16 px-1.5 py-0.5 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-leaf"
            />
          ) : (
            <button
              onClick={() => { setEditingQtyId(row.id); setEditingQtyValue(String(row.quantity)); }}
              className={cn(
                "inline-flex items-center gap-1 font-medium tabular-nums hover:text-leaf group rounded px-0.5 transition-all",
                highlightStockId === row.id && "ring-2 ring-destructive ring-offset-1 text-destructive"
              )}
              title="Click to edit total stock"
            >
              {row.quantity}
              <Pencil size={11} className="opacity-0 group-hover:opacity-50 transition-opacity" />
            </button>
          )}
          {(!!row.listing_id || totalAuctionQty > 0) && (
            <div className="text-xs mt-0.5 space-y-0.5">
              {!!row.listing_id && (
                editingListingQtyId === row.id ? (
                  <input
                    type="number" min={0} max={row.quantity} value={editingListingQtyValue}
                    onChange={e => setEditingListingQtyValue(e.target.value)}
                    onBlur={() => saveListingQtyEdit(row)}
                    onKeyDown={e => { if (e.key === "Enter") saveListingQtyEdit(row); if (e.key === "Escape") setEditingListingQtyId(null); }}
                    autoFocus
                    className="w-16 px-1.5 py-0.5 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-leaf bg-background"
                  />
                ) : (
                  <button
                    onClick={() => { setEditingListingQtyId(row.id); setEditingListingQtyValue(String(row.listing_quantity ?? 0)); }}
                    className={(row.listing_quantity ?? 0) === 0 ? "text-amber-600 tabular-nums hover:underline" : "text-leaf tabular-nums hover:underline"}
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
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">{centsToDisplay(row.listing_price_cents ?? 0)}</span>
                <span className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                  row.listing_status === "active" ? "bg-[#DFE7D4] text-leaf dark:bg-forest/40 dark:text-sage" :
                  row.listing_status === "paused" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400" :
                  "bg-red-100 text-red-600"
                )}>
                  {row.listing_status}
                </span>
                {row.listing_status === "sold_out" && !dismissedSoldOutIds.has(row.id) && (
                  <button
                    onClick={() => dismissSoldOutItem(row.id)}
                    className="text-xs text-amber-600 dark:text-amber-400 hover:underline"
                    title="Hide the sold-out warning for this item"
                  >
                    Dismiss alert
                  </button>
                )}
                {row.listing_sale_price_cents && row.listing_sale_ends_at && new Date(row.listing_sale_ends_at) > new Date() && (
                  <span className="text-xs text-orange-600 font-medium">✦ Sale</span>
                )}
              </div>
              {row.listing_status === "sold_out" && (
                relistingId === row.id ? (
                  <div className="flex items-center gap-1.5 flex-wrap mt-1">
                    <div className="flex items-center gap-1">
                      <label className="text-xs text-muted-foreground">Stock</label>
                      <input type="number" min={0} value={relistStock} onChange={e => setRelistStock(e.target.value)} autoFocus
                        className="w-14 px-1.5 py-0.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-amber-500 bg-background" />
                    </div>
                    <div className="flex items-center gap-1">
                      <label className="text-xs text-muted-foreground">In shop</label>
                      <input type="number" min={0} value={relistShopQty} onChange={e => setRelistShopQty(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") saveRelist(row); if (e.key === "Escape") setRelistingId(null); }}
                        className="w-14 px-1.5 py-0.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-amber-500 bg-background" />
                    </div>
                    <button onClick={() => saveRelist(row)} className="text-xs bg-leaf hover:bg-forest text-white px-2 py-0.5 rounded transition-colors">Relist</button>
                    <button onClick={() => setRelistingId(null)} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setRelistingId(row.id); setRelistStock(String(row.quantity)); setRelistShopQty(String(row.listing_quantity ?? 0)); }}
                    className="text-xs text-amber-700 dark:text-amber-400 hover:underline font-medium text-left"
                  >
                    + Add stock to relist
                  </button>
                )
              )}
              {row.free_shipping ? (
                <span className="text-xs text-muted-foreground">Free shipping</span>
              ) : row.shipping_cost_cents ? (
                <span className="text-xs text-muted-foreground">{centsToDisplay(row.shipping_cost_cents)} shipping</span>
              ) : row.shipping_weight_oz ? (
                <span className="text-xs text-muted-foreground">Calculated shipping</span>
              ) : null}
              {row.listing_status !== "sold_out" && (
                <button
                  onClick={() => openManageListing(row)}
                  className={cn("text-xs hover:underline", managingListingId === row.id ? "text-foreground font-medium" : "text-blue-600")}
                >
                  {managingListingId === row.id ? "Hide ↑" : "Manage listing ↓"}
                </button>
              )}
            </div>
          ) : a > 0 ? (
            <button
              onClick={() => openModal({ type: "listing", row })}
              className="inline-flex items-center gap-1.5 text-sm text-leaf hover:underline font-medium"
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
              {!hasListing && a > 0 && (
                <DropdownMenuItem onClick={() => openModal({ type: "listing", row })}>
                  <Store size={13} className="mr-1.5" /> List in Shop
                </DropdownMenuItem>
              )}
              {a > 0 && (
                <DropdownMenuItem onClick={() => openModal({ type: "auction", row })}>
                  <Gavel size={13} className="mr-1.5" /> {activeAuctions.length > 0 ? "Add Auction" : "Auction"}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => archiveItem(row.id, row.listing_id)}
                disabled={loadingId === row.id}
                className="text-destructive focus:text-destructive"
              >
                Archive
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </td>
      </tr>
      {managingListingId === row.id && (
        <tr key={`${row.id}-manage`}>
          <td colSpan={5} className="p-0">
            {renderInlineManagePanel(row)}
          </td>
        </tr>
      )}
      </>
    );
  }

  // ── Plant group accordion ─────────────────────────────────────────────────
  function renderGroup(group: PlantGroup) {
    const isOpen = openGroups.has(group.key);
    const totalQty = group.variants.reduce((sum, v) => sum + v.quantity, 0);
    const totalAvail = group.variants.reduce((sum, v) => sum + avail(v), 0);
    const hasShop = group.variants.some(v => v.listing_id && v.listing_status === "active");
    const hasSoldOut = group.variants.some(v => v.listing_status === "sold_out");
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
              <span className="hidden sm:inline-flex items-center gap-1 text-xs text-leaf bg-[#DFE7D4] dark:bg-forest/40 dark:text-sage rounded-full px-2 py-0.5">
                <Store size={10} /> Shop
              </span>
            )}
            {hasSoldOut && (
              <span className="hidden sm:inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-100 dark:bg-amber-900/40 dark:text-amber-400 rounded-full px-2 py-0.5">
                Sold out
              </span>
            )}
            {hasLiveAuction && (
              <span className="hidden sm:inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-100 dark:bg-blue-900/40 dark:text-blue-400 rounded-full px-2 py-0.5">
                <Gavel size={10} /> Live
              </span>
            )}
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {group.variants.length} {first && isSupply(first) ? "variant" : "size"}{group.variants.length !== 1 ? "s" : ""} · {totalQty} total
              {totalAvail !== totalQty && <span className="ml-1 text-xs">({totalAvail} avail)</span>}
            </span>
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                openModal({ type: "add-variant", plant_name: group.plant_name, variety: group.variety, category: first?.category ?? null });
              }}
              className="inline-flex items-center gap-1 text-xs text-leaf hover:text-forest border border-[#C5D4BC] hover:border-sage rounded-full px-2.5 py-0.5 transition-colors bg-background"
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
                    <th className="py-2 pl-3 pr-3 text-left text-xs font-medium text-muted-foreground w-44">{first && isSupply(first) ? "Variant" : "Size"}</th>
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
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#DFE7D4] text-leaf font-bold flex items-center justify-center text-sm">1</span>
              <div>
                <p className="font-medium text-sm">Add your plants to inventory</p>
                <p className="text-xs text-muted-foreground">Click <strong>+ Add</strong> to create an inventory item. Enter the plant name, variety, and how many you have in stock.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#DFE7D4] text-leaf font-bold flex items-center justify-center text-sm">2</span>
              <div>
                <p className="font-medium text-sm">List it in your shop or start an auction</p>
                <p className="text-xs text-muted-foreground">Each inventory row has a <strong>List in Shop</strong> and <strong>Create Auction</strong> button. Allocate some stock to each — you stay in control of how many go where.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#DFE7D4] text-leaf font-bold flex items-center justify-center text-sm">3</span>
              <div>
                <p className="font-medium text-sm">Stock updates automatically when you sell</p>
                <p className="text-xs text-muted-foreground">When a buyer purchases, your inventory count decrements automatically. You can also log off-platform sales manually.</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground pt-1">Need help later? Click the <strong>?</strong> next to the Inventory heading anytime.</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button className="bg-leaf hover:bg-forest" onClick={() => setWelcomeOpen(false)}>
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

      {!hasShippingTimeline && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          <strong>Set your shipping timeline before listing.</strong>{" "}
          Buyers want to know how quickly you ship.{" "}
          <a href="/account#shipping-days" className="underline font-medium hover:opacity-80">Set it now →</a>
        </div>
      )}

      {!hasReturnPolicy && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          <strong>Set your return policy before listing.</strong>{" "}
          Buyers expect to know your policy upfront.{" "}
          <a href="/account#return-policy" className="underline font-medium hover:opacity-80">Set it now →</a>
        </div>
      )}

      {!calculatedShippingEnabled && activeRows.some(i => (i.shipping_weight_oz ?? 0) > 0) && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          <strong>Shipping setup incomplete.</strong>{" "}
          You have items using weight-based shipping but your ship-from address isn&apos;t verified or calculated shipping isn&apos;t enabled.{" "}
          <a href="/account#shipping-settings" className="underline font-medium hover:opacity-80">Fix it now →</a>
        </div>
      )}

      {undismissedSoldOut.length > 0 && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-300 flex items-start gap-3">
          <div className="flex-1">
            <strong>{undismissedSoldOut.length} item{undismissedSoldOut.length !== 1 ? "s" : ""} sold out</strong>
            {" "}— still visible on your storefront, but hidden from the public shop. Click <strong>+ Add stock to relist</strong> on a highlighted row to bring it back live automatically.
          </div>
          <button
            onClick={dismissSoldOutBanner}
            className="shrink-0 text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 transition-colors mt-0.5"
            title="Dismiss"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">My Stock</h1>
            <button
              onClick={() => setShowHelp(true)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="How inventory works"
            >
              <HelpCircle size={18} />
            </button>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {activeRows.length} item{activeRows.length !== 1 ? "s" : ""} · {plantGroups.length} plant{plantGroups.length !== 1 ? "s" : ""}{hasSupplies ? ` · ${supplyGroups.length} supply item${supplyGroups.length !== 1 ? "s" : ""}` : ""}
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
          <Link href="/dashboard/inventory/import" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "flex items-center gap-1.5")}>
            <Upload size={13} /> Import
          </Link>
          <button onClick={exportExcel} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>Export</button>
          <Link href="/dashboard/create" className={cn(buttonVariants({ size: "sm" }), "bg-leaf hover:bg-forest")}>+ Add</Link>
        </div>
      </div>

      {hasSupplies && (
        <div className="flex border-b mb-5">
          {(["plants", "supplies"] as const).map(tab => {
            const count = tab === "plants" ? plantGroups.length : supplyGroups.length;
            const label = tab === "plants" ? "Plants" : "Garden Supplies";
            return (
              <button
                key={tab}
                onClick={() => setStockTab(tab)}
                className={cn(
                  "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                  stockTab === tab
                    ? "border-leaf text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {label} <span className={cn("ml-1 text-xs rounded-full px-1.5 py-0.5", stockTab === tab ? "bg-leaf/20 text-forest dark:text-[#A8BF9A]" : "bg-muted text-muted-foreground")}>{count}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-5">
        <Input
          placeholder="Search by plant name or variety…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select value={categoryFilter || "_all"} onValueChange={v => setCategoryFilter(v === "_all" ? "" : (v ?? ""))}>
          <SelectTrigger className="w-40">
            <SelectValue>{categoryFilter || "All categories"}</SelectValue>
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
        {viewMode === "grouped" && visibleGroups.length > 0 && (
          <div className="flex items-center gap-1 ml-auto">
            <button
              onClick={() => setOpenGroups(new Set(visibleGroups.map(g => g.key)))}
              className="text-xs text-muted-foreground hover:text-foreground underline self-center"
            >
              Expand all
            </button>
            <span className="text-muted-foreground text-xs">·</span>
            <button
              onClick={() => setOpenGroups(new Set())}
              className="text-xs text-muted-foreground hover:text-foreground underline self-center"
            >
              Collapse all
            </button>
          </div>
        )}
      </div>

      {visibleGroups.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-4xl mb-4">📦</p>
          <p className="font-medium text-lg">
            {(search.trim() || categoryFilter)
              ? `No results${search.trim() ? ` for "${search}"` : ""}${categoryFilter ? ` in ${categoryFilter}` : ""}`
              : hasSupplies && stockTab === "supplies"
                ? "No garden supplies yet"
                : "No inventory yet"}
          </p>
          {!search.trim() && (
            <Link href="/dashboard/create" className={cn(buttonVariants(), "mt-6 bg-leaf hover:bg-forest")}>+ Add to Inventory</Link>
          )}
        </div>
      ) : viewMode === "flat" ? (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30">
                <th className="py-2.5 pl-3 pr-1 text-left text-xs font-medium text-muted-foreground">{hasSupplies && stockTab === "supplies" ? "Item" : "Plant"}</th>
                <th className="px-2 py-2.5 text-left text-xs font-medium text-muted-foreground">Variety</th>
                <th className="px-2 py-2.5 text-left text-xs font-medium text-muted-foreground">{hasSupplies && stockTab === "supplies" ? "Variant" : "Size"}</th>
                <th className="px-2 py-2.5 text-left text-xs font-medium text-muted-foreground">Stock</th>
                <th className="px-2 py-2.5 text-left text-xs font-medium text-muted-foreground">Status</th>
                <th className="px-2 py-2.5 w-16" />
              </tr>
            </thead>
            <tbody>
              {visibleGroups.flatMap(g =>
                g.variants.map(row => renderFlatRow(row, g.plant_name))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div>{visibleGroups.map(renderGroup)}</div>
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
                        <Store size={13} className="text-leaf shrink-0" />
                        <span className="font-medium">Shop Listing</span>
                        {l.pot_size && <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs">{l.pot_size}</span>}
                        <span>{l.quantity} in stock</span>
                        <span className="font-medium">{centsToDisplay(l.price_cents)}</span>
                        <span className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                          l.status === "active" ? "bg-[#DFE7D4] text-leaf" :
                          l.status === "paused" ? "bg-yellow-100 text-yellow-700" :
                          "bg-red-100 text-red-600"
                        )}>{l.status}</span>
                        <div className="ml-auto flex items-center gap-3">
                          <button
                            onClick={() => toggleUnlinkedListingPause(l.id, l.status)}
                            className="text-xs text-muted-foreground hover:text-foreground font-medium"
                          >
                            {l.status === "active" ? "Pause" : "Resume"}
                          </button>
                          <button
                            onClick={() => deleteUnlinkedListing(l.id)}
                            className="text-xs text-destructive hover:text-destructive/80 font-medium"
                          >
                            Delete
                          </button>
                          <button
                            onClick={() => importListing(l)}
                            disabled={importingId === l.id}
                            className="text-xs text-leaf hover:underline font-medium disabled:opacity-50"
                          >
                            {importingId === l.id ? "Importing…" : "Import"}
                          </button>
                        </div>
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
                        <div className="ml-auto flex items-center gap-3">
                          {confirmDeleteAuctionId === a.id ? (
                            <>
                              <span className="text-xs text-destructive font-medium">Remove this auction?</span>
                              <button
                                onClick={() => { setConfirmDeleteAuctionId(null); deleteUnlinkedAuction(a.id); }}
                                className="text-xs bg-destructive hover:bg-destructive/90 text-destructive-foreground px-2.5 py-1 rounded transition-colors"
                              >
                                Yes, Remove
                              </button>
                              <button
                                onClick={() => setConfirmDeleteAuctionId(null)}
                                className="text-xs border rounded px-2.5 py-1 text-muted-foreground hover:text-foreground transition-colors"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => setConfirmDeleteAuctionId(a.id)}
                                className="text-xs text-destructive hover:text-destructive/80 font-medium"
                              >
                                Delete
                              </button>
                              <button
                                onClick={() => importAuction(a)}
                                disabled={importingId === a.id}
                                className="text-xs text-leaf hover:underline font-medium disabled:opacity-50"
                              >
                                {importingId === a.id ? "Importing…" : "Import to Inventory"}
                              </button>
                            </>
                          )}
                        </div>
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
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => setShowArchived(v => !v)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {showArchived ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              Archived ({archivedRows.length})
              <span className="text-xs bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 rounded-full px-2 py-0.5">Deleted in 30 days</span>
            </button>
            {showArchived && (
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer ml-auto select-none">
                <input
                  type="checkbox"
                  checked={selectedArchivedIds.size === archivedRows.length && archivedRows.length > 0}
                  onChange={e => {
                    if (e.target.checked) setSelectedArchivedIds(new Set(archivedRows.map(r => r.id)));
                    else setSelectedArchivedIds(new Set());
                  }}
                  className="rounded"
                />
                Select all
              </label>
            )}
          </div>

          {/* Bulk action bar */}
          {showArchived && selectedArchivedIds.size > 0 && (
            <div className="mb-3 flex items-center gap-3 flex-wrap rounded-lg border bg-muted/30 px-4 py-2.5 text-sm">
              <span className="font-medium">{selectedArchivedIds.size} selected</span>
              {confirmBulkDelete ? (
                <>
                  <span className="text-destructive font-medium">Permanently delete {selectedArchivedIds.size} item{selectedArchivedIds.size !== 1 ? "s" : ""}? This cannot be undone.</span>
                  <button
                    onClick={bulkDeleteArchived}
                    disabled={bulkOperating}
                    className="text-xs bg-destructive hover:bg-destructive/90 text-destructive-foreground px-2.5 py-1 rounded disabled:opacity-50 transition-colors"
                  >
                    {bulkOperating ? "Deleting…" : "Yes, Delete"}
                  </button>
                  <button
                    onClick={() => setConfirmBulkDelete(false)}
                    className="text-xs border rounded px-2.5 py-1 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={bulkRestoreArchived}
                    disabled={bulkOperating}
                    className="text-xs text-leaf hover:underline disabled:opacity-50"
                  >
                    {bulkOperating ? "Restoring…" : "Restore"}
                  </button>
                  <button
                    onClick={() => setConfirmBulkDelete(true)}
                    className="text-xs text-destructive hover:underline"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setSelectedArchivedIds(new Set())}
                    className="ml-auto text-xs text-muted-foreground hover:text-foreground"
                  >
                    Clear
                  </button>
                </>
              )}
            </div>
          )}

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
                      <div key={row.id} className="flex items-center gap-3 px-4 py-2.5 text-sm flex-wrap">
                        <input
                          type="checkbox"
                          checked={selectedArchivedIds.has(row.id)}
                          onChange={() => toggleArchivedSelection(row.id)}
                          className="rounded shrink-0"
                        />
                        <span className="text-muted-foreground">{row.pot_size ?? (isSupply(row) ? "No variant" : "No size")}</span>
                        <span>{row.quantity} in stock</span>
                        {row.archived_at && (
                          <span className="text-xs text-orange-600">{daysUntilPurge(row.archived_at)}d left</span>
                        )}
                        {confirmDeleteId === row.id ? (
                          <div className="ml-auto flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-destructive font-medium">Permanently delete? This cannot be undone.</span>
                            <button
                              onClick={() => deleteArchivedItem(row)}
                              disabled={deletingItemId === row.id}
                              className="text-xs bg-destructive hover:bg-destructive/90 text-destructive-foreground px-2.5 py-1 rounded disabled:opacity-50 transition-colors"
                            >
                              {deletingItemId === row.id ? "Deleting…" : "Yes, Delete"}
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="text-xs border rounded px-2.5 py-1 text-muted-foreground hover:text-foreground transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="ml-auto flex items-center gap-3">
                            <button
                              onClick={() => restoreItem(row.id, row.listing_id)}
                              disabled={loadingId === row.id}
                              className="text-xs text-leaf hover:underline disabled:opacity-50"
                            >
                              {loadingId === row.id ? "Restoring…" : "Restore"}
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(row.id)}
                              className="text-xs text-destructive hover:underline"
                            >
                              Delete
                            </button>
                          </div>
                        )}
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
            const modalStock = parseInt(listModalStockQty, 10);
            const effectiveStock = !isNaN(modalStock) && modalStock >= 0 ? modalStock : modal.row.quantity;
            const otherAllocs = modal.row.auctions.filter(a => a.status === "active").reduce((s, a) => s + a.quantity, 0);
            const listNum = parseInt(listQty, 10);
            const overStock = !isNaN(listNum) && listNum > effectiveStock;
            return (
              <div className="space-y-4 mt-1">
                <div className="space-y-1">
                  <Label htmlFor="modal-price">Price per item *</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">$</span>
                    <Input id="modal-price" type="text" inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} placeholder="0.00" autoFocus className="max-w-[140px]" />
                  </div>
                  <PriceSuggestion plantName={modal.row.plant_name} variety={modal.row.variety} label="price" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="modal-stock" className={overStock ? "text-destructive" : ""}>
                      Total in stock
                    </Label>
                    <Input
                      id="modal-stock"
                      type="number"
                      min={0}
                      value={listModalStockQty}
                      onChange={e => setListModalStockQty(e.target.value)}
                      className={overStock ? "border-destructive ring-1 ring-destructive" : ""}
                    />
                    <p className="text-xs text-muted-foreground">You currently have {modal.row.quantity}</p>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="modal-qty">Quantity to list *</Label>
                    <Input
                      id="modal-qty"
                      type="number"
                      min={1}
                      max={effectiveStock}
                      value={listQty}
                      onChange={e => setListQty(e.target.value)}
                      className={overStock ? "border-destructive" : ""}
                    />
                    <p className="text-xs text-muted-foreground">
                      {Math.max(0, effectiveStock - otherAllocs)} available
                    </p>
                  </div>
                </div>
                {overStock && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertTriangle size={12} />
                    Listing qty exceeds stock — increase stock or reduce listing qty
                  </p>
                )}
                <div className="space-y-2">
                  <Label>Shipping <span className="text-destructive">*</span></Label>
                  <div className={`grid gap-2 grid-cols-3`}>
                    {shippingModes.map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setListingShippingMode(mode)}
                        className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                          listingShippingMode === mode
                            ? "border-leaf bg-[#EBF0E6] text-forest dark:bg-forest/40 dark:text-[#A8BF9A] dark:border-leaf"
                            : "border-input hover:bg-muted"
                        }`}
                      >
                        {mode === "free" ? "Free" : mode === "flat" ? "Flat rate" : "By weight"}
                      </button>
                    ))}
                  </div>
                  {listingShippingMode === "flat" && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">$</span>
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder="e.g. 6.99"
                        value={listingShippingCost}
                        onChange={e => setListingShippingCost(e.target.value)}
                        className="max-w-[120px]"
                      />
                      <span className="text-xs text-muted-foreground">flat rate</span>
                    </div>
                  )}
                  {listingShippingMode === "weight" && (
                    calculatedShippingEnabled ? (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={0.1}
                          step={0.1}
                          placeholder="oz"
                          value={listingShippingWeightOz}
                          onChange={e => setListingShippingWeightOz(e.target.value)}
                          className="max-w-[90px]"
                        />
                        <span className="text-xs text-muted-foreground">oz — rate calculated at checkout</span>
                      </div>
                    ) : (
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        To use weight-based rates, complete your ship-from address and enable calculated shipping in{" "}
                        <a href="/account#shipping-settings" className="underline hover:text-foreground font-medium">Shipping Settings →</a>
                      </p>
                    )
                  )}
                </div>
                {!listingShippingMode && (
                  <p className="text-xs text-amber-700 dark:text-amber-400">Choose a shipping option above to continue.</p>
                )}
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" onClick={() => setModal(null)} className="flex-1">Cancel</Button>
                  <Button
                    onClick={submitListing}
                    disabled={
                      submitting || !price || !listQty || !listingShippingMode || overStock ||
                      (listingShippingMode === "weight" && !listingShippingWeightOz) ||
                      (listingShippingMode === "flat" && !listingShippingCost)
                    }
                    className="flex-1 bg-leaf hover:bg-forest"
                  >
                    {submitting ? "Publishing…" : "Go Live"}
                  </Button>
                </div>
              </div>
            );
          })()}
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
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="modal-auc-qty">Quantity *</Label>
                    <Input id="modal-auc-qty" type="number" min={1} max={a} value={auctionQty} onChange={e => setAuctionQty(e.target.value)} />
                    <p className="text-xs text-muted-foreground">{a} available</p>
                  </div>
                </div>
                <PriceSuggestion plantName={modal.row.plant_name} variety={modal.row.variety} label="bid" />
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
                <div className="space-y-2">
                  <Label>Shipping <span className="text-destructive">*</span></Label>
                  <div className={`grid gap-2 grid-cols-3`}>
                    {shippingModes.map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setAuctionShippingMode(mode)}
                        className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                          auctionShippingMode === mode
                            ? "border-leaf bg-[#EBF0E6] text-forest dark:bg-forest/40 dark:text-[#A8BF9A] dark:border-leaf"
                            : "border-input hover:bg-muted"
                        }`}
                      >
                        {mode === "free" ? "Free" : mode === "flat" ? "Flat rate" : "By weight"}
                      </button>
                    ))}
                  </div>
                  {auctionShippingMode === "flat" && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">$</span>
                      <Input
                        type="number"
                        min={0.01}
                        step={0.01}
                        placeholder="e.g. 6.99"
                        value={auctionShippingCost}
                        onChange={e => setAuctionShippingCost(e.target.value)}
                        className="max-w-[120px]"
                      />
                      <span className="text-xs text-muted-foreground">flat rate</span>
                    </div>
                  )}
                  {auctionShippingMode === "weight" && (
                    calculatedShippingEnabled ? (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={0.1}
                          step={0.1}
                          placeholder="oz"
                          value={auctionShippingWeightOz}
                          onChange={e => setAuctionShippingWeightOz(e.target.value)}
                          className="max-w-[90px]"
                        />
                        <span className="text-xs text-muted-foreground">oz — rate calculated at checkout</span>
                      </div>
                    ) : (
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        To use weight-based rates, complete your ship-from address and enable calculated shipping in{" "}
                        <a href="/account#shipping-settings" className="underline hover:text-foreground font-medium">Shipping Settings →</a>
                      </p>
                    )
                  )}
                </div>
                {!auctionShippingMode && (
                  <p className="text-xs text-amber-700 dark:text-amber-400">Choose a shipping option above to continue.</p>
                )}
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
                  <Button
                    onClick={submitAuction}
                    disabled={
                      submitting || !startingBid || !endsAt || !auctionQty || !auctionAck ||
                      !auctionShippingMode ||
                      (auctionShippingMode === "weight" && !auctionShippingWeightOz) ||
                      (auctionShippingMode === "flat" && !auctionShippingCost)
                    }
                    className="flex-1 bg-leaf hover:bg-forest"
                  >
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
                <Button onClick={submitAddVariant} disabled={submitting || !variantQty} className="flex-1 bg-leaf hover:bg-forest">
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
          {modal?.type === "edit" && (() => {
            const supply = isSupply(modal.row);
            const editCategories = supply ? SUPPLY_CATEGORIES : categories;
            return (
            <div className="space-y-4 mt-1">
              <div className={supply ? "space-y-1" : "grid grid-cols-2 gap-3"}>
                <div className="space-y-1">
                  <Label htmlFor="edit-name">{supply ? "Item name" : "Plant name"} *</Label>
                  <Input id="edit-name" value={editPlantName} onChange={e => setEditPlantName(e.target.value)} autoFocus />
                </div>
                {!supply && (
                  <div className="space-y-1">
                    <Label htmlFor="edit-variety">Variety</Label>
                    <Input id="edit-variety" value={editVariety} onChange={e => setEditVariety(e.target.value)} placeholder="Optional" />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {supply ? (
                  <div className="space-y-1">
                    <Label htmlFor="edit-variant">Variant <span className="font-normal text-muted-foreground">(optional)</span></Label>
                    <Input id="edit-variant" value={editVariety} onChange={e => setEditVariety(e.target.value)} placeholder='e.g. "1 lb bag"' />
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Label>Pot Size</Label>
                    <PotSizePicker value={editPotSize} onChange={setEditPotSize} />
                  </div>
                )}
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
                    {editCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-desc">Description</Label>
                <Textarea id="edit-desc" value={editDescription} onChange={e => setEditDescription(e.target.value)} rows={3} placeholder={supply ? "Describe the product…" : "Describe the plant…"} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-notes">Private notes</Label>
                <Textarea id="edit-notes" value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={2} placeholder="Not visible to buyers…" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Photos {planLimits.photos !== null && <span className="font-normal text-muted-foreground text-xs">({editImages.length}/{planLimits.photos})</span>}</Label>
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
                {(planLimits.photos === null || editImages.length < planLimits.photos) && (
                  <Button type="button" variant="outline" size="sm" onClick={() => imageInputRef.current?.click()} disabled={imageUploading} className="flex items-center gap-1.5 text-xs">
                    <ImagePlus size={14} />{imageUploading ? "Uploading…" : "Add Photo"}
                  </Button>
                )}
              </div>
              {/* Advanced options — collapsible */}
              <div className="border-t pt-3">
                <button
                  type="button"
                  onClick={() => setShowEditAdvanced(v => !v)}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
                >
                  {showEditAdvanced ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span className="font-medium">Advanced options</span>
                  {!showEditAdvanced && (
                    <span className="text-xs ml-1 opacity-70">
                      {[
                        editShippingMode && (editShippingMode === "free" ? "Free shipping" : editShippingMode === "flat" ? `$${editShippingCost} shipping` : "Weight-based shipping"),
                        editCostPrice && `$${editCostPrice} cost`,
                        editLowStockThreshold && `Alert ≤${editLowStockThreshold}`,
                      ].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </button>

                {showEditAdvanced && (
                  <div className="space-y-4 mt-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="edit-cost">Cost per unit ($) <span className="font-normal text-muted-foreground text-xs">(optional)</span></Label>
                        <Input id="edit-cost" type="number" min={0} step={0.01} value={editCostPrice} onChange={e => setEditCostPrice(e.target.value)} placeholder="0.00" />
                        <p className="text-xs text-muted-foreground">Private — used to calculate margin</p>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="edit-threshold">Low stock alert <span className="font-normal text-muted-foreground text-xs">(optional)</span></Label>
                        <Input id="edit-threshold" type="number" min={0} value={editLowStockThreshold} onChange={e => setEditLowStockThreshold(e.target.value)} placeholder="e.g. 3" />
                        <p className="text-xs text-muted-foreground">Warn when available ≤ this</p>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label>Shipping <span className="font-normal text-muted-foreground text-xs">(optional — required to list)</span></Label>
                      <div className={`grid gap-2 grid-cols-3`}>
                        {shippingModes.map((mode) => (
                          <button key={mode} type="button" onClick={() => setEditShippingMode(editShippingMode === mode ? "" : mode)}
                            className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${editShippingMode === mode ? "border-leaf bg-[#EBF0E6] text-forest dark:bg-forest/40 dark:text-[#A8BF9A] dark:border-leaf" : "border-input hover:bg-muted"}`}
                          >
                            {mode === "free" ? "Free" : mode === "flat" ? "Flat rate" : "By weight"}
                          </button>
                        ))}
                      </div>
                      {editShippingMode === "flat" && (
                        <div className="flex items-center gap-2 pt-1">
                          <span className="text-sm text-muted-foreground">$</span>
                          <Input type="number" min={0.01} step={0.01} placeholder="e.g. 6.99" value={editShippingCost} onChange={e => setEditShippingCost(e.target.value)} className="max-w-[120px]" />
                          <span className="text-xs text-muted-foreground">charged to buyer</span>
                        </div>
                      )}
                      {editShippingMode === "weight" && (
                        calculatedShippingEnabled ? (
                          <div className="flex items-center gap-2 pt-1">
                            <Input type="number" min={0.1} step={0.1} placeholder="e.g. 16" value={editWeightOz} onChange={e => setEditWeightOz(e.target.value)} className="max-w-[100px]" />
                            <span className="text-xs text-muted-foreground">oz — rate calculated at checkout</span>
                          </div>
                        ) : (
                          <p className="text-xs text-amber-700 dark:text-amber-400 pt-1">
                            To use weight-based rates, complete your ship-from address and enable calculated shipping in{" "}
                            <a href="/account#shipping-settings" className="underline hover:text-foreground font-medium">Shipping Settings →</a>
                          </p>
                        )
                      )}
                    </div>
                    {/* Templates */}
                    {templates.length > 0 && (
                      <div className="space-y-1">
                        <Label>Load template</Label>
                        <div className="flex flex-wrap gap-1.5">
                          {templates.map(t => (
                            <div key={t.id} className="flex items-center gap-1">
                              <button type="button" onClick={() => { setEditPlantName(t.plant_name); setEditVariety(t.variety ?? ""); setEditCategory(t.category ?? ""); setEditPotSize(t.pot_size ?? ""); setEditDescription(t.description ?? ""); toast.success(`Loaded "${t.name}"`); }}
                                className="text-xs bg-muted hover:bg-muted/70 px-2 py-1 rounded border"
                              >{t.name}</button>
                              <button type="button" onClick={() => deleteTemplate(t.id)} className="text-muted-foreground hover:text-destructive"><X size={10} /></button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="space-y-1">
                      <Label>Save as template <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
                      <div className="flex gap-2">
                        <Input value={saveTemplateName} onChange={e => setSaveTemplateName(e.target.value)} placeholder="Template name, e.g. Monstera" className="text-sm" onKeyDown={e => e.key === "Enter" && saveAsTemplate()} />
                        <Button type="button" variant="outline" size="sm" onClick={saveAsTemplate} disabled={savingTemplate || !saveTemplateName.trim()}>{savingTemplate ? "…" : "Save"}</Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" onClick={() => setModal(null)} className="flex-1">Cancel</Button>
                <Button onClick={submitEdit} disabled={submitting || !editPlantName.trim()} className="flex-1 bg-leaf hover:bg-forest">
                  {submitting ? "Saving…" : "Save Changes"}
                </Button>
              </div>
            </div>
            );
          })()}
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
                <li><span className="font-medium text-leaf">In Shop</span> — allocated to an active shop listing</li>
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
