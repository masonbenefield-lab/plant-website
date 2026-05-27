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

export type PlantCategory = (typeof PLANT_CATEGORIES)[number];
