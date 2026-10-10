// Demo catalog for Koramangala. Synthetic, shaped like the PS-01 brief
// (merchant catalog, user profiles, weather). Swap for the official dataset
// by replacing these exports; the engine reads only the Scenario contract.

import type { LatLng, Merchant, Scenario, User, Weather } from "../engine/types";

/** Priya's office, Koramangala 5th Block. */
export const OFFICE: LatLng = { lat: 12.9352, lng: 77.6245 };

const M_PER_DEG_LAT = 110_600;
const M_PER_DEG_LNG = 108_500;

/** Point `east` / `north` metres away from `from`. */
export function offset(from: LatLng, east: number, north: number): LatLng {
  return {
    lat: +(from.lat + north / M_PER_DEG_LAT).toFixed(6),
    lng: +(from.lng + east / M_PER_DEG_LNG).toFixed(6),
  };
}

const WEEKDAYS = [1, 2, 3, 4, 5];
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

export const MERCHANTS: Merchant[] = [
  {
    id: "brew-bites",
    name: "Brew & Bites",
    category: "cafe",
    location: offset(OFFICE, 120, 100),
    hours: { open: "08:00", close: "23:00" },
    max_discount_pct: 20,
    offer_windows: [{ days: WEEKDAYS, start: "13:00", end: "15:00", goal: "fill empty seats" }],
    occupancy: 0.2,
    rating: 4.5,
    indoor: true,
    items: [
      { id: "cold-coffee", name: "Cold Coffee", category: "coffee", price: 180, margin_pct: 0.62, stock: 40, tags: ["veg", "cold"] },
      { id: "med-bowl", name: "Mediterranean Bowl", category: "healthy", price: 350, margin_pct: 0.45, stock: 12, tags: ["veg", "meal"] },
      { id: "paneer-panini", name: "Paneer Panini", category: "cafe", price: 240, margin_pct: 0.42, stock: 9, tags: ["veg", "snack"] },
    ],
  },
  {
    id: "dosa-mane",
    name: "Dosa Mane",
    category: "south_indian",
    location: offset(OFFICE, -150, 160),
    hours: { open: "07:00", close: "22:30" },
    max_discount_pct: 10,
    occupancy: 0.85,
    rating: 4.4,
    indoor: false,
    items: [
      { id: "masala-dosa", name: "Masala Dosa", category: "south_indian", price: 90, margin_pct: 0.55, stock: 60, tags: ["veg", "hot", "meal"] },
      { id: "filter-coffee", name: "Filter Coffee", category: "coffee", price: 40, margin_pct: 0.7, stock: 200, tags: ["veg", "hot"] },
    ],
  },
  {
    id: "kulfi-co",
    name: "Kulfi & Co.",
    category: "dessert",
    location: offset(OFFICE, 250, -200),
    hours: { open: "12:00", close: "23:30" },
    max_discount_pct: 25,
    offer_windows: [{ days: EVERY_DAY, start: "14:00", end: "17:00", goal: "afternoon slump" }],
    occupancy: 0.1,
    rating: 4.6,
    indoor: false,
    items: [
      { id: "malai-kulfi", name: "Malai Kulfi", category: "dessert", price: 80, margin_pct: 0.6, stock: 50, tags: ["veg", "cold", "snack"] },
      { id: "mango-kulfi", name: "Mango Kulfi", category: "dessert", price: 90, margin_pct: 0.58, stock: 30, tags: ["veg", "cold", "snack"] },
    ],
  },
  {
    id: "bowl-theory",
    name: "Bowl Theory",
    category: "healthy",
    location: offset(OFFICE, 520, 380),
    hours: { open: "11:00", close: "22:00" },
    max_discount_pct: 15,
    offer_windows: [{ days: WEEKDAYS, start: "15:00", end: "18:00", goal: "pre-dinner lull" }],
    occupancy: 0.3,
    rating: 4.3,
    indoor: true,
    items: [
      { id: "quinoa-salad", name: "Quinoa Salad", category: "healthy", price: 320, margin_pct: 0.4, stock: 15, tags: ["veg", "meal"] },
      { id: "acai-bowl", name: "Açaí Bowl", category: "healthy", price: 290, margin_pct: 0.42, stock: 8, tags: ["veg", "cold", "snack"] },
    ],
  },
  {
    id: "biryani-junction",
    name: "Biryani Junction",
    category: "biryani",
    location: offset(OFFICE, -1100, 900),
    hours: { open: "11:30", close: "23:00" },
    max_discount_pct: 15,
    occupancy: 0.5,
    rating: 4.2,
    indoor: true,
    items: [
      { id: "chicken-biryani", name: "Chicken Biryani", category: "biryani", price: 280, margin_pct: 0.4, stock: 25, tags: ["hot", "meal"] },
      { id: "veg-biryani", name: "Veg Biryani", category: "biryani", price: 220, margin_pct: 0.45, stock: 20, tags: ["veg", "hot", "meal"] },
    ],
  },
  {
    id: "bake-street",
    name: "Bake Street",
    category: "bakery",
    location: offset(OFFICE, 60, -90),
    hours: { open: "07:30", close: "13:00" },
    max_discount_pct: 30,
    occupancy: 0,
    rating: 4.4,
    indoor: true,
    items: [
      { id: "croissant", name: "Butter Croissant", category: "bakery", price: 120, margin_pct: 0.6, stock: 6, tags: ["veg", "snack"] },
    ],
  },
  {
    id: "sugarcane-stop",
    name: "Sugarcane Stop",
    category: "juice",
    location: offset(OFFICE, -230, -120),
    hours: { open: "10:00", close: "20:00" },
    max_discount_pct: 20,
    offer_windows: [{ days: EVERY_DAY, start: "12:00", end: "17:00" }],
    occupancy: 0.4,
    rating: 4.0,
    indoor: false,
    items: [
      { id: "sugarcane", name: "Sugarcane Juice", category: "juice", price: 60, margin_pct: 0.65, stock: 0, tags: ["veg", "cold"] },
      { id: "lemon-mint", name: "Lemon Mint Cooler", category: "juice", price: 70, margin_pct: 0.68, stock: 0, tags: ["veg", "cold"] },
    ],
  },
  {
    id: "wok-street",
    name: "Wok Street",
    category: "chinese",
    location: offset(OFFICE, -400, -350),
    hours: { open: "12:00", close: "23:00", days: [0, 1, 3, 4, 5, 6] },
    max_discount_pct: 20,
    offer_windows: [{ days: EVERY_DAY, start: "18:30", end: "21:30", goal: "early dinner" }],
    occupancy: 0.25,
    rating: 4.1,
    indoor: true,
    items: [
      { id: "hakka-noodles", name: "Veg Hakka Noodles", category: "chinese", price: 210, margin_pct: 0.55, stock: 30, tags: ["veg", "hot", "meal"] },
      { id: "manchow-soup", name: "Manchow Soup", category: "chinese", price: 150, margin_pct: 0.6, stock: 25, tags: ["veg", "hot", "snack"] },
    ],
  },
];

export const PRIYA: User = {
  id: "u-priya",
  name: "Priya",
  age: 26,
  persona: "Works at a startup in Koramangala. Dosa Mane three times this week.",
  location: OFFICE,
  wallet_inr: 400,
  marketing_consent: true,
  language: "hinglish",
  free_until: "13:35",
  category_affinity: {
    south_indian: 0.8,
    healthy: 0.65,
    coffee: 0.5,
    cafe: 0.45,
    juice: 0.45,
    dessert: 0.4,
    bakery: 0.35,
    chinese: 0.3,
    biryani: 0.3,
  },
  visits: { "dosa-mane": 3 },
  price_sensitivity: 0.6,
  diet: ["veg"],
};

export const ARJUN: User = {
  id: "u-arjun",
  name: "Arjun",
  age: 31,
  persona: "Same building. At Brew & Bites five times this week.",
  location: offset(OFFICE, 10, 5),
  wallet_inr: 900,
  marketing_consent: true,
  language: "hinglish",
  free_until: "14:00",
  category_affinity: {
    coffee: 0.9,
    cafe: 0.8,
    healthy: 0.3,
    south_indian: 0.1,
    dessert: 0.2,
    juice: 0.2,
    bakery: 0.4,
    chinese: 0.2,
    biryani: 0.3,
  },
  visits: { "brew-bites": 5 },
  price_sensitivity: 0.15,
};

export const USERS = { priya: PRIYA, arjun: ARJUN };

const TUESDAY = "2026-10-13";
const WEDNESDAY = "2026-10-14";

export const SUNNY: Weather = { condition: "clear", temp_c: 33 };

export function scenario(
  id: string,
  user: User,
  date: string,
  time: string,
  weather: Weather,
  merchants: Merchant[] = MERCHANTS,
): Scenario {
  return {
    scenario_id: id,
    now: `${date}T${time}:00+05:30`,
    user,
    context: { weather },
    merchants: structuredClone(merchants),
  };
}

export type Preset = { id: string; label: string; note: string; build: () => Scenario };

export const PRESETS: Preset[] = [
  {
    id: "priya-tuesday",
    label: "Priya's Tuesday",
    note: "1:15 PM, 33°, 20 minutes of lunch left",
    build: () => scenario("priya-tuesday", PRIYA, TUESDAY, "13:15", SUNNY),
  },
  {
    id: "the-regular",
    label: "The regular",
    note: "Arjun already comes here every day",
    build: () => scenario("the-regular", ARJUN, TUESDAY, "13:15", SUNNY),
  },
  {
    id: "rainy-evening",
    label: "Rainy evening",
    note: "Wednesday 7:10 PM, rain, done with work",
    build: () =>
      scenario(
        "rainy-evening",
        { ...PRIYA, free_until: undefined },
        WEDNESDAY,
        "19:10",
        { condition: "rain", temp_c: 23 },
      ),
  },
  {
    id: "no-consent",
    label: "Opted out",
    note: "Same moment, but no marketing consent",
    build: () =>
      scenario("no-consent", { ...PRIYA, id: "u-meera", name: "Meera", marketing_consent: false }, TUESDAY, "13:15", SUNNY),
  },
  {
    id: "too-far",
    label: "Too far away",
    note: "Rohan is 3 km away in HSR Layout",
    build: () =>
      scenario(
        "too-far",
        { ...PRIYA, id: "u-rohan", name: "Rohan", location: offset(OFFICE, 1800, -2400), visits: {} },
        TUESDAY,
        "13:15",
        SUNNY,
      ),
  },
  {
    id: "late-night",
    label: "Past closing",
    note: "11:40 PM, everything is shut",
    build: () =>
      scenario("late-night", { ...PRIYA, free_until: undefined }, TUESDAY, "23:40", { condition: "clear", temp_c: 22 }),
  },
];

export const presetById = (id: string) => PRESETS.find((p) => p.id === id) ?? PRESETS[0];
