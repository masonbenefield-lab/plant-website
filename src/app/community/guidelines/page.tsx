import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default function CommunityGuidelinesPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <Link href="/community" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ChevronLeft size={16} />
        Community
      </Link>

      <h1 className="text-2xl font-bold mb-2">Community Guidelines</h1>
      <p className="text-muted-foreground text-sm mb-8">
        Plantet is a place for plant lovers to share, learn, and connect. Keep it welcoming.
      </p>

      <div className="space-y-6 text-sm leading-relaxed">
        <section>
          <h2 className="font-semibold text-base mb-2">Be kind and respectful</h2>
          <p className="text-muted-foreground">
            Treat every member the way you&apos;d want to be treated. Disagreements happen — keep them civil. Personal attacks, harassment, and hate speech of any kind will result in immediate removal.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-base mb-2">Post in the right category</h2>
          <p className="text-muted-foreground">
            Use <strong className="text-foreground">Help Request</strong> when you need advice, an ID, or troubleshooting help. Use <strong className="text-foreground">Show & Tell</strong> to share a plant, growth update, or proud moment. Use <strong className="text-foreground">Discussion</strong> for open-ended conversations about care, species, or anything plant-related.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-base mb-2">No spam or self-promotion</h2>
          <p className="text-muted-foreground">
            Don&apos;t use the community to advertise products, services, or links unrelated to Plantet. If you have something to sell, list it in the shop. Repeated promotional posts will be removed.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-base mb-2">Keep it plant-related</h2>
          <p className="text-muted-foreground">
            Posts should be relevant to plants, gardening, or the Plantet community. Off-topic content may be removed to keep the feed useful for everyone.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-base mb-2">No misleading information</h2>
          <p className="text-muted-foreground">
            Share advice in good faith. If you&apos;re not sure about something, say so. Confidently wrong plant care advice can harm people&apos;s plants — and their trust in the community.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-base mb-2">Respect privacy</h2>
          <p className="text-muted-foreground">
            Don&apos;t share personal information about other members without their consent. This includes addresses, phone numbers, or any other identifying details.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-base mb-2">Report, don&apos;t retaliate</h2>
          <p className="text-muted-foreground">
            If you see a post or reply that violates these guidelines, use the report button. Don&apos;t respond with more hostility — let us handle it.
          </p>
        </section>

        <div className="rounded-xl border bg-muted/30 px-5 py-4 mt-8">
          <p className="text-muted-foreground">
            Violations of these guidelines may result in post removal, temporary suspension, or permanent ban depending on severity. If you have questions, <Link href="/contact" className="text-leaf hover:underline">contact us</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
