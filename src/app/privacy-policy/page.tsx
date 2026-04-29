import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — Plantet",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground mb-10">Effective date: April 29, 2026</p>

      <div className="prose prose-sm dark:prose-invert max-w-none space-y-8">

        <section>
          <h2 className="text-xl font-semibold mb-3">1. Who We Are</h2>
          <p className="text-muted-foreground leading-relaxed">
            Plantet (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) operates the plant marketplace at plantet.app. This policy
            explains what personal information we collect, how we use it, and what rights you have over it.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">2. Information We Collect</h2>
          <div className="space-y-4 text-muted-foreground leading-relaxed">
            <div>
              <h3 className="font-medium text-foreground">Account Information</h3>
              <p>When you create an account we collect your email address, username, and password (stored as a
              bcrypt hash — we never see your plaintext password). If you choose to add a bio, shop location,
              profile photo, or banner image, that information is stored in your profile.</p>
            </div>
            <div>
              <h3 className="font-medium text-foreground">Listing &amp; Auction Content</h3>
              <p>When you create a listing or auction we collect the plant name, variety, description, price,
              quantity, category, and any photos you upload. This content is publicly visible.</p>
            </div>
            <div>
              <h3 className="font-medium text-foreground">Transaction &amp; Payment Data</h3>
              <p>When you make or receive a payment, we collect order details including the items purchased,
              amounts, and shipping address you provide at checkout. Full payment card details are processed
              and stored exclusively by Stripe — we never see or store your card number, CVV, or bank account
              credentials.</p>
            </div>
            <div>
              <h3 className="font-medium text-foreground">Seller Onboarding Data</h3>
              <p>If you connect a bank account to receive payments, that process is handled entirely by
              Stripe Connect. Stripe collects your identity and banking information directly and is responsible
              for its security.</p>
            </div>
            <div>
              <h3 className="font-medium text-foreground">Reviews &amp; Ratings</h3>
              <p>Reviews you write are publicly associated with your username. We store the star rating,
              comment text, and the order it relates to.</p>
            </div>
            <div>
              <h3 className="font-medium text-foreground">Usage &amp; Technical Data</h3>
              <p>Our hosting provider (Vercel) and database provider (Supabase) may collect standard server
              logs including IP addresses, browser type, pages visited, and timestamps. We do not sell or
              share this data for advertising purposes.</p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">3. How We Use Your Information</h2>
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground leading-relaxed">
            <li>To create and manage your account</li>
            <li>To process purchases, auctions, and payouts</li>
            <li>To display your public seller storefront</li>
            <li>To send transactional emails (order confirmations, bid notifications, shipping updates) via Resend</li>
            <li>To detect and prevent fraud, abuse, and prohibited content</li>
            <li>To comply with legal obligations</li>
          </ul>
          <p className="mt-3 text-muted-foreground leading-relaxed">
            We do not sell your personal information to third parties. We do not use your data for
            behavioral advertising.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">4. Third-Party Services</h2>
          <div className="space-y-3 text-muted-foreground leading-relaxed">
            <p>We rely on the following third-party providers to operate Plantet. Each has its own privacy policy.</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-foreground">Supabase</strong> — database, authentication, and file storage.
                Your account credentials and uploaded photos are stored on Supabase infrastructure.
                See <a href="https://supabase.com/privacy" className="underline hover:text-foreground" target="_blank" rel="noopener noreferrer">supabase.com/privacy</a>.
              </li>
              <li>
                <strong className="text-foreground">Stripe</strong> — payment processing and seller payouts via
                Stripe Connect. Stripe is a PCI-DSS Level 1 certified payment processor.
                See <a href="https://stripe.com/privacy" className="underline hover:text-foreground" target="_blank" rel="noopener noreferrer">stripe.com/privacy</a>.
              </li>
              <li>
                <strong className="text-foreground">Vercel</strong> — website hosting and serverless functions.
                See <a href="https://vercel.com/legal/privacy-policy" className="underline hover:text-foreground" target="_blank" rel="noopener noreferrer">vercel.com/legal/privacy-policy</a>.
              </li>
              <li>
                <strong className="text-foreground">Resend</strong> — transactional email delivery.
                See <a href="https://resend.com/legal/privacy-policy" className="underline hover:text-foreground" target="_blank" rel="noopener noreferrer">resend.com/legal/privacy-policy</a>.
              </li>
            </ul>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">5. Data Retention</h2>
          <p className="text-muted-foreground leading-relaxed">
            We retain your account data for as long as your account is active. Order records are retained for
            a minimum of 7 years for tax and legal compliance. If you delete your account, your profile,
            listings, and non-order data are removed within 30 days. Order records tied to completed
            transactions are retained for the legally required period even after account deletion.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">6. Your Rights</h2>
          <div className="space-y-3 text-muted-foreground leading-relaxed">
            <p>Depending on where you live, you may have the following rights:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong className="text-foreground">Access:</strong> Request a copy of the personal data we hold about you.</li>
              <li><strong className="text-foreground">Correction:</strong> Update incorrect or incomplete information in your account settings.</li>
              <li><strong className="text-foreground">Deletion (CCPA / GDPR &ldquo;right to be forgotten&rdquo;):</strong> Request deletion of your personal data. Note that order records may be retained as described above.</li>
              <li><strong className="text-foreground">Portability:</strong> Request your data in a machine-readable format.</li>
              <li><strong className="text-foreground">Opt-out of sale:</strong> We do not sell personal data. No opt-out is required.</li>
            </ul>
            <p>
              To exercise any of these rights, email us at{" "}
              <a href="mailto:privacy@plantet.app" className="underline hover:text-foreground">privacy@plantet.app</a>.
              We will respond within 30 days.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">7. Children&apos;s Privacy</h2>
          <p className="text-muted-foreground leading-relaxed">
            Plantet is intended for users who are 18 years of age or older. We do not knowingly collect
            personal information from anyone under 18. If we learn that a user is under 18, we will
            deactivate their account and delete their data promptly. If you believe a minor has created an
            account, please contact us at{" "}
            <a href="mailto:privacy@plantet.app" className="underline hover:text-foreground">privacy@plantet.app</a>.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">8. Cookies &amp; Local Storage</h2>
          <p className="text-muted-foreground leading-relaxed">
            We use cookies and browser local storage strictly for functionality — to keep you logged in and
            to remember UI preferences (such as your Plant Guide toggle setting). We do not use tracking
            cookies or third-party advertising cookies.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">9. Security</h2>
          <p className="text-muted-foreground leading-relaxed">
            We use industry-standard security measures including TLS encryption for data in transit,
            bcrypt password hashing, and row-level security policies on our database. No method of
            transmission over the internet is 100% secure; we cannot guarantee absolute security but
            take reasonable precautions to protect your information.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">10. Changes to This Policy</h2>
          <p className="text-muted-foreground leading-relaxed">
            We may update this policy from time to time. We will notify registered users by email and
            update the effective date at the top of this page. Continued use of Plantet after changes
            take effect constitutes acceptance of the revised policy.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">11. Contact Us</h2>
          <p className="text-muted-foreground leading-relaxed">
            Questions about this policy or your data? Contact us at{" "}
            <a href="mailto:privacy@plantet.app" className="underline hover:text-foreground">privacy@plantet.app</a>.
          </p>
        </section>

        <div className="pt-4 border-t text-sm text-muted-foreground">
          <Link href="/seller-agreement" className="underline hover:text-foreground">Seller Agreement</Link>
          {" · "}
          <Link href="/" className="underline hover:text-foreground">Back to Plantet</Link>
        </div>
      </div>
    </div>
  );
}
