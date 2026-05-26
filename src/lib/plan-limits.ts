export type Plan = "seedling" | "grower" | "nursery";

export const GROUNDBREAKER_CAP = 150;

export interface PlanLimits {
  listings: number | null; // null = unlimited
  auctions: number | null;
  photos: number | null;
}

export function getPlanLimits(plan: Plan | null | undefined, isAdmin: boolean): PlanLimits {
  if (isAdmin) return { listings: null, auctions: null, photos: null };
  switch (plan) {
    case "nursery": return { listings: null, auctions: null, photos: 20  };
    case "grower":  return { listings: null, auctions: null, photos: 10  };
    default:        return { listings: null, auctions: 5,    photos: 5   };
  }
}

export function planFeePercent(plan: Plan | null | undefined, isAdmin: boolean, isGroundbreaker?: boolean): number {
  if (isAdmin) return 0;
  if (isGroundbreaker) return 2;
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
