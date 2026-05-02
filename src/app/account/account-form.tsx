"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import type { Database } from "@/lib/supabase/types";
import { findProhibitedWord, censorWord, logViolation } from "@/lib/profanity";
import { MapPin, Lock } from "lucide-react";
import Link from "next/link";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export default function AccountForm({
  profile,
  userId,
}: {
  profile: Profile | null;
  userId: string;
}) {
  const [username, setUsername] = useState(profile?.username ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [location, setLocation] = useState(profile?.location ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? "");
  const [bannerUrl, setBannerUrl] = useState(profile?.banner_url ?? "");
  const [showFollowerCount, setShowFollowerCount] = useState(profile?.show_follower_count ?? false);

  const canUseBanner = profile?.is_admin || (profile?.plan && profile.plan !== "seedling");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);

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
      body: JSON.stringify({ username, bio, location, avatar_url: avatarUrl, banner_url: bannerUrl, show_follower_count: showFollowerCount }),
    });
    const data = await res.json();
    setSaving(false);
    if (data.error) {
      toast.error(data.error);
    } else {
      toast.success("Profile saved");
    }
  }

  async function startStripeConnect() {
    const res = await fetch("/api/stripe/connect/onboard", { method: "POST" });
    const { url, error } = await res.json();
    if (error) return toast.error(error);
    window.location.href = url;
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

            <Button type="submit" disabled={saving} className="bg-green-700 hover:bg-green-800">
              {saving ? "Saving…" : "Save profile"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
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
              <Button onClick={startStripeConnect} className="bg-green-700 hover:bg-green-800">
                Connect Bank Account
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
