import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Giveaway Official Rules — Plantet",
};

export default function GiveawayRulesPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12 space-y-8">
      <div>
        <Link href="/giveaway" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← Back to Giveaway
        </Link>
        <h1 className="text-3xl font-bold mt-4">Official Giveaway Rules</h1>
        <p className="text-muted-foreground mt-2 text-sm">Last updated: June 2026</p>
      </div>

      <div className="space-y-6 text-sm leading-relaxed">
        <section className="space-y-2">
          <h2 className="font-semibold text-base">No Purchase Necessary</h2>
          <p className="text-muted-foreground">
            No purchase or payment of any kind is necessary to enter or win this giveaway. A purchase will not increase your chances of winning.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-base">Sponsor</h2>
          <p className="text-muted-foreground">
            This giveaway is sponsored by Plantet (plantet.shop), a plant marketplace operated in the United States. Each month&apos;s prize plant may be donated by a third-party seller ("Prize Donor") on the Plantet platform.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-base">Eligibility</h2>
          <p className="text-muted-foreground">
            Open to legal residents of the United States who are 18 years of age or older at the time of entry. Employees, officers, and directors of Plantet, prize donors, and their immediate family members are not eligible. Void where prohibited by law.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-base">Entry Period</h2>
          <p className="text-muted-foreground">
            Each giveaway runs for one calendar month. Entries open on the first day of the month and close at 11:59 PM CT on the last day of the month. One giveaway is held each month, subject to availability of a prize plant.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-base">How to Enter</h2>
          <p className="text-muted-foreground">
            To enter, create a free account at plantet.shop and click the "Enter to Win" button on the Giveaway page during the entry period. Limit one (1) entry per person per month. Duplicate entries will be disqualified. Entries do not carry over between months.
          </p>
          <p className="text-muted-foreground">
            <strong>Bonus entries:</strong> You may earn additional entries by referring new users to Plantet. Each referred user who creates an account and adds at least one plant to their garden during the entry period earns you one (1) additional entry for that month. There is no limit to the number of bonus entries you may earn.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-base">Prize</h2>
          <p className="text-muted-foreground">
            Each month&apos;s prize is one (1) live plant as described on the Giveaway page. Approximate retail value varies by month. The prize includes standard shipping to a valid US or Canadian address. No cash alternative or prize substitution is permitted, except at Plantet&apos;s sole discretion. Plantet reserves the right to substitute a prize of equal or greater value if the advertised prize becomes unavailable.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-base">Winner Selection</h2>
          <p className="text-muted-foreground">
            One (1) winner will be selected at random from all eligible entries on or shortly after the last day of each entry period. The odds of winning depend on the total number of eligible entries received. The drawing will be conducted by Plantet, whose decisions are final and binding.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-base">Winner Notification</h2>
          <p className="text-muted-foreground">
            The winner will be notified via email and/or platform message within five (5) business days of the drawing. The winner must respond within five (5) business days of notification and provide a valid shipping address. Failure to respond within the required time period may result in forfeiture of the prize and selection of an alternate winner.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-base">General Conditions</h2>
          <p className="text-muted-foreground">
            By entering, participants agree to be bound by these Official Rules and the decisions of Plantet. Plantet reserves the right to disqualify any entrant who tampers with the entry process or violates these rules. Plantet is not responsible for lost, late, incomplete, or misdirected entries. Plantet reserves the right to cancel, modify, or suspend the giveaway at any time for any reason.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-base">Privacy</h2>
          <p className="text-muted-foreground">
            Personal information collected in connection with this giveaway will be used only to administer the giveaway and notify the winner, and is subject to Plantet&apos;s{" "}
            <Link href="/privacy-policy" className="underline hover:text-foreground">Privacy Policy</Link>.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-base">Contact</h2>
          <p className="text-muted-foreground">
            Questions about these rules may be directed to Plantet via the{" "}
            <Link href="/contact" className="underline hover:text-foreground">Contact page</Link>.
          </p>
        </section>
      </div>
    </div>
  );
}
