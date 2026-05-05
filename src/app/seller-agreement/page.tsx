"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ScrollText } from "lucide-react";

const LAST_UPDATED = "April 29, 2026";

function AgreementContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const isSignMode = next !== null;
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
    router.push(next ?? "/dashboard/create");
    router.refresh();
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="flex items-center gap-3 mb-2">
        <ScrollText className="text-green-700 h-6 w-6 shrink-0" />
        <h1 className="text-2xl font-bold">Plantet Seller Agreement</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-8">Last updated: {LAST_UPDATED}</p>

      <div className="prose prose-sm dark:prose-invert max-w-none space-y-6 text-sm leading-relaxed">

        <section>
          <h2 className="text-base font-semibold mb-2">1. Acceptance of Terms</h2>
          <p>
            By clicking "I Agree" below, you ("Seller") enter into a binding agreement with Plantet ("Platform", "we", "us") governing your use of Plantet's seller tools, including creating listings and auctions. You must be at least 18 years old to sell on Plantet. If you are agreeing on behalf of a business, you represent that you have authority to bind that business.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-2">2. Accurate Listings</h2>
          <p>
            You agree to provide honest, accurate, and complete information in all listings and auctions, including:
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Correct plant species and variety identification to the best of your knowledge</li>
            <li>Accurate photographs that represent the actual plant being sold</li>
            <li>Honest descriptions of the plant's condition, size, and health</li>
            <li>Correct quantity and availability</li>
          </ul>
          <p className="mt-2">
            Misrepresenting a plant's species, variety, or condition is grounds for immediate suspension.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-2">3. Plant Health & Legal Compliance</h2>
          <p>You are solely responsible for ensuring that all plants you sell comply with applicable federal, state, and local laws, including:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>USDA Animal and Plant Health Inspection Service (APHIS) regulations</li>
            <li>State department of agriculture import/export restrictions</li>
            <li>Phytosanitary certificate requirements for interstate or international shipments</li>
            <li>Restrictions on invasive species and noxious weeds as classified by any applicable authority</li>
            <li>CITES treaty obligations for protected or endangered species</li>
          </ul>
          <p className="mt-2">
            Plantet does not verify compliance and bears no liability for regulatory violations. Listings found to violate plant health laws will be removed without notice.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-2">4. Prohibited Items</h2>
          <p>The following are strictly prohibited on Plantet:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Plants listed as federally or state-protected endangered species without proper documentation</li>
            <li>Invasive species prohibited by federal or state law</li>
            <li>Items misrepresented as rare or sought-after varieties</li>
            <li>Any item that is not an actual plant, cutting, seed, or related horticultural product</li>
            <li>Plants treated with undisclosed pesticides or chemicals harmful to buyers or the environment</li>
            <li>Counterfeit or stolen goods</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-2">5. Fees & Payments</h2>
          <p>
            Plantet charges a platform fee on each completed sale, deducted automatically via Stripe Connect before funds are transferred to your connected bank account. The current fee rate is displayed in your seller dashboard. Plantet reserves the right to modify fees with reasonable notice. You are responsible for all applicable taxes on your sales.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-2">6. Shipping & Fulfillment</h2>
          <p>You agree to:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Ship purchased items within 3 business days of payment unless otherwise stated in your listing</li>
            <li>Package live plants appropriately to ensure safe transit and minimize transit stress</li>
            <li>Provide a tracking number for all shipments</li>
            <li>Communicate promptly with buyers regarding any delays</li>
          </ul>
          <p className="mt-2">
            Failure to ship in a timely manner may result in order cancellation, refund to the buyer, and suspension of your selling privileges.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-2">7. Dead on Arrival & Returns</h2>
          <p>
            If a buyer receives a plant that is dead on arrival (DOA) or substantially not as described, they may open a dispute within 48 hours of confirmed delivery with photographic evidence. You agree to work in good faith to resolve disputes, which may include a partial or full refund. Plantet's decision in unresolved disputes is final.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-2">8. Prohibited Conduct</h2>
          <p>You agree not to:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Solicit or conduct transactions with buyers outside of the Plantet platform to avoid fees</li>
            <li>Manipulate reviews or ratings, including self-reviewing or pressuring buyers</li>
            <li>Create multiple accounts to circumvent suspensions or restrictions</li>
            <li>Use Plantet to harass, threaten, or defraud buyers or other sellers</li>
            <li>Engage in price manipulation, shill bidding, or coordinated auction interference</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-2">9. Content Standards</h2>
          <p>
            All content you post on Plantet — including listing titles, descriptions, photos, shop names, and bios — must be accurate, non-offensive, and free of hate speech, slurs, or discriminatory language. Plantet reserves the right to edit or remove any content that violates these standards without notice.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-2">10. Suspension & Termination</h2>
          <p>
            Plantet may suspend or permanently terminate your selling privileges at any time for violation of this Agreement, repeated negative buyer feedback, suspected fraud, or conduct detrimental to the Plantet community. Pending payouts for completed sales will be processed normally upon termination unless fraud is involved.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-2">11. Limitation of Liability</h2>
          <p>
            Plantet is a marketplace platform and is not a party to transactions between buyers and sellers. We are not responsible for the quality, safety, legality, or shipment of any item listed. To the maximum extent permitted by law, Plantet's liability to you for any claim arising from this Agreement is limited to fees paid by you to Plantet in the 90 days preceding the claim.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-2">12. Modifications</h2>
          <p>
            Plantet may update this Agreement at any time. We will notify active sellers of material changes via email. Continued use of selling features after the effective date of changes constitutes acceptance of the updated Agreement.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-2">13. Governing Law</h2>
          <p>
            This Agreement is governed by the laws of the United States. Any disputes arising from this Agreement shall be resolved through binding arbitration in accordance with the rules of the American Arbitration Association.
          </p>
        </section>

      </div>

      {/* Agreement action — only shown during seller onboarding */}
      {isSignMode && (
        <div className="mt-10 border-t pt-8 space-y-4">
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
          <div className="flex items-center gap-4">
            <Button
              onClick={handleAccept}
              disabled={!agreed || saving}
              className="bg-green-700 hover:bg-green-800"
            >
              {saving ? "Saving…" : "I Agree — Start Selling"}
            </Button>
            <Link href="/dashboard" className="text-sm text-muted-foreground hover:underline">
              Not now
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SellerAgreementPage() {
  return (
    <Suspense>
      <AgreementContent />
    </Suspense>
  );
}
