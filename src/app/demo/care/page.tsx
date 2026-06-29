import type { Metadata } from "next";
import GardenTabs from "@/components/garden/garden-tabs";
import { DemoBanner } from "@/components/demo/demo-chrome";
import { DemoCareView } from "@/components/demo/demo-care-view";
import { DEMO_CARE_TASKS } from "@/lib/demo";

export const metadata: Metadata = {
  title: "Care Schedule demo · Plantet",
  description: "See how Plantet's care schedule tells you exactly what needs water, fertilizer, and care — every day.",
};

export default function DemoCarePage() {
  const tracked = DEMO_CARE_TASKS.length;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-6">
      <DemoBanner />

      <div>
        <h1 className="text-2xl font-bold">My Garden</h1>
        <p className="text-muted-foreground text-sm mt-0.5">{tracked} care tasks scheduled</p>
      </div>

      <GardenTabs basePath="/demo" />

      <DemoCareView />
    </div>
  );
}
