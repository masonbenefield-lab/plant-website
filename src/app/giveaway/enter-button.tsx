"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, Copy, Check, MapPin } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface ShippingAddress {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

interface Props {
  monthLabel: string;
  initialEntered: boolean;
  referralCode?: string | null;
  savedAddress?: ShippingAddress | null;
  emailOptedIn?: boolean;
}

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
];

const US_STATE_NAMES: Record<string, string> = {
  "ALABAMA":"AL","ALASKA":"AK","ARIZONA":"AZ","ARKANSAS":"AR","CALIFORNIA":"CA",
  "COLORADO":"CO","CONNECTICUT":"CT","DELAWARE":"DE","FLORIDA":"FL","GEORGIA":"GA",
  "HAWAII":"HI","IDAHO":"ID","ILLINOIS":"IL","INDIANA":"IN","IOWA":"IA","KANSAS":"KS",
  "KENTUCKY":"KY","LOUISIANA":"LA","MAINE":"ME","MARYLAND":"MD","MASSACHUSETTS":"MA",
  "MICHIGAN":"MI","MINNESOTA":"MN","MISSISSIPPI":"MS","MISSOURI":"MO","MONTANA":"MT",
  "NEBRASKA":"NE","NEVADA":"NV","NEW HAMPSHIRE":"NH","NEW JERSEY":"NJ","NEW MEXICO":"NM",
  "NEW YORK":"NY","NORTH CAROLINA":"NC","NORTH DAKOTA":"ND","OHIO":"OH","OKLAHOMA":"OK",
  "OREGON":"OR","PENNSYLVANIA":"PA","RHODE ISLAND":"RI","SOUTH CAROLINA":"SC",
  "SOUTH DAKOTA":"SD","TENNESSEE":"TN","TEXAS":"TX","UTAH":"UT","VERMONT":"VT",
  "VIRGINIA":"VA","WASHINGTON":"WA","WEST VIRGINIA":"WV","WISCONSIN":"WI","WYOMING":"WY","DISTRICT OF COLUMBIA":"DC",
};

function isUSAddress(addr: ShippingAddress): boolean {
  if (addr.country && addr.country !== "US") return false;
  const state = addr.state.trim().toUpperCase();
  return US_STATES.includes(state) || !!US_STATE_NAMES[state];
}

export function EnterButton({ monthLabel, initialEntered, referralCode, savedAddress, emailOptedIn = false }: Props) {
  const router = useRouter();
  const [entered, setEntered] = useState(initialEntered);
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [agreedToRules, setAgreedToRules] = useState(false);
  const [emailOptIn, setEmailOptIn] = useState(false);
  const [showAddressStep, setShowAddressStep] = useState(false);
  const [address, setAddress] = useState<ShippingAddress>(
    savedAddress ?? { name: "", line1: "", line2: "", city: "", state: "", zip: "", country: "US" }
  );
  const [savingAddress, setSavingAddress] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof ShippingAddress, string>>>({});

  function handleCopy() {
    if (!referralCode) return;
    const url = `${window.location.origin}/signup?ref=${referralCode}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function doEnter() {
    startTransition(async () => {
      if (!emailOptedIn && emailOptIn) {
        fetch("/api/profile/update", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email_marketing_opt_in: true }),
        }).catch(() => {});
      }
      const res = await fetch("/api/giveaway/enter", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Something went wrong");
        return;
      }
      setEntered(true);
      router.refresh();
      if (!json.already) toast.success(`You're entered for ${monthLabel}! Good luck!`);
    });
  }

  async function handleConfirmAddress() {
    const errors: Partial<Record<keyof ShippingAddress, string>> = {};
    if (!address.name) errors.name = "Required";
    if (!address.line1) errors.line1 = "Required";
    if (!address.city) errors.city = "Required";
    if (!address.zip) errors.zip = "Required";
    if (!address.state) {
      errors.state = "Required";
    } else if (!isUSAddress(address)) {
      errors.state = "Must be a valid US state";
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setSavingAddress(true);
    await fetch("/api/stripe/buyer-profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shippingAddress: { ...address, country: "US" } }),
    }).catch(() => {});
    setSavingAddress(false);
    setShowAddressStep(false);
    doEnter();
  }

  function field(label: string, key: keyof ShippingAddress, required = false, half = false) {
    const error = fieldErrors[key];
    return (
      <div className={half ? "col-span-1" : "col-span-2"}>
        <Label className="text-xs mb-1 block">{label}{required && <span className="text-destructive ml-0.5">*</span>}</Label>
        <Input
          value={address[key] ?? ""}
          onChange={(e) => {
            setAddress((a) => ({ ...a, [key]: e.target.value }));
            if (fieldErrors[key]) setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
          }}
          className={`h-8 text-sm ${error ? "border-destructive focus-visible:ring-destructive" : ""}`}
        />
        {error && <p className="text-xs text-destructive mt-0.5">{error}</p>}
      </div>
    );
  }

  // Already entered
  if (entered) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-leaf font-semibold text-lg">
          <CheckCircle2 size={22} />
          You&apos;re entered for {monthLabel}!
        </div>
        {referralCode && (
          <div className="rounded-lg border border-[#C5D4BC] dark:border-forest bg-[#EBF0E6] dark:bg-forest/20 px-4 py-3 space-y-2">
            <p className="text-xs font-medium text-forest dark:text-[#A8BF9A]">
              Boost your chances — share your referral link. +1 entry when a friend adds their first plant, +2 when they list an item or start an auction.
            </p>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-leaf text-white hover:bg-forest transition-colors"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? "Copied!" : "Copy referral link"}
            </button>
          </div>
        )}
      </div>
    );
  }

  // Address confirmation step
  if (showAddressStep) {
    return (
      <div className="space-y-3 max-w-sm">
        <div className="flex items-center gap-2 text-sm font-medium">
          <MapPin size={15} className="text-leaf" />
          Confirm your shipping address
        </div>
        <p className="text-xs text-muted-foreground">
          We&apos;ll use this to ship your prize if you win. Must be a US address.
          {savedAddress && " Your saved address is pre-filled — update it if needed."}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {field("Full Name", "name", true)}
          {field("Address Line 1", "line1", true)}
          {field("Address Line 2", "line2")}
          {field("City", "city", true, true)}
          {field("State", "state", true, true)}
          {field("ZIP Code", "zip", true, true)}
        </div>
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            className="bg-leaf hover:bg-forest text-white"
            onClick={handleConfirmAddress}
            disabled={savingAddress || isPending}
          >
            {(savingAddress || isPending) ? <Loader2 size={14} className="animate-spin mr-1.5" /> : null}
            Confirm &amp; Enter
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowAddressStep(false)}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // Default: rules checkbox + enter button
  return (
    <div className="space-y-3">
      <label className="flex items-start gap-2.5 cursor-pointer">
        <input
          type="checkbox"
          checked={agreedToRules}
          onChange={(e) => setAgreedToRules(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-input accent-leaf cursor-pointer shrink-0"
        />
        <span className="text-xs text-muted-foreground leading-relaxed">
          I agree to the{" "}
          <Link href="/giveaway/rules" target="_blank" className="underline hover:text-foreground font-medium">
            Official Giveaway Rules
          </Link>
          . No purchase necessary. Open to US residents 18+.
        </span>
      </label>
      {!emailOptedIn && (
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={emailOptIn}
            onChange={(e) => setEmailOptIn(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-input accent-leaf cursor-pointer shrink-0"
          />
          <span className="text-xs text-muted-foreground leading-relaxed">
            I&apos;d like to receive plant updates, giveaway announcements, and news from Plantet. (Optional)
          </span>
        </label>
      )}
      <Button
        size="lg"
        className="bg-leaf hover:bg-forest text-white px-10 text-base disabled:opacity-50"
        onClick={() => setShowAddressStep(true)}
        disabled={!agreedToRules}
      >
        Enter to Win
      </Button>
    </div>
  );
}
