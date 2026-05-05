export type Plan = "seedling" | "grower" | "nursery";

export interface PlanLimits {
  listings: number | null; // null = unlimited
  auctions: number | null;
  photos: number | null;
}

export function getPlanLimits(plan: Plan | null | undefined, isAdmin: boolean): PlanLimits {
  if (isAdmin) return { listings: null, auctions: null, photos: null };
  switch (plan) {
    case "nursery": return { listings: null, auctions: null, photos: null };
    case "grower":  return { listings: 50,   auctions: null, photos: 10  };
    default:        return { listings: 10,   auctions: 5,    photos: 5   };
  }
}

export function planFeePercent(plan: Plan | null | undefined, isAdmin: boolean): number {
  if (isAdmin) return 0;
  switch (plan) {
    case "nursery": return 3;
    case "grower":  return 4.5;
    default:        return 6.5;
  }
}

export function planLabel(plan: Plan | null | undefined): string {
  switch (plan) {
    case "nursery": return "Nursery";
    case "grower":  return "Grower";
    default:        return "Seedling";
  }
}
