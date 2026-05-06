"use client";

import { useState, useRef } from "react";
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
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import type { Database } from "@/lib/supabase/types";
import { findProhibitedWord, censorWord, logViolation } from "@/lib/profanity";
import { MapPin, Lock, Mail, KeyRound, Trash2 } from "lucide-react";
import Link from "next/link";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

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
  const [vacationMode, setVacationMode] = useState(profile?.vacation_mode ?? false);
  const [vacationUntil, setVacationUntil] = useState(profile?.vacation_until ?? "");
  const [offersEnabled, setOffersEnabled] = useState((profile as { offers_enabled?: boolean } | null)?.offers_enabled !== false);
  const [announcement, setAnnouncement] = useState((profile as { announcement?: string | null } | null)?.announcement ?? "");
  const [emailOptIn, setEmailOptIn] = useState(profile?.email_marketing_opt_in ?? false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  const canUseBanner = profile?.is_admin || (profile?.plan && profile.plan !== "seedling");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);

  const [newEmail, setNewEmail] = useState("");
  const [changingEmail, setChangingEmail] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [connectingStripe, setConnectingStripe] = useState(false);
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
        vacation_mode: vacationMode,
        vacation_until: vacationUntil || null,
        offers_enabled: offersEnabled,
        announcement: announcement.trim() || null,
        email_marketing_opt_in: emailOptIn,
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
    const hasSubscription = !!(profile as { stripe_subscription_id?: string | null } | null)?.stripe_subscription_id;

    const planLabel = plan === "nursery" ? "Nursery" : plan === "grower" ? "Grower" : "Seedling";
    const planColor = plan === "nursery" ? "text-blue-700 bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300"
      : plan === "grower" ? "text-green-700 bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300"
      : "text-muted-foreground bg-muted border-border";

    return (
      <Card id="plan-billing">
        <CardHeader>
          <CardTitle>Plan &amp; Billing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Current plan</span>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${planColor}`}>{planLabel}</span>
          </div>

          {plan === "seedling" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Upgrade to unlock lower commissions, more listings, and buyer digest exposure.</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-3 space-y-2">
                  <p className="text-sm font-semibold">Grower — $9/mo</p>
                  <p className="text-xs text-muted-foreground">50 listings · 4.5% commission · digest exposure</p>
                  <Button size="sm" className="w-full bg-green-700 hover:bg-green-800" disabled={subscribing} onClick={() => startSubscription("grower", "monthly")}>
                    {subscribing ? "Redirecting…" : "Upgrade"}
                  </Button>
                </div>
                <div className="rounded-lg border p-3 space-y-2">
                  <p className="text-sm font-semibold">Nursery — $29/mo</p>
                  <p className="text-xs text-muted-foreground">Unlimited · 3% commission · full digest + homepage</p>
                  <Button size="sm" className="w-full bg-green-700 hover:bg-green-800" disabled={subscribing} onClick={() => startSubscription("nursery", "monthly")}>
                    {subscribing ? "Redirecting…" : "Upgrade"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {plan !== "seedling" && (
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

  async function handleDeleteAccount() {
    setDeleting(true);
    const res = await fetch("/api/account/delete", { method: "POST" });
    const data = await res.json();
    if (data.error) {
      toast.error(data.error);
      setDeleting(false);
      setDeleteDialogOpen(false);
      return;
    }
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <div className="space-y-6">
      <Card>
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
                  <Link href="/pricing" className="text-xs text-green-700 hover:underline font-medium">
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
                <div className="w-[72px] h-[72px] rounded-full bg-green-100 flex items-center justify-center text-2xl font-bold text-green-700">
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
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${showFollowerCount ? "bg-green-600" : "bg-input"}`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform ${showFollowerCount ? "translate-x-5" : "translate-x-0"}`}
                />
              </button>
            </div>

            <div className="space-y-1">
              <Label htmlFor="shipping-days">Shipping timeline</Label>
              <select
                id="shipping-days"
                value={shippingDays}
                onChange={(e) => setShippingDays(e.target.value === "" ? "" : Number(e.target.value))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Not specified</option>
                <option value="1">Ships within 1 day</option>
                <option value="2">Ships within 2 days</option>
                <option value="3">Ships within 3 days</option>
                <option value="5">Ships within 5 days</option>
                <option value="7">Ships within 1 week</option>
                <option value="14">Ships within 2 weeks</option>
              </select>
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
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${offersEnabled ? "bg-green-600" : "bg-input"}`}
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
                onChange={(e) => setAnnouncement(e.target.value)}
                placeholder="e.g. 🌿 Spring sale! 20% off all tropicals this week"
                rows={2}
                maxLength={200}
              />
              <p className="text-xs text-muted-foreground">Shown as a banner at the top of your storefront. Max 200 characters. Clear to remove.</p>
            </div>

            <Button type="submit" disabled={saving} className="bg-green-700 hover:bg-green-800">
              {saving ? "Saving…" : "Save profile"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Mail size={18} /> Email Preferences</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start justify-between gap-4 rounded-lg border px-4 py-4">
            <div>
              <p className="text-sm font-medium">Monthly plant digest</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Receive a monthly email with new arrivals from shops you follow, fresh picks from around the marketplace, and hot auctions. Sent once per month — unsubscribe anytime.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={emailOptIn}
              onClick={() => setEmailOptIn((v) => !v)}
              className={`mt-0.5 relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${emailOptIn ? "bg-green-600" : "bg-input"}`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform ${emailOptIn ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Save your profile above to apply changes to email preferences.
          </p>
        </CardContent>
      </Card>

      <Card>
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

      <Card>
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

      <Card id="seller-payments">
        <CardHeader>
          <CardTitle>Seller Payments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {profile?.stripe_onboarded ? (
            <p className="text-sm text-green-700 font-medium">
              ✓ Stripe account connected — you can receive payments
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Connect your bank account via Stripe to receive payments from buyers. Stripe handles all
                payouts securely.
              </p>
              <Button onClick={startStripeConnect} disabled={connectingStripe} className="bg-green-700 hover:bg-green-800">
                {connectingStripe ? "Redirecting to Stripe..." : "Connect Bank Account"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <PlanBillingCard profile={profile} />

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Trash2 size={18} /> Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Permanently delete your account and all associated data. This cannot be undone.
            You must fulfill any pending orders and end all active auctions first.
          </p>
          <Button
            variant="destructive"
            onClick={() => { setDeleteConfirm(""); setDeleteDialogOpen(true); }}
          >
            Delete Account
          </Button>
        </CardContent>
      </Card>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              This permanently removes your profile, listings, and all data. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <p className="text-sm text-muted-foreground">
              Type <span className="font-mono font-semibold">DELETE</span> to confirm.
            </p>
            <Input
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="DELETE"
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteConfirm !== "DELETE" || deleting}
              onClick={handleDeleteAccount}
            >
              {deleting ? "Deleting…" : "Delete Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
