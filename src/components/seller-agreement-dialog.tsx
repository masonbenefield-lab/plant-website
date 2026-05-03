"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollText } from "lucide-react";
import { toast } from "sonner";

const LAST_UPDATED = "April 29, 2026";

interface SellerAgreementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccepted: () => void;
}

export default function SellerAgreementDialog({ open, onOpenChange, onAccepted }: SellerAgreementDialogProps) {
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleAccept() {
    setSaving(true);
    const res = await fetch("/api/seller-agreement/accept", { method: "POST" });
    const data = await res.json();
    setSaving(false);
    if (data.error) {
      toast.error(data.error);
      return;
    }
    toast.success("Agreement accepted — welcome to selling on Plantet!");
    setAgreed(false);
    onOpenChange(false);
    onAccepted();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setAgreed(false); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScrollText className="h-5 w-5 text-green-700 shrink-0" />
            Plantet Seller Agreement
          </DialogTitle>
          <DialogDescription>Last updated: {LAST_UPDATED}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-1 space-y-4 text-sm leading-relaxed">
          <section>
            <h3 className="font-semibold mb-1">1. Acceptance of Terms</h3>
            <p>By clicking "I Agree" below, you ("Seller") enter into a binding agreement with Plantet governing your use of seller tools, including creating listings and auctions. You must be at least 18 years old to sell on Plantet.</p>
          </section>
          <section>
            <h3 className="font-semibold mb-1">2. Accurate Listings</h3>
            <p>You agree to provide honest, accurate, and complete information in all listings and auctions, including correct plant identification, accurate photographs, honest condition descriptions, and correct quantity. Misrepresenting a plant's species or condition is grounds for immediate suspension.</p>
          </section>
          <section>
            <h3 className="font-semibold mb-1">3. Plant Health & Legal Compliance</h3>
            <p>You are solely responsible for ensuring all plants comply with applicable federal, state, and local laws, including USDA APHIS regulations, state import/export restrictions, phytosanitary requirements, invasive species laws, and CITES obligations. Plantet bears no liability for regulatory violations.</p>
          </section>
          <section>
            <h3 className="font-semibold mb-1">4. Prohibited Items</h3>
            <p>Prohibited: federally protected species without documentation, invasive species prohibited by law, misrepresented rare varieties, non-plant items, plants treated with undisclosed harmful chemicals, and counterfeit or stolen goods.</p>
          </section>
          <section>
            <h3 className="font-semibold mb-1">5. Fees & Payments</h3>
            <p>Plantet charges a platform fee on each completed sale, deducted automatically via Stripe Connect. The current rate is shown in your dashboard. You are responsible for all applicable taxes on your sales.</p>
          </section>
          <section>
            <h3 className="font-semibold mb-1">6. Shipping & Fulfillment</h3>
            <p>You agree to ship within 3 business days of payment, package plants appropriately, provide tracking numbers, and communicate promptly about delays. Failure to ship may result in order cancellation, buyer refunds, and suspension.</p>
          </section>
          <section>
            <h3 className="font-semibold mb-1">7. Dead on Arrival & Returns</h3>
            <p>Buyers may open a dispute within 48 hours of confirmed delivery for DOA plants with photographic evidence. You agree to work in good faith to resolve disputes, which may include partial or full refunds. Plantet's decision in unresolved disputes is final.</p>
          </section>
          <section>
            <h3 className="font-semibold mb-1">8. Prohibited Conduct</h3>
            <p>You agree not to solicit off-platform transactions, manipulate reviews, create multiple accounts to bypass restrictions, harass or defraud buyers, or engage in shill bidding or coordinated auction interference.</p>
          </section>
          <section>
            <h3 className="font-semibold mb-1">9. Content Standards</h3>
            <p>All content you post must be accurate, non-offensive, and free of hate speech, slurs, or discriminatory language. Plantet may edit or remove any content that violates these standards.</p>
          </section>
          <section>
            <h3 className="font-semibold mb-1">10. Suspension & Termination</h3>
            <p>Plantet may suspend or terminate your selling privileges for Agreement violations, repeated negative feedback, suspected fraud, or conduct detrimental to the community. Pending payouts for completed sales will be processed normally unless fraud is involved.</p>
          </section>
          <section>
            <h3 className="font-semibold mb-1">11. Limitation of Liability</h3>
            <p>Plantet is a marketplace platform and is not a party to buyer-seller transactions. We are not responsible for item quality, safety, legality, or shipment. Plantet's liability is limited to fees paid in the 90 days preceding any claim.</p>
          </section>
          <section>
            <h3 className="font-semibold mb-1">12. Governing Law</h3>
            <p>This Agreement is governed by the laws of the United States. Disputes shall be resolved through binding arbitration under the American Arbitration Association rules.</p>
          </section>
        </div>

        <div className="border-t pt-4 space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-green-700"
            />
            <span className="text-sm">
              I have read and agree to the Plantet Seller Agreement. I confirm I am at least 18 years old and will comply with all applicable laws regarding the sale and shipment of plants.
            </span>
          </label>
          <div className="flex items-center gap-3">
            <Button
              onClick={handleAccept}
              disabled={!agreed || saving}
              className="bg-green-700 hover:bg-green-800"
            >
              {saving ? "Saving…" : "I Agree — Start Selling"}
            </Button>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Not now
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
