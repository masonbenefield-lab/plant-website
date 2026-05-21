export const PLANT_CATEGORIES = [
  "Aroids",
  "Succulents & Cacti",
  "Orchids",
  "Carnivorous Plants",
  "Ferns & Mosses",
  "Tropicals",
  "Herbs & Edibles",
  "Fruit Trees",
  "Rare & Exotic",
  "Other",
] as const;

export type PlantCategory = (typeof PLANT_CATEGORIES)[number];
