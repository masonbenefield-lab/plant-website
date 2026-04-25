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
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ username, bio, avatar_url: avatarUrl })
      .eq("id", userId);
    setSaving(false);
    if (error) {
      toast.error(error.message);
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
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                placeholder="Tell buyers about your nursery or collection…"
                maxLength={500}
              />
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
