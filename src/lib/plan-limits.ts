export type Plan = "seedling" | "grower" | "nursery";

export const GROUNDBREAKER_CAP = 150;

export interface PlanLimits {
  listings: number | null; // null = unlimited
  auctions: number | null;
  photos: number | null;
}

// Flat model: every seller gets the same tools — unlimited listings & auctions,
// 8 photos per listing. No pay-to-win feature gating between plans.
export function getPlanLimits(plan: Plan | null | undefined, isAdmin: boolean): PlanLimits {
  if (isAdmin) return { listings: null, auctions: null, photos: null };
  return { listings: null, auctions: null, photos: 8 };
}

// Flat 5.5% commission for everyone. Groundbreakers keep their promised 2%
// forever; admins pay nothing.
export function planFeePercent(plan: Plan | null | undefined, isAdmin: boolean, isGroundbreaker?: boolean): number {
  if (isAdmin) return 0;
  if (isGroundbreaker) return 2;
  return 5.5;
}

export function planLabel(plan: Plan | null | undefined): string {
  switch (plan) {
    case "nursery": return "Nursery";
    case "grower":  return "Grower";
    default:        return "Seedling";
  }
}
