import Image from "next/image";

type TimelineEvent = { event_date: string; photos: string[] | null; created_at: string };

// A growth gallery: every photo from the plant's care log, oldest -> newest,
// so you can watch the plant change over time. Reuses event photos — no extra
// upload step. Renders nothing if the plant has no photos yet.
export function PlantProgressTimeline({ events }: { events: TimelineEvent[] }) {
  const items = events
    .flatMap((e) => (e.photos ?? []).map((url) => ({ url, date: e.event_date })))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  if (items.length === 0) return null;

  return (
    <div className="space-y-3">
      <div>
        <h2 className="font-semibold">Progress timeline</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Photos from your care log, oldest to newest. Add photos when you log an event below.
        </p>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {items.map((it, i) => (
          <a
            key={`${it.url}-${i}`}
            href={it.url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0"
          >
            <div className="relative w-32 h-32 sm:w-40 sm:h-40 rounded-xl overflow-hidden border hover:opacity-90 transition-opacity">
              <Image src={it.url} alt={`Progress photo ${i + 1}`} fill className="object-cover" sizes="160px" />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 text-center">
              {new Date(it.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </p>
          </a>
        ))}
      </div>
    </div>
  );
}
