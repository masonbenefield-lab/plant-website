"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,

} from "@/components/ui/dialog";
import { toast } from "sonner";
import type { Database } from "@/lib/supabase/types";
import { findProhibitedWord, censorWord, logViolation } from "@/lib/profanity";
import { MapPin, Lock, Mail, KeyRound } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { OpenToTradesToggle } from "@/components/garden/open-to-trades-toggle";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

// Temporary: hide the seller upgrade pricing ($9/$29 tiers) while we roll out the
// new pricing model (week of 2026-07-06). Set back to false to restore.
const HIDE_SELLER_PRICING: boolean = true;

export default function AccountForm({
  profile,
  userId,
}: {
  profile: Profile | null;
  userId: string;
}) {
  const router = useRouter();
  const [username, setUsername] = useState(profile?.username ?? "");
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [location, setLocation] = useState(profile?.location ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? "");
  const [bannerUrl, setBannerUrl] = useState(profile?.banner_url ?? "");
  const [showFollowerCount, setShowFollowerCount] = useState(profile?.show_follower_count ?? false);
  const [shippingDays, setShippingDays] = useState<number | "">(profile?.shipping_days ?? "");
  const [shippingDaysMax, setShippingDaysMax] = useState<number | "">((profile as { shipping_days_max?: number | null } | null)?.shipping_days_max ?? "");
  const [returnPolicyType, setReturnPolicyType] = useState<string>((profile as { return_policy_type?: string | null } | null)?.return_policy_type ?? "");
  const [returnPolicyNotes, setReturnPolicyNotes] = useState<string>((profile as { return_policy_notes?: string | null } | null)?.return_policy_notes ?? "");
  const [vacationMode, setVacationMode] = useState(profile?.vacation_mode ?? false);
  const [vacationUntil, setVacationUntil] = useState(profile?.vacation_until ?? "");
  const [offersEnabled, setOffersEnabled] = useState((profile as { offers_enabled?: boolean } | null)?.offers_enabled !== false);
  const [announcement, setAnnouncement] = useState((profile as { announcement?: string | null } | null)?.announcement ?? "");
  const [announcementExpiresAt, setAnnouncementExpiresAt] = useState((profile as { announcement_expires_at?: string | null } | null)?.announcement_expires_at?.split("T")[0] ?? "");
  const [emailOptIn, setEmailOptIn] = useState(profile?.email_marketing_opt_in ?? false);
  const [dailyCareEmails, setDailyCareEmails] = useState(profile?.daily_care_emails ?? true);
  const [carePushReminders, setCarePushReminders] = useState((profile as { care_push_reminders?: boolean } | null)?.care_push_reminders ?? false);
  const [postalCode, setPostalCode] = useState((profile as { postal_code?: string | null } | null)?.postal_code ?? "");
  const [frostAlerts, setFrostAlerts] = useState((profile as { frost_alerts?: boolean } | null)?.frost_alerts ?? true);
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>(
    (profile?.social_links as Record<string, string> | null) ?? {}
  );

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    const el = document.getElementById(hash);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("anchor-flash");
    const t = setTimeout(() => el.classList.remove("anchor-flash"), 3000);
    return () => clearTimeout(t);
  }, []);

  // While pricing is being reworked, the custom banner is free for everyone
  // (it's expected to be free under the new model). Reverts with the flag.
  const canUseBanner = HIDE_SELLER_PRICING || profile?.is_admin || (profile?.plan && profile.plan !== "seedling");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);

  const [newEmail, setNewEmail] = useState("");
  const [changingEmail, setChangingEmail] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [connectingStripe, setConnectingStripe] = useState(false);
  const [openingStripeDashboard, setOpeningStripeDashboard] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [openingPortal, setOpeningPortal] = useState(false);

  async function uploadBanner(file: File) {
    setUploadingBanner(true);
    const supabase = createClient();
    const ext = file.name.split(".").pop();
    const path = `${userId}/banner.${ext}`;
    const { error } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });
    if (error) {
      toast.error(error.message || "Banner upload failed");
      setUploadingBanner(false);
      return;
    }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    setBannerUrl(data.publicUrl);
    setUploadingBanner(false);
    toast.success("Banner uploaded");
  }

  async function uploadAvatar(file: File) {
    setUploading(true);
    const supabase = createClient();
    const ext = file.name.split(".").pop();
    const path = `${userId}/avatar.${ext}`;
    const { error } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });
    if (error) {
      toast.error(error.message || "Avatar upload failed");
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    setAvatarUrl(data.publicUrl);
    setUploading(false);
    toast.success("Avatar uploaded");
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();

    const usernameViolation = findProhibitedWord(username);
    if (usernameViolation) {
      toast.error(`Your username contains a prohibited word: "${censorWord(usernameViolation)}"`);
      logViolation(usernameViolation, "username", username);
      return;
    }
    const bioViolation = bio ? findProhibitedWord(bio) : null;
    if (bioViolation) {
      toast.error(`Your bio contains a prohibited word: "${censorWord(bioViolation)}"`);
      logViolation(bioViolation, "bio", bio);
      return;
    }
    const locationViolation = location ? findProhibitedWord(location) : null;
    if (locationViolation) {
      toast.error(`Your location contains a prohibited word: "${censorWord(locationViolation)}"`);
      logViolation(locationViolation, "location", location);
      return;
    }

    setSaving(true);
    const res = await fetch("/api/profile/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        display_name: displayName.trim() || null,
        bio,
        location,
        avatar_url: avatarUrl,
        banner_url: bannerUrl,
        show_follower_count: showFollowerCount,
        shipping_days: shippingDays === "" ? null : shippingDays,
        shipping_days_max: shippingDaysMax === "" ? null : shippingDaysMax,
        return_policy_type: returnPolicyType || null,
        return_policy_notes: returnPolicyNotes.trim() || null,
        vacation_mode: vacationMode,
        vacation_until: vacationUntil || null,
        offers_enabled: offersEnabled,
        announcement: announcement.trim() || null,
        announcement_expires_at: announcement.trim() && announcementExpiresAt ? announcementExpiresAt : null,
        email_marketing_opt_in: emailOptIn,
        daily_care_emails: dailyCareEmails,
        care_push_reminders: carePushReminders,
        postal_code: postalCode.trim() || null,
        frost_alerts: frostAlerts,
        social_links: Object.fromEntries(
          Object.entries(socialLinks).filter(([, v]) => v.trim().length > 0)
        ),
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (data.error) {
      toast.error(data.error);
    } else {
      toast.success("Profile saved");
    }
  }

  async function sendPasswordReset() {
    setSendingReset(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) { toast.error("No email on file"); setSendingReset(false); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/account`,
    });
    setSendingReset(false);
    if (error) toast.error(error.message);
    else toast.success("Password reset email sent — check your inbox");
  }

  async function changeEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmail.trim()) return;
    setChangingEmail(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
    setChangingEmail(false);
    if (error) toast.error(error.message);
    else { toast.success("Confirmation sent to your new email address"); setNewEmail(""); }
  }

  async function openStripeDashboard() {
    setOpeningStripeDashboard(true);
    try {
      const res = await fetch("/api/stripe/connect/dashboard", { method: "POST" });
      const { url, error } = await res.json();
      if (error) { toast.error(error); return; }
      window.open(url, "_blank");
    } finally {
      setOpeningStripeDashboard(false);
    }
  }

  async function startStripeConnect() {
    setConnectingStripe(true);
    try {
      const res = await fetch("/api/stripe/connect/onboard", { method: "POST" });
      const { url, error } = await res.json();
      if (error) { toast.error(error); return; }
      if (!url) { toast.error("Failed to start Stripe onboarding. Please try again."); return; }
      window.location.href = url;
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setConnectingStripe(false);
    }
  }

  async function startSubscription(plan: "grower" | "nursery", billing: "monthly" | "annual") {
    setSubscribing(true);
    try {
      const res = await fetch("/api/stripe/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan, billing }) });
      const { url, error } = await res.json();
      if (error) { toast.error(error); return; }
      window.location.href = url;
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubscribing(false);
    }
  }

  async function openBillingPortal() {
    setOpeningPortal(true);
    try {
      const res = await fetch("/api/stripe/billing-portal", { method: "POST" });
      const { url, error } = await res.json();
      if (error) { toast.error(error); return; }
      window.location.href = url;
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setOpeningPortal(false);
    }
  }

  function PlanBillingCard({ profile }: { profile: Profile | null }) {
    const plan = profile?.plan ?? "seedling";
    const isGroundbreaker = !!profile?.groundbreaker;
    const groundbreakerNumber = profile?.groundbreaker_number ?? null;
    const hasSubscription = !!(profile as { stripe_subscription_id?: string | null } | null)?.stripe_subscription_id;

    const planLabel = plan === "nursery" ? "Nursery" : plan === "grower" ? "Grower" : "Seedling";
    const planColor = plan === "nursery" ? "text-blue-700 bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300"
      : plan === "grower" ? "text-leaf bg-[#EBF0E6] border-[#C5D4BC] dark:bg-forest/20 dark:border-forest dark:text-[#A8BF9A]"
      : "text-muted-foreground bg-muted border-border";

    return (
      <Card id="plan-billing" className="scroll-mt-24">
        <CardHeader>
          <CardTitle>Plan &amp; Billing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Current plan</span>
            <div className="flex items-center gap-2">
              {isGroundbreaker && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full border bg-amber-50 border-amber-300 text-amber-800 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-300">
                  ⛏️ Groundbreaker {groundbreakerNumber ? `#${groundbreakerNumber}` : ""}
                </span>
              )}
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${planColor}`}>{planLabel}</span>
            </div>
          </div>

          {isGroundbreaker ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 p-4 space-y-1">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">Nursery plan — free forever</p>
              <p className="text-sm text-amber-800 dark:text-amber-300">
                You joined as one of Plantet&apos;s first 150 Groundbreakers. You have full Nursery plan access with no subscription — ever. Thank you for being here from the start.
              </p>
            </div>
          ) : plan === "seedling" ? (
            HIDE_SELLER_PRICING ? (
              <div className="rounded-lg border bg-muted/40 p-4 space-y-1">
                <p className="text-sm font-semibold">New seller pricing coming this week</p>
                <p className="text-sm text-muted-foreground">
                  We&apos;re updating our plans and commission. Nothing changes for you right now —
                  keep selling as usual and we&apos;ll share the new details soon.
                </p>
              </div>
            ) : (
              <BillingToggleSection subscribing={subscribing} startSubscription={startSubscription} />
            )
          ) : (
            <div className="space-y-3">
              {hasSubscription ? (
                <>
                  <p className="text-sm text-muted-foreground">Manage your subscription, change plans, update payment method, or cancel through the Stripe billing portal.</p>
                  <Button variant="outline" disabled={openingPortal} onClick={openBillingPortal}>
                    {openingPortal ? "Redirecting…" : "Manage subscription →"}
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Your plan was set during signup. To manage billing, contact support.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card id="profile" className="scroll-mt-24">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-5">
            {/* Store Banner */}
            <div className="space-y-2">
              <Label>Store Banner</Label>
              {canUseBanner ? (
                <>
                  <div
                    className="relative w-full h-36 rounded-lg border-2 border-dashed border-border bg-muted overflow-hidden cursor-pointer group"
                    onClick={() => bannerRef.current?.click()}
                  >
                    {bannerUrl ? (
                      <Image src={bannerUrl} alt="Store banner" fill className="object-cover" />
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full gap-1 text-muted-foreground">
                        <span className="text-2xl">🖼️</span>
                        <span className="text-sm">Click to upload a banner</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-white text-sm font-medium">
                        {uploadingBanner ? "Uploading…" : bannerUrl ? "Change banner" : "Upload banner"}
                      </span>
                    </div>
                  </div>
                  <input
                    ref={bannerRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadBanner(file); }}
                  />
                  {bannerUrl && (
                    <button
                      type="button"
                      onClick={() => setBannerUrl("")}
                      className="text-xs text-destructive hover:underline"
                    >
                      Remove banner
                    </button>
                  )}
                  <p className="text-xs text-muted-foreground">Recommended: 1500×400px (landscape). Avoid tall or square images — they'll be cropped on wider screens.</p>
                </>
              ) : (
                <div className="w-full h-36 rounded-lg border-2 border-dashed border-border bg-muted flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <Lock size={20} />
                  <p className="text-sm font-medium">Custom banner is a Grower+ feature</p>
                  <Link href="/pricing" className="text-xs text-leaf hover:underline font-medium">
                    Upgrade to unlock →
                  </Link>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt="Avatar"
                  width={72}
                  height={72}
                  className="rounded-full object-cover"
                />
              ) : (
                <div className="w-[72px] h-[72px] rounded-full bg-[#DFE7D4] flex items-center justify-center text-2xl font-bold text-leaf">
                  {username.slice(0, 1).toUpperCase() || "?"}
                </div>
              )}
              <div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                >
                  {uploading ? "Uploading…" : "Change photo"}
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadAvatar(file);
                  }}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ""))}
                required
                minLength={3}
                maxLength={30}
              />
              <p className="text-xs text-muted-foreground">Used in your storefront URL — lowercase only.</p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="display_name">Display Name</Label>
              <Input
                id="display_name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={50}
                placeholder={username}
              />
              <p className="text-xs text-muted-foreground">What buyers see on your storefront. Defaults to your username if left blank.</p>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between">
                <Label htmlFor="bio">Bio</Label>
                <span className="text-xs text-muted-foreground">{bio.length}/500</span>
              </div>
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={4}
                placeholder="Tell buyers about your nursery or collection…"
                maxLength={500}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="location">Location</Label>
              <div className="relative">
                <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Nashville, TN or United Kingdom"
                  maxLength={100}
                  className="pl-8"
                />
              </div>
              <p className="text-xs text-muted-foreground">Helps buyers find sellers near them. Be as specific or general as you like.</p>
            </div>

            <div className="flex items-center justify-between rounded-lg border px-4 py-3">
              <div>
                <p className="text-sm font-medium">Show follower count publicly</p>
                <p className="text-xs text-muted-foreground mt-0.5">Display how many people follow you on your storefront</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={showFollowerCount}
                onClick={() => setShowFollowerCount((v) => !v)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${showFollowerCount ? "bg-leaf" : "bg-input"}`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform ${showFollowerCount ? "translate-x-5" : "translate-x-0"}`}
                />
              </button>
            </div>

            <div id="shipping-days" className="space-y-1 scroll-mt-24">
              <Label>Shipping timeline</Label>
              <div className="flex items-center gap-2">
                <select
                  id="shipping-days"
                  value={shippingDays}
                  onChange={(e) => {
                    const val = e.target.value === "" ? "" : Number(e.target.value);
                    setShippingDays(val);
                    if (val === "" || (shippingDaysMax !== "" && Number(val) >= Number(shippingDaysMax))) setShippingDaysMax("");
                  }}
                  className="flex h-10 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Not specified</option>
                  <option value="1">1 day</option>
                  <option value="2">2 days</option>
                  <option value="3">3 days</option>
                  <option value="5">5 days</option>
                  <option value="7">1 week</option>
                  <option value="14">2 weeks</option>
                </select>
                <span className="text-sm text-muted-foreground shrink-0">to</span>
                <select
                  id="shipping-days-max"
                  value={shippingDaysMax}
                  disabled={shippingDays === ""}
                  onChange={(e) => setShippingDaysMax(e.target.value === "" ? "" : Number(e.target.value))}
                  className="flex h-10 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                >
                  <option value="">No max</option>
                  {shippingDays !== "" && Number(shippingDays) < 2  && <option value="2">2 days</option>}
                  {shippingDays !== "" && Number(shippingDays) < 3  && <option value="3">3 days</option>}
                  {shippingDays !== "" && Number(shippingDays) < 5  && <option value="5">5 days</option>}
                  {shippingDays !== "" && Number(shippingDays) < 7  && <option value="7">1 week</option>}
                  {shippingDays !== "" && Number(shippingDays) < 14 && <option value="14">2 weeks</option>}
                  {shippingDays !== "" && Number(shippingDays) < 21 && <option value="21">3 weeks</option>}
                  {shippingDays !== "" && Number(shippingDays) < 30 && <option value="30">1 month</option>}
                </select>
              </div>
              <p className="text-xs text-muted-foreground">Shown to buyers on your listings and storefront.</p>
            </div>

            <div id="return-policy" className="space-y-1.5 scroll-mt-24">
              <Label htmlFor="return-policy-select">Return policy</Label>
              <select
                id="return-policy-select"
                value={returnPolicyType}
                onChange={(e) => { setReturnPolicyType(e.target.value); if (!e.target.value) setReturnPolicyNotes(""); }}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Not specified</option>
                <option value="all_sales_final">🚫 All sales final</option>
                <option value="doa_guarantee">🌱 DOA guarantee</option>
                <option value="case_by_case">💬 Contact me first</option>
              </select>
              {returnPolicyType && (
                <Textarea
                  value={returnPolicyNotes}
                  onChange={(e) => setReturnPolicyNotes(e.target.value)}
                  placeholder={
                    returnPolicyType === "all_sales_final" ? "e.g. All sales are final. Please ask questions before purchasing." :
                    returnPolicyType === "doa_guarantee"   ? "e.g. Contact me within 3 days of delivery with photos and I'll make it right." :
                    "e.g. Message me before opening a dispute and I'll do my best to help."
                  }
                  rows={2}
                  maxLength={300}
                  className="resize-none text-sm"
                />
              )}
              <p className="text-xs text-muted-foreground">Shown to buyers on your listings and storefront.</p>
            </div>

            <div className="rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Accept offers on listings</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Allow buyers to send price offers on your fixed-price listings. You can accept or decline each one.</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={offersEnabled}
                  onClick={() => setOffersEnabled((v) => !v)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${offersEnabled ? "bg-leaf" : "bg-input"}`}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform ${offersEnabled ? "translate-x-5" : "translate-x-0"}`} />
                </button>
              </div>
            </div>

            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Vacation mode</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Pause your storefront while you&apos;re away. Listings stay as-is and resume when you turn this off.</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={vacationMode}
                  onClick={() => setVacationMode((v) => !v)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${vacationMode ? "bg-amber-500" : "bg-input"}`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform ${vacationMode ? "translate-x-5" : "translate-x-0"}`}
                  />
                </button>
              </div>
              {vacationMode && (
                <div className="space-y-1">
                  <Label htmlFor="vacation-until">Back on (optional)</Label>
                  <Input
                    id="vacation-until"
                    type="date"
                    value={vacationUntil}
                    onChange={(e) => setVacationUntil(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                  />
                  <p className="text-xs text-muted-foreground">Displayed on your storefront so buyers know when you return.</p>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="announcement">Storefront announcement (optional)</Label>
              <Textarea
                id="announcement"
                value={announcement}
                onChange={(e) => {
                  setAnnouncement(e.target.value);
                  if (!e.target.value.trim()) setAnnouncementExpiresAt("");
                }}
                placeholder="e.g. 🌿 Spring sale! 20% off all tropicals this week"
                rows={2}
                maxLength={200}
              />
              {announcement.trim() && (
                <div className="flex items-center gap-2 pt-1">
                  <Label htmlFor="announcement-expires" className="text-xs text-muted-foreground whitespace-nowrap">Expires on (optional)</Label>
                  <Input
                    id="announcement-expires"
                    type="date"
                    value={announcementExpiresAt}
                    onChange={(e) => setAnnouncementExpiresAt(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="w-40 h-8 text-xs"
                  />
                  {announcementExpiresAt && (
                    <button
                      type="button"
                      onClick={() => setAnnouncementExpiresAt("")}
                      className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                    >
                      Clear
                    </button>
                  )}
                </div>
              )}
              <p className="text-xs text-muted-foreground">Shown as a banner at the top of your storefront. Max 200 characters. Clear to remove.</p>
            </div>

            <div className="space-y-2">
              <Label>Social links</Label>
              <p className="text-xs text-muted-foreground">Enter your handle for each platform you want shown on your storefront.</p>
              <div className="space-y-2">
                {([
                  { key: "instagram", label: "Instagram", prefix: "instagram.com/" },
                  { key: "tiktok",    label: "TikTok",    prefix: "tiktok.com/@" },
                  { key: "youtube",   label: "YouTube",   prefix: "youtube.com/@" },
                  { key: "facebook",  label: "Facebook",  prefix: "facebook.com/" },
                  { key: "x",         label: "X",         prefix: "x.com/" },
                  { key: "pinterest", label: "Pinterest", prefix: "pinterest.com/" },
                  { key: "etsy",      label: "Etsy",      prefix: "etsy.com/shop/" },
                ] as const).map(({ key, label, prefix }) => (
                  <div key={key} className="flex items-center">
                    <span className="text-xs text-muted-foreground bg-muted border border-input border-r-0 rounded-l-md px-2.5 h-10 flex items-center shrink-0 whitespace-nowrap">
                      {prefix}
                    </span>
                    <Input
                      value={socialLinks[key] ?? ""}
                      onChange={(e) =>
                        setSocialLinks({ ...socialLinks, [key]: e.target.value.replace(/^@/, "").trim() })
                      }
                      placeholder={label === "Etsy" ? "yourshopname" : "yourhandle"}
                      className="rounded-l-none"
                      maxLength={100}
                    />
                  </div>
                ))}
              </div>
            </div>

            <Button type="submit" disabled={saving} className="bg-leaf hover:bg-forest">
              {saving ? "Saving…" : "Save profile"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card id="garden-trading" className="scroll-mt-24">
        <CardHeader>
          <CardTitle>Garden &amp; Trading</CardTitle>
        </CardHeader>
        <CardContent>
          <OpenToTradesToggle
            initialOpenToTrades={profile?.open_to_trades ?? false}
            disclaimerAccepted={profile?.trades_disclaimer_accepted ?? false}
          />
        </CardContent>
      </Card>

      <Card id="email-preferences" className="scroll-mt-24">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Mail size={18} /> Email Preferences</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start justify-between gap-4 rounded-lg border px-4 py-4">
            <div>
              <p className="text-sm font-medium">Weekly plant digest</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Receive a weekly email with new arrivals from shops you follow, fresh picks from around the marketplace, and hot auctions. Sent every Sunday — unsubscribe anytime.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={emailOptIn}
              onClick={() => setEmailOptIn((v) => !v)}
              className={`mt-0.5 relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${emailOptIn ? "bg-leaf" : "bg-input"}`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform ${emailOptIn ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </div>
          <div className="flex items-start justify-between gap-4 rounded-lg border px-4 py-4 mt-3">
            <div>
              <p className="text-sm font-medium">Weekly garden care reminders</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Receive a Sunday evening email with everything your plants need for the coming week. Only sent when you have tasks due.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={dailyCareEmails}
              onClick={() => setDailyCareEmails((v) => !v)}
              className={`mt-0.5 relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${dailyCareEmails ? "bg-leaf" : "bg-input"}`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform ${dailyCareEmails ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </div>
          <div className="flex items-start justify-between gap-4 rounded-lg border px-4 py-4 mt-3">
            <div>
              <p className="text-sm font-medium">Daily care push reminders</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Get an app notification each morning when your plants have care due — no email. Requires notifications enabled on your device. Only sent on days you have tasks due.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={carePushReminders}
              onClick={() => setCarePushReminders((v) => !v)}
              className={`mt-0.5 relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${carePushReminders ? "bg-leaf" : "bg-input"}`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform ${carePushReminders ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </div>
          <div className="rounded-lg border px-4 py-4 mt-3 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Frost alerts</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  Get an evening app notification when overnight frost is forecast for your area, so you can protect outdoor plants. Needs your ZIP code below.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={frostAlerts}
                onClick={() => setFrostAlerts((v) => !v)}
                className={`mt-0.5 relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${frostAlerts ? "bg-leaf" : "bg-input"}`}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform ${frostAlerts ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            </div>
            <div className="space-y-1">
              <Label htmlFor="postal_code" className="text-xs">ZIP code (US) — used only for frost forecasts</Label>
              <Input
                id="postal_code"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 5))}
                placeholder="e.g. 78701"
                inputMode="numeric"
                className="max-w-[160px]"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Save your profile above to apply changes to notification preferences.
          </p>
        </CardContent>
      </Card>

      <Card id="email-address" className="scroll-mt-24">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Mail size={18} /> Email Address</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={changeEmail} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="new-email">New email address</Label>
              <Input
                id="new-email"
                type="email"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                placeholder="Enter new email…"
              />
              <p className="text-xs text-muted-foreground">A confirmation link will be sent to both your old and new address.</p>
            </div>
            <Button type="submit" variant="outline" disabled={changingEmail || !newEmail.trim()}>
              {changingEmail ? "Sending…" : "Change Email"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card id="password" className="scroll-mt-24">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><KeyRound size={18} /> Password</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">We&apos;ll send a secure reset link to your email address.</p>
          <Button variant="outline" onClick={sendPasswordReset} disabled={sendingReset}>
            {sendingReset ? "Sending…" : "Send Password Reset Email"}
          </Button>
        </CardContent>
      </Card>

      <Card id="seller-payments" className="scroll-mt-24">
        <CardHeader>
          <CardTitle>Seller Payments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {profile?.stripe_onboarded ? (
            <div className="space-y-3">
              <p className="text-sm text-leaf font-medium">
                ✓ Stripe account connected — you can receive payments
              </p>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={openStripeDashboard} disabled={openingStripeDashboard}>
                  {openingStripeDashboard ? "Opening..." : "View Stripe Dashboard"}
                </Button>
                <Button variant="outline" size="sm" onClick={startStripeConnect} disabled={connectingStripe}>
                  {connectingStripe ? "Redirecting..." : "Reconnect Stripe Account"}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Connect your bank account via Stripe to receive payments from buyers. Stripe handles all
                payouts securely.
              </p>
              <Button onClick={startStripeConnect} disabled={connectingStripe} className="bg-leaf hover:bg-forest">
                {connectingStripe ? "Redirecting to Stripe..." : "Connect Bank Account"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <PlanBillingCard profile={profile} />

      <PlantGuidePreference />
    </div>
  );
}

const PLANT_GUIDE_KEY = "plantet_plant_guide_enabled";

function PlantGuidePreference() {
  const [enabled, setEnabled] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(PLANT_GUIDE_KEY);
    if (stored === "false") setEnabled(false);
  }, []);

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    localStorage.setItem(PLANT_GUIDE_KEY, String(next));
  }

  if (!mounted) return null;

  return (
    <Card id="display-preferences" className="scroll-mt-24">
      <CardHeader>
        <CardTitle className="text-base">Display Preferences</CardTitle>
      </CardHeader>
      <CardContent>
        <label className="flex items-center justify-between gap-4 cursor-pointer select-none">
          <div>
            <p className="text-sm font-medium">Show plant care tips when searching</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Displays a brief plant guide card below the search bar when you search by plant name.
            </p>
          </div>
          <button
            role="switch"
            aria-checked={enabled}
            onClick={toggle}
            className={`relative shrink-0 inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leaf ${
              enabled ? "bg-leaf" : "bg-muted-foreground/30"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                enabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </label>
      </CardContent>
    </Card>
  );
}

function BillingToggleSection({
  subscribing,
  startSubscription,
}: {
  subscribing: boolean;
  startSubscription: (plan: "grower" | "nursery", billing: "monthly" | "annual") => void;
}) {
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Upgrade to unlock lower commissions, more listings, and buyer digest exposure.</p>

      {/* Billing toggle */}
      <div className="flex items-center gap-2">
        <div className="flex rounded-full border border-border p-0.5 text-xs font-medium">
          <button
            type="button"
            onClick={() => setBilling("monthly")}
            className={cn(
              "px-3 py-1 rounded-full transition-colors",
              billing === "monthly" ? "bg-leaf text-white" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setBilling("annual")}
            className={cn(
              "px-3 py-1 rounded-full transition-colors",
              billing === "annual" ? "bg-leaf text-white" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Annual
          </button>
        </div>
        {billing === "annual" && (
          <span className="text-xs font-medium text-leaf bg-[#DFE7D4] dark:bg-forest/40 dark:text-sage px-2 py-0.5 rounded-full">
            Save 2 months
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border p-3 space-y-2">
          <p className="text-sm font-semibold">
            Grower — {billing === "annual" ? "$86/yr" : "$9/mo"}
          </p>
          {billing === "annual" && (
            <p className="text-xs text-leaf dark:text-sage font-medium">$7.17/mo · 2 months free</p>
          )}
          <p className="text-xs text-muted-foreground">50 listings · 4.5% commission · digest exposure</p>
          <Button size="sm" className="w-full bg-leaf hover:bg-forest" disabled={subscribing} onClick={() => startSubscription("grower", billing)}>
            {subscribing ? "Redirecting…" : "Upgrade"}
          </Button>
        </div>
        <div className="rounded-lg border p-3 space-y-2">
          <p className="text-sm font-semibold">
            Nursery — {billing === "annual" ? "$278/yr" : "$29/mo"}
          </p>
          {billing === "annual" && (
            <p className="text-xs text-leaf dark:text-sage font-medium">$23.17/mo · 2 months free</p>
          )}
          <p className="text-xs text-muted-foreground">Unlimited listings · 20 photos · 3% commission · full digest + homepage</p>
          <Button size="sm" className="w-full bg-leaf hover:bg-forest" disabled={subscribing} onClick={() => startSubscription("nursery", billing)}>
            {subscribing ? "Redirecting…" : "Upgrade"}
          </Button>
        </div>
      </div>
    </div>
  );
}
