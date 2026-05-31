export const PLANT_CATEGORIES = [
  "Aroids",
  "Succulents & Cacti",
  "Orchids",
  "Carnivorous Plants",
  "Ferns & Mosses",
  "Herbs & Edibles",
  "Fruit Trees",
  "Outdoor & Perennials",
  "Rare & Exotic",
  "Seasonal",
  "Garden Supplies",
  "Other",
] as const;

export const SUPPLY_CATEGORIES = [
  "Tools & Equipment",
  "Soil & Amendments",
  "Pots & Planters",
  "Fertilizers & Nutrients",
  "Pest & Disease Control",
  "Seeds & Bulbs",
  "Propagation Supplies",
  "Grow Lights & Equipment",
  "Other",
] as const;

export type PlantCategory = (typeof PLANT_CATEGORIES)[number];
export type SupplyCategory = (typeof SUPPLY_CATEGORIES)[number];
