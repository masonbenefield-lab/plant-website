import Link from "next/link";

export const metadata = {
  title: "Terms of Service — Plantet",
};

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
      <p className="text-sm text-muted-foreground mb-10">Effective date: June 5, 2026</p>

      <div className="prose prose-sm dark:prose-invert max-w-none space-y-8">

        <section>
          <h2 className="text-xl font-semibold mb-3">1. Acceptance of Terms</h2>
          <p className="text-muted-foreground leading-relaxed">
            By creating an account or using Plantet (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) at plantet.shop,
            you agree to these Terms of Service and our{" "}
            <Link href="/privacy-policy" className="underline hover:text-foreground">Privacy Policy</Link>.
            If you do not agree, do not use Plantet.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">2. Eligibility</h2>
          <p className="text-muted-foreground leading-relaxed">
            You must be at least 18 years old and located in the United States to use Plantet.
            By creating an account you confirm that you meet these requirements. We reserve the right
            to terminate accounts that do not meet eligibility requirements.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">3. Your Account</h2>
          <div className="space-y-3 text-muted-foreground leading-relaxed">
            <p>
              You are responsible for maintaining the security of your account credentials and for all
              activity that occurs under your account. Do not share your password with others.
            </p>
            <p>
              Your username must not impersonate another person or business, contain offensive language,
              or violate any third-party rights. We reserve the right to reclaim or reassign usernames
              that violate these rules.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">4. Buying and Selling</h2>
          <div className="space-y-4 text-muted-foreground leading-relaxed">
            <div>
              <h3 className="font-medium text-foreground">Listings and Auctions</h3>
              <p>
                Sellers are responsible for ensuring their listings are accurate, lawful, and describe
                the plant or item being sold truthfully. Plantet is a venue — we are not a party to
                transactions between buyers and sellers.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-foreground">Purchases</h3>
              <p>
                When you purchase a listing or win an auction, you enter into a binding agreement with
                the seller. You agree to complete payment promptly. Failure to pay may result in account
                suspension.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-foreground">Auctions</h3>
              <p>
                Bids placed on auctions are binding. If you win an auction, you are obligated to
                complete the purchase. Sellers are obligated to fulfill won auctions. Neither party
                may cancel without cause after an auction ends.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-foreground">Seller Obligations</h3>
              <p>
                Sellers must ship items within the handling time stated on their storefront, provide
                accurate tracking information, and package plants appropriately for transit. Sellers
                are responsible for complying with all applicable laws regarding the sale and shipment
                of plants, including USDA and state agricultural regulations.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">5. Fees and Payments</h2>
          <div className="space-y-3 text-muted-foreground leading-relaxed">
            <p>
              Plantet charges a flat 5.5% platform fee on each completed sale (Groundbreaker sellers pay 2%),
              as shown on the{" "}
              <Link href="/pricing" className="underline hover:text-foreground">Pricing page</Link>.
              Fees are deducted automatically at the time of payout.
            </p>
            <p>
              Payments are processed by Stripe. Sellers must complete Stripe Connect onboarding to
              receive payouts. Plantet is not responsible for delays caused by Stripe&apos;s verification
              or payout schedules.
            </p>
            <p>
              Subscription fees (Grower and Nursery plans) are billed monthly and are non-refundable
              except where required by law.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">6. Prohibited Items and Conduct</h2>
          <div className="space-y-3 text-muted-foreground leading-relaxed">
            <p>The following are prohibited on Plantet:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Plants or items that are illegal to sell, ship, or possess under federal, state, or local law</li>
              <li>Plants listed on the CITES appendices without proper permits</li>
              <li>Invasive species that are prohibited in the buyer&apos;s or seller&apos;s state</li>
              <li>Counterfeit, mislabeled, or misrepresented plants</li>
              <li>Non-plant items unless explicitly permitted by Plantet</li>
              <li>Harassment, hate speech, or abusive behavior toward other users</li>
              <li>Fake reviews, manipulated ratings, or fraudulent transactions</li>
              <li>Creating multiple accounts to circumvent suspensions or bans</li>
            </ul>
            <p>
              Violation of these rules may result in listing removal, account suspension, or permanent ban
              without refund of subscription fees.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">7. Shipping and Plant Health</h2>
          <p className="text-muted-foreground leading-relaxed">
            Sellers are solely responsible for the safe packaging and timely shipment of their plants.
            Plantet does not guarantee plant survival during or after shipping. Buyers and sellers are
            encouraged to communicate directly about shipping concerns. Refund and return disputes are
            handled between buyers and sellers; Plantet may intervene at its discretion in cases of
            clear fraud or policy violation.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">8. Ratings and Reviews</h2>
          <p className="text-muted-foreground leading-relaxed">
            Buyers may leave ratings and reviews for sellers after a completed order. Reviews must be
            honest and based on your actual transaction. We reserve the right to remove reviews that
            violate our policies (e.g., contain personal attacks, are fraudulent, or are unrelated to
            the transaction). Sellers may not offer compensation in exchange for positive reviews.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">9. Content You Post</h2>
          <p className="text-muted-foreground leading-relaxed">
            By uploading photos or text to Plantet (listings, profiles, garden logs), you grant us a
            non-exclusive, royalty-free license to display and reproduce that content on Plantet for
            the purpose of operating the platform. You retain ownership of your content. You are
            responsible for ensuring you have the right to post any content you upload.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">10. Disclaimers</h2>
          <div className="space-y-3 text-muted-foreground leading-relaxed">
            <p>
              Plantet is provided &ldquo;as is&rdquo; without warranties of any kind. We do not guarantee that
              the platform will be uninterrupted, error-free, or that listings are accurate. We are not
              responsible for the quality, legality, or condition of items listed by sellers.
            </p>
            <p>
              Plant care information provided on Plantet (including care schedules and guides) is for
              informational purposes only and is not a substitute for professional horticultural advice.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">11. Limitation of Liability</h2>
          <p className="text-muted-foreground leading-relaxed">
            To the fullest extent permitted by law, Plantet and its owners, employees, and affiliates
            shall not be liable for any indirect, incidental, special, or consequential damages arising
            from your use of the platform, including but not limited to lost profits, plant loss or
            damage during shipping, or disputes between buyers and sellers. Our total liability to you
            for any claim shall not exceed the fees you paid to Plantet in the 12 months preceding
            the claim.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">12. Termination</h2>
          <p className="text-muted-foreground leading-relaxed">
            You may close your account at any time from your account settings. We reserve the right to
            suspend or terminate accounts that violate these terms, engage in fraudulent activity, or
            pose a risk to the platform or other users. Termination does not relieve you of obligations
            arising from transactions completed prior to termination.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">13. Governing Law</h2>
          <p className="text-muted-foreground leading-relaxed">
            These terms are governed by the laws of the State of Texas, United States, without regard
            to conflict of law principles. Any disputes arising from these terms or your use of Plantet
            shall be resolved in the courts of Texas.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">14. Changes to These Terms</h2>
          <p className="text-muted-foreground leading-relaxed">
            We may update these terms from time to time. We will notify registered users by email and
            update the effective date at the top of this page. Continued use of Plantet after changes
            take effect constitutes acceptance of the revised terms.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">15. Contact Us</h2>
          <p className="text-muted-foreground leading-relaxed">
            Questions about these terms? Contact us at{" "}
            <a href="mailto:support@plantet.shop" className="underline hover:text-foreground">support@plantet.shop</a>.
          </p>
        </section>

        <div className="pt-4 border-t text-sm text-muted-foreground">
          <Link href="/privacy-policy" className="underline hover:text-foreground">Privacy Policy</Link>
          {" · "}
          <Link href="/seller-agreement" className="underline hover:text-foreground">Seller Agreement</Link>
          {" · "}
          <Link href="/" className="underline hover:text-foreground">Back to Plantet</Link>
        </div>
      </div>
    </div>
  );
}
