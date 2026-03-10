import React, { useState } from "react";

// ── Types ──────────────────────────────────────────────────────
export interface PesticideItem {
  name: string;
  purpose: string;
  dose: string;         // e.g. "2 ml per litre water"
  timing: string;       // e.g. "At first sign of infestation"
  safety: string;       // e.g. "Wear gloves & mask. Do not spray near water bodies."
  amazonUrl: string;
  bighaatUrl: string;
}

export interface SeedItem {
  name: string;
  purpose: string;
  sowingTime: string;   // e.g. "October - November"
  seedRate: string;     // e.g. "100 kg/acre"
  amazonUrl: string;
  bighaatUrl: string;
}

export interface MachineryItem {
  name: string;
  purpose: string;
  season: string;
  priceRange: string;   // e.g. "₹800 - ₹1,200"
  amazonUrl: string;
  flipkartUrl: string;
}

export interface NearbyShop {
  name: string;
  type: string;
  distanceKm: number;
  address: string;
  mapsUrl: string;
}

export interface AgriShopData {
  crop: string;
  pesticides: PesticideItem[];
  seeds: SeedItem[];
  machinery: MachineryItem[];
  nearbyShops: NearbyShop[];
  weather?: { temperature: number; humidity: number; condition: string };
}

// ── Crop → Pesticides + Seeds database ─────────────────────────

const CROP_PRODUCTS: Record<string, { pesticides: PesticideItem[]; seeds: SeedItem[] }> = {

  wheat: {
    pesticides: [
      { name: "Propiconazole 25% EC", purpose: "Rust & fungal diseases",
        dose: "1 ml per litre water (500 ml/acre)", timing: "At first yellow/brown rust spots on leaves",
        safety: "Wear gloves & mask. Do not spray during flowering. PHI: 30 days.",
        amazonUrl: "https://www.amazon.in/s?k=propiconazole+wheat+fungicide", bighaatUrl: "https://www.flipkart.com/search?q=propiconazole+fungicide" },
      { name: "Chlorpyrifos 20% EC", purpose: "Aphids & soil insects",
        dose: "2 ml per litre water (1 litre/acre)", timing: "When aphid colonies visible on leaves/stems",
        safety: "Toxic — use full PPE. Do not use within 30 days of harvest. Keep away from water sources.",
        amazonUrl: "https://www.amazon.in/s?k=chlorpyrifos+insecticide+wheat", bighaatUrl: "https://www.flipkart.com/search?q=chlorpyrifos+insecticide" },
      { name: "2,4-D Amine Salt 58%", purpose: "Broadleaf weed control",
        dose: "1.5–2 litre/acre in 200 litres water", timing: "25–35 days after sowing (tillering stage)",
        safety: "Do NOT spray on windy days. Harmful to neighbouring crops. Use flat fan nozzle only.",
        amazonUrl: "https://www.amazon.in/s?k=2+4+D+herbicide+wheat", bighaatUrl: "https://www.flipkart.com/search?q=2-4-D+herbicide+wheat" },
    ],
    seeds: [
      { name: "HD-2967 Wheat Seeds", purpose: "High yield, rust resistant — best for north & central India",
        sowingTime: "October 25 – November 25", seedRate: "40–45 kg/acre",
        amazonUrl: "https://www.amazon.in/s?k=HD+2967+wheat+seeds", bighaatUrl: "https://www.flipkart.com/search?q=wheat+seeds+HD+2967" },
      { name: "GW-496 Wheat Seeds", purpose: "Gujarat & west India recommended — good for late sowing",
        sowingTime: "November 10 – December 10", seedRate: "40 kg/acre",
        amazonUrl: "https://www.amazon.in/s?k=GW+496+wheat+seeds", bighaatUrl: "https://www.flipkart.com/search?q=wheat+seeds+GW" },
    ],
  },

  rice: {
    pesticides: [
      { name: "Chlorpyrifos 20% EC", purpose: "Stem borer control",
        dose: "2 ml per litre water (1 litre/acre)", timing: "When 5% dead hearts visible at vegetative stage",
        safety: "Do not mix with alkaline pesticides. PHI: 20 days before harvest.",
        amazonUrl: "https://www.amazon.in/s?k=chlorpyrifos+rice+stem+borer", bighaatUrl: "https://www.flipkart.com/search?q=chlorpyrifos+rice" },
      { name: "Carbendazim 50% WP", purpose: "Blast & sheath blight",
        dose: "1 g per litre water (200–250 g/acre)", timing: "At panicle initiation stage or at first disease sign",
        safety: "Avoid contact with eyes. Do not spray during heavy rain. PHI: 10 days.",
        amazonUrl: "https://www.amazon.in/s?k=carbendazim+fungicide+rice", bighaatUrl: "https://www.flipkart.com/search?q=carbendazim+rice+fungicide" },
      { name: "Buprofezin 25% SC", purpose: "Brown planthopper & whitefly",
        dose: "1 ml per litre water (400 ml/acre)", timing: "When hopper population exceeds 10 per hill",
        safety: "Systemic — effective for 2–3 weeks. PHI: 14 days. Moderate toxicity.",
        amazonUrl: "https://www.amazon.in/s?k=buprofezin+rice+insecticide", bighaatUrl: "https://www.flipkart.com/search?q=buprofezin+rice" },
    ],
    seeds: [
      { name: "Pusa Basmati 1121", purpose: "Premium basmati — high market price, extra-long grain",
        sowingTime: "June 15 – July 15 (transplant)", seedRate: "5–6 kg/acre nursery",
        amazonUrl: "https://www.amazon.in/s?k=pusa+basmati+1121+seeds", bighaatUrl: "https://www.flipkart.com/search?q=basmati+rice+seeds" },
      { name: "IR-64 Paddy Seeds", purpose: "High yield non-basmati, disease resistant",
        sowingTime: "June – July", seedRate: "8–10 kg/acre",
        amazonUrl: "https://www.amazon.in/s?k=IR+64+paddy+seeds", bighaatUrl: "https://www.flipkart.com/search?q=IR64+paddy+seeds" },
    ],
  },

  cotton: {
    pesticides: [
      { name: "Imidacloprid 17.8% SL", purpose: "Bollworm & whitefly sucking pests",
        dose: "0.5 ml per litre water (150 ml/acre)", timing: "At first sign of whitefly/jassid on lower leaves",
        safety: "Highly toxic to bees — do not spray during flowering. PHI: 25 days.",
        amazonUrl: "https://www.amazon.in/s?k=imidacloprid+cotton+insecticide", bighaatUrl: "https://www.flipkart.com/search?q=imidacloprid+cotton" },
      { name: "Profenofos 50% EC", purpose: "American bollworm spray",
        dose: "2 ml per litre water (1 litre/acre)", timing: "At boll formation stage when bollworm infestation starts",
        safety: "Use full PPE — gloves, mask, goggles. Do not spray more than 2 times/season. PHI: 14 days.",
        amazonUrl: "https://www.amazon.in/s?k=profenofos+cotton+bollworm", bighaatUrl: "https://www.flipkart.com/search?q=profenofos+cotton" },
      { name: "Acetamiprid 20% SP", purpose: "Whitefly & sucking pest control",
        dose: "0.2 g per litre water (40–60 g/acre)", timing: "When whitefly count exceeds 6 per leaf",
        safety: "Low mammalian toxicity. Avoid inhalation. PHI: 21 days.",
        amazonUrl: "https://www.amazon.in/s?k=acetamiprid+cotton", bighaatUrl: "https://www.flipkart.com/search?q=acetamiprid+cotton" },
    ],
    seeds: [
      { name: "Bt Cotton Seeds (Bollgard II)", purpose: "Bollworm resistant hybrid — reduces pesticide cost by 40%",
        sowingTime: "May 15 – June 30 (Kharif)", seedRate: "750 g/acre (450 g per packet)",
        amazonUrl: "https://www.amazon.in/s?k=bt+cotton+seeds+bollgard", bighaatUrl: "https://www.flipkart.com/search?q=bt+cotton+seeds+bollgard" },
    ],
  },

  jowar: {
    pesticides: [
      { name: "Malathion 50% EC", purpose: "Shoot fly & aphid control",
        dose: "1.5 ml per litre water (750 ml/acre)", timing: "7–10 days after germination for shoot fly",
        safety: "Moderate toxicity. PHI: 7 days. Do not spray near beehives.",
        amazonUrl: "https://www.amazon.in/s?k=malathion+jowar+insecticide", bighaatUrl: "https://www.flipkart.com/search?q=malathion+sorghum" },
      { name: "Mancozeb 75% WP", purpose: "Downy mildew & smut prevention",
        dose: "2.5 g per litre water (500 g/acre)", timing: "Preventive spray at seedling stage; repeat at 15-day interval",
        safety: "Low toxicity. Wear mask to avoid powder inhalation. PHI: 7 days.",
        amazonUrl: "https://www.amazon.in/s?k=mancozeb+fungicide+jowar", bighaatUrl: "https://www.flipkart.com/search?q=mancozeb+sorghum" },
    ],
    seeds: [
      { name: "CSH-16 Jowar Seeds", purpose: "ICRISAT recommended hybrid — drought tolerant, 3.5–4 t/ha yield",
        sowingTime: "June – July (Kharif) / October – November (Rabi)", seedRate: "4–5 kg/acre",
        amazonUrl: "https://www.amazon.in/s?k=CSH+16+jowar+sorghum+seeds", bighaatUrl: "https://www.flipkart.com/search?q=jowar+hybrid+seeds+CSH" },
    ],
  },

  bajra: {
    pesticides: [
      { name: "Metalaxyl 35% WS", purpose: "Downy mildew seed treatment",
        dose: "6 g per kg seed (seed treatment only)", timing: "Before sowing — treat seeds, dry in shade, then sow",
        safety: "Seed treatment only — do not spray on plants. Wash hands after treatment.",
        amazonUrl: "https://www.amazon.in/s?k=metalaxyl+bajra+fungicide", bighaatUrl: "https://www.flipkart.com/search?q=metalaxyl+seed+treatment" },
      { name: "Imidacloprid 70% WS", purpose: "Shoot fly seed treatment",
        dose: "5 g per kg seed", timing: "Treat seeds before sowing — do not water-treat after",
        safety: "Toxic to birds — sow properly, no surface scattering. Use gloves.",
        amazonUrl: "https://www.amazon.in/s?k=imidacloprid+bajra+seed+treatment", bighaatUrl: "https://www.flipkart.com/search?q=imidacloprid+seed+treatment" },
    ],
    seeds: [
      { name: "HHB-67 Bajra Seeds", purpose: "Drought tolerant — suitable for low rainfall areas (300–400mm)",
        sowingTime: "June 15 – July 15", seedRate: "1.5–2 kg/acre",
        amazonUrl: "https://www.amazon.in/s?k=HHB+67+bajra+pearl+millet+seeds", bighaatUrl: "https://www.flipkart.com/search?q=bajra+hybrid+seeds+HHB" },
    ],
  },

  maize: {
    pesticides: [
      { name: "Atrazine 50% WP", purpose: "Weed control (broadleaf + grassy)",
        dose: "1.5–2 kg/acre in 200 litres water", timing: "Pre-emergence — spray within 3 days of sowing",
        safety: "Do NOT spray after crop emergence. Avoid drift to other crops. PHI: N/A (pre-emergence).",
        amazonUrl: "https://www.amazon.in/s?k=atrazine+maize+herbicide", bighaatUrl: "https://www.flipkart.com/search?q=atrazine+herbicide+maize" },
      { name: "Carbofuran 3% CG", purpose: "Stem fly & soil pest control",
        dose: "6–8 kg/acre (soil application)", timing: "Apply at sowing time in the seed furrow",
        safety: "Highly toxic — use gloves & mask. Do not allow children/animals near treated field. PHI: 60 days.",
        amazonUrl: "https://www.amazon.in/s?k=carbofuran+maize+insecticide", bighaatUrl: "https://www.flipkart.com/search?q=carbofuran+granules" },
    ],
    seeds: [
      { name: "DKC 9144 Maize Hybrid", purpose: "High yield (35–40 q/acre) — disease tolerant",
        sowingTime: "June – July (Kharif) / January – February (Rabi)", seedRate: "7–8 kg/acre",
        amazonUrl: "https://www.amazon.in/s?k=DKC+maize+hybrid+seeds", bighaatUrl: "https://www.flipkart.com/search?q=maize+hybrid+seeds+DKC" },
    ],
  },

  soybean: {
    pesticides: [
      { name: "Trifluralin 48% EC", purpose: "Weed control",
        dose: "1 litre/acre in 200L water", timing: "Pre-emergence — before sowing or immediately after",
        safety: "Incorporate in soil after spraying. PHI: N/A.",
        amazonUrl: "https://www.amazon.in/s?k=trifluralin+soybean+herbicide", bighaatUrl: "https://www.flipkart.com/search?q=soybean+herbicide" },
      { name: "Quinalphos 25% EC", purpose: "Girdle beetle & stem fly",
        dose: "2 ml per litre water (800 ml/acre)", timing: "At 25–30 DAS when pest damage visible",
        safety: "PHI: 15 days. Do not use near fish ponds.",
        amazonUrl: "https://www.amazon.in/s?k=quinalphos+soybean", bighaatUrl: "https://www.flipkart.com/search?q=quinalphos+insecticide" },
    ],
    seeds: [
      { name: "JS-335 Soybean Seeds", purpose: "Most popular Indian variety — 12–15 q/acre",
        sowingTime: "June 20 – July 10", seedRate: "30–35 kg/acre",
        amazonUrl: "https://www.amazon.in/s?k=JS+335+soybean+seeds", bighaatUrl: "https://www.flipkart.com/search?q=soybean+seeds+JS335" },
    ],
  },

  onion: {
    pesticides: [
      { name: "Mancozeb 75% WP", purpose: "Purple blotch & downy mildew",
        dose: "2.5 g per litre water (500 g/acre)", timing: "Start at 30 days, repeat every 10–12 days",
        safety: "PHI: 7 days. Do not spray in bright sun — spray in evening.",
        amazonUrl: "https://www.amazon.in/s?k=mancozeb+onion+fungicide", bighaatUrl: "https://www.flipkart.com/search?q=mancozeb+onion" },
      { name: "Chlorpyrifos 20% EC", purpose: "Thrips control",
        dose: "2 ml per litre water (1 litre/acre)", timing: "When thrips count > 2 per plant",
        safety: "PHI: 15 days. Toxic to fish.",
        amazonUrl: "https://www.amazon.in/s?k=chlorpyrifos+onion+thrips", bighaatUrl: "https://www.flipkart.com/search?q=chlorpyrifos+onion" },
    ],
    seeds: [
      { name: "Agrifound Dark Red Onion", purpose: "NHRDF variety — 100–120 q/acre, good storage",
        sowingTime: "Rabi: Oct–Nov | Kharif: May–Jun", seedRate: "4–5 kg/acre",
        amazonUrl: "https://www.amazon.in/s?k=agrifound+dark+red+onion+seeds", bighaatUrl: "https://www.flipkart.com/search?q=onion+seeds+agrifound" },
    ],
  },

  potato: {
    pesticides: [
      { name: "Mancozeb 75% WP", purpose: "Late blight prevention",
        dose: "2.5 g per litre water (600 g/acre)", timing: "Preventive spray 30–40 days after planting; repeat every 7 days in humid weather",
        safety: "Critical: start before symptoms. PHI: 7 days.",
        amazonUrl: "https://www.amazon.in/s?k=mancozeb+potato+late+blight", bighaatUrl: "https://www.flipkart.com/search?q=mancozeb+potato+fungicide" },
      { name: "Chlorothalonil 75% WP", purpose: "Early blight & fungal diseases",
        dose: "2 g per litre water (400 g/acre)", timing: "Alternate with Mancozeb — spray on 7-day rotation",
        safety: "PHI: 7 days. Avoid breathing dust.",
        amazonUrl: "https://www.amazon.in/s?k=chlorothalonil+potato+fungicide", bighaatUrl: "https://www.flipkart.com/search?q=chlorothalonil+fungicide" },
    ],
    seeds: [
      { name: "Kufri Jyoti Potato Seeds", purpose: "Late blight tolerant — high yield 80–100 q/acre",
        sowingTime: "October – November (plains) / March – April (hills)", seedRate: "800–1000 kg/acre",
        amazonUrl: "https://www.amazon.in/s?k=kufri+jyoti+potato+seeds", bighaatUrl: "https://www.flipkart.com/search?q=potato+seeds+certified" },
    ],
  },

  tomato: {
    pesticides: [
      { name: "Mancozeb 75% WP", purpose: "Early blight, late blight & leaf spot",
        dose: "2.5 g per litre water (500 g/acre)", timing: "Preventive — start 3 weeks after transplanting",
        safety: "PHI: 5 days. Do not spray near harvest.",
        amazonUrl: "https://www.amazon.in/s?k=mancozeb+tomato+fungicide", bighaatUrl: "https://www.flipkart.com/search?q=mancozeb+tomato" },
      { name: "Imidacloprid 17.8% SL", purpose: "Whitefly & leaf curl virus vector",
        dose: "0.3 ml per litre water (60 ml/acre)", timing: "At first sign of whitefly on lower leaves",
        safety: "PHI: 3 days for tomato. Toxic to bees — avoid flowering spray.",
        amazonUrl: "https://www.amazon.in/s?k=imidacloprid+tomato+insecticide", bighaatUrl: "https://www.flipkart.com/search?q=imidacloprid+tomato" },
    ],
    seeds: [
      { name: "Pusa Ruby Tomato Seeds", purpose: "Determinate type — good for processing & fresh market",
        sowingTime: "Jun–Jul (Kharif) / Nov–Dec (Rabi)", seedRate: "200–250 g/acre",
        amazonUrl: "https://www.amazon.in/s?k=pusa+ruby+tomato+seeds", bighaatUrl: "https://www.flipkart.com/search?q=pusa+ruby+tomato+seeds" },
    ],
  },

  mushroom: {
    pesticides: [
      { name: "Carbendazim 50% WP", purpose: "Green mould (Trichoderma) & wet rot",
        dose: "1 g per litre water for bed dip", timing: "Mix in substrate water before filling bags",
        safety: "Low toxicity. Use in ventilated space. PHI: 7 days before harvest.",
        amazonUrl: "https://www.amazon.in/s?k=carbendazim+fungicide+mushroom", bighaatUrl: "https://www.flipkart.com/search?q=carbendazim+fungicide" },
      { name: "Formaldehyde 37% Solution", purpose: "Room & substrate sterilization",
        dose: "2% solution (20 ml per litre water) for room spray", timing: "24–48 hours before filling growing room; ventilate 24 hrs before use",
        safety: "CAUTION: toxic vapour — use respirator, goggles, gloves. Never enter room immediately after spraying.",
        amazonUrl: "https://www.amazon.in/s?k=formaldehyde+mushroom+sterilization", bighaatUrl: "https://www.flipkart.com/search?q=mushroom+room+sterilization" },
    ],
    seeds: [
      { name: "Oyster Mushroom Spawn (1 kg)", purpose: "Easy to grow — ready in 25–30 days, yield 500–600 g/kg substrate",
        sowingTime: "Year-round (best: Oct–Mar when temp is 15–25°C)", seedRate: "200–250 g spawn per kg substrate",
        amazonUrl: "https://www.amazon.in/s?k=oyster+mushroom+spawn+seeds", bighaatUrl: "https://www.flipkart.com/search?q=oyster+mushroom+spawn" },
      { name: "Button Mushroom Spawn (1 kg)", purpose: "Most popular — ₹120–150/kg market price",
        sowingTime: "November – February (temp 14–18°C required)", seedRate: "500 g per sqm of bed",
        amazonUrl: "https://www.amazon.in/s?k=button+mushroom+spawn+seeds", bighaatUrl: "https://www.flipkart.com/search?q=button+mushroom+spawn" },
      { name: "Mushroom Growing Kit", purpose: "Complete beginner kit — substrate + spawn + bag + guide",
        sowingTime: "Any time of year", seedRate: "1 kit = 1 growing bag",
        amazonUrl: "https://www.amazon.in/s?k=mushroom+growing+kit+india", bighaatUrl: "https://www.flipkart.com/search?q=mushroom+growing+kit" },
    ],
  },

  strawberry: {
    pesticides: [
      { name: "Mancozeb 75% WP", purpose: "Leaf spot, fruit rot & grey mould",
        dose: "2 g per litre water (400 g/acre)", timing: "At flowering and fruit formation stage; every 10 days",
        safety: "PHI: 3 days (short — be careful). Avoid spraying on ripe fruits.",
        amazonUrl: "https://www.amazon.in/s?k=mancozeb+strawberry+fungicide", bighaatUrl: "https://www.flipkart.com/search?q=mancozeb+strawberry" },
      { name: "Imidacloprid 17.8% SL", purpose: "Aphids & thrips",
        dose: "0.3 ml per litre water", timing: "At runner establishment stage when pest first appears",
        safety: "PHI: 3 days. Toxic to bees — spray at dusk only.",
        amazonUrl: "https://www.amazon.in/s?k=imidacloprid+strawberry", bighaatUrl: "https://www.flipkart.com/search?q=imidacloprid+strawberry" },
    ],
    seeds: [
      { name: "Winter Dawn Strawberry Runners", purpose: "Best variety for Indian climate — sweet, firm fruit",
        sowingTime: "September – October (hills) / November (plains)", seedRate: "5,000–6,000 runners/acre",
        amazonUrl: "https://www.amazon.in/s?k=strawberry+runners+plants+india", bighaatUrl: "https://www.flipkart.com/search?q=strawberry+plants+runners" },
    ],
  },

  groundnut: {
    pesticides: [
      { name: "Chlorpyrifos 20% EC", purpose: "White grub & soil insects",
        dose: "2 ml per litre water (soil drench at sowing)", timing: "At sowing time — drench around seed rows",
        safety: "Highly toxic. Do not contaminate groundwater. PHI: 30 days.",
        amazonUrl: "https://www.amazon.in/s?k=chlorpyrifos+groundnut+insecticide", bighaatUrl: "https://www.flipkart.com/search?q=chlorpyrifos+groundnut" },
      { name: "Mancozeb 75% WP", purpose: "Tikka disease (leaf spot)",
        dose: "2.5 g per litre water (500 g/acre)", timing: "At 30–35 DAS; repeat every 10–12 days till 60 DAS",
        safety: "PHI: 7 days. Low toxicity.",
        amazonUrl: "https://www.amazon.in/s?k=mancozeb+groundnut+fungicide", bighaatUrl: "https://www.flipkart.com/search?q=mancozeb+groundnut" },
    ],
    seeds: [
      { name: "GG-20 Groundnut Seeds", purpose: "Gujarat recommended — 12–15 q/acre, drought tolerant",
        sowingTime: "June 15 – July 15", seedRate: "50–55 kg/acre (pods)",
        amazonUrl: "https://www.amazon.in/s?k=GG20+groundnut+seeds", bighaatUrl: "https://www.flipkart.com/search?q=groundnut+seeds+GG20" },
    ],
  },

  mustard: {
    pesticides: [
      { name: "Quinalphos 25% EC", purpose: "Painted bug & aphid control",
        dose: "2 ml per litre water (800 ml/acre)", timing: "At rosette stage (30–35 DAS) when aphid colonies form",
        safety: "PHI: 15 days. Do not spray during flowering — toxic to bees.",
        amazonUrl: "https://www.amazon.in/s?k=quinalphos+mustard+insecticide", bighaatUrl: "https://www.flipkart.com/search?q=quinalphos+mustard" },
      { name: "Mancozeb 75% WP", purpose: "Alternaria blight & white rust",
        dose: "2.5 g per litre water (500 g/acre)", timing: "At flower bud stage; repeat at 10-day interval",
        safety: "PHI: 7 days.",
        amazonUrl: "https://www.amazon.in/s?k=mancozeb+mustard+fungicide", bighaatUrl: "https://www.flipkart.com/search?q=mancozeb+mustard" },
    ],
    seeds: [
      { name: "Pusa Bold Mustard Seeds", purpose: "High oil content (42%), popular in north India",
        sowingTime: "October – November", seedRate: "1.5–2 kg/acre",
        amazonUrl: "https://www.amazon.in/s?k=pusa+bold+mustard+seeds", bighaatUrl: "https://www.flipkart.com/search?q=mustard+seeds+pusa+bold" },
    ],
  },
};

// ── Machinery database ─────────────────────────────────────────

function getMachineryForCrop(crop: string, temp: number): MachineryItem[] {
  const common: MachineryItem[] = [
    { name: "Knapsack Sprayer (16L)", purpose: "Pesticide & fertilizer spraying", season: "All season", priceRange: "₹800 – ₹1,500",
      amazonUrl: "https://www.amazon.in/s?k=knapsack+sprayer+agriculture+16+litre", flipkartUrl: "https://www.flipkart.com/search?q=knapsack+sprayer" },
    { name: "Battery Power Sprayer", purpose: "Easy motorised spraying — 10x faster than manual", season: "All season", priceRange: "₹2,000 – ₹4,000",
      amazonUrl: "https://www.amazon.in/s?k=battery+sprayer+agriculture+india", flipkartUrl: "https://www.flipkart.com/search?q=battery+power+sprayer+agriculture" },
    { name: "Drip Irrigation Kit", purpose: "Water saving — reduces water use by 40–50%", season: "All season", priceRange: "₹4,000 – ₹12,000/acre",
      amazonUrl: "https://www.amazon.in/s?k=drip+irrigation+kit+agriculture", flipkartUrl: "https://www.flipkart.com/search?q=drip+irrigation+kit+farm" },
  ];

  const cropMachinery: Record<string, MachineryItem[]> = {
    wheat: [
      { name: "Seed Drill Machine", purpose: "Uniform wheat sowing at correct depth & spacing", season: "Sowing (Oct–Nov)", priceRange: "₹18,000 – ₹45,000 (or rent ₹500/acre)",
        amazonUrl: "https://www.amazon.in/s?k=seed+drill+machine+wheat", flipkartUrl: "https://www.flipkart.com/search?q=seed+drill+machine" },
      { name: "Mini Combine Harvester", purpose: "Harvest & thresh wheat in one pass", season: "Harvest (Mar–Apr)", priceRange: "₹1.5L – ₹3.5L (or rent ₹2,000/acre)",
        amazonUrl: "https://www.amazon.in/s?k=mini+combine+harvester+wheat", flipkartUrl: "https://www.flipkart.com/search?q=combine+harvester+wheat" },
      { name: "Rotavator / Rotary Tiller", purpose: "Field prep + stubble incorporation", season: "Post-harvest", priceRange: "₹35,000 – ₹80,000",
        amazonUrl: "https://www.amazon.in/s?k=rotavator+agriculture+tractor", flipkartUrl: "https://www.flipkart.com/search?q=rotavator+agriculture" },
    ],
    rice: [
      { name: "Rice Transplanter (4-row)", purpose: "Paddy transplanting at uniform spacing", season: "Kharif sowing (Jun–Jul)", priceRange: "₹80,000 – ₹1.5L (or rent ₹1,500/acre)",
        amazonUrl: "https://www.amazon.in/s?k=rice+paddy+transplanter", flipkartUrl: "https://www.flipkart.com/search?q=rice+transplanter" },
      { name: "Paddy Thresher", purpose: "Rice threshing after harvest", season: "Harvest (Oct–Nov)", priceRange: "₹15,000 – ₹40,000",
        amazonUrl: "https://www.amazon.in/s?k=paddy+thresher+machine", flipkartUrl: "https://www.flipkart.com/search?q=paddy+thresher" },
    ],
    cotton: [
      { name: "Cotton Seed Dibbler", purpose: "Precise cotton sowing at 90×45 cm spacing", season: "Kharif (May–Jun)", priceRange: "₹600 – ₹1,200",
        amazonUrl: "https://www.amazon.in/s?k=cotton+seed+dibbler", flipkartUrl: "https://www.flipkart.com/search?q=seed+dibbler+cotton" },
      { name: "Inter-row Cultivator", purpose: "Weed control + soil aeration between rows", season: "30–60 DAS", priceRange: "₹3,000 – ₹8,000",
        amazonUrl: "https://www.amazon.in/s?k=inter+row+cultivator+cotton", flipkartUrl: "https://www.flipkart.com/search?q=cultivator+weeding" },
    ],
    mushroom: [
      { name: "Mushroom Growing Bags (PP, 100 pcs)", purpose: "Substrate packing for oyster/button mushroom", season: "All year", priceRange: "₹300 – ₹600 (100 pcs)",
        amazonUrl: "https://www.amazon.in/s?k=mushroom+growing+bags+polypropylene", flipkartUrl: "https://www.flipkart.com/search?q=mushroom+growing+bags" },
      { name: "Pressure Cooker (22L) / Autoclave", purpose: "Substrate sterilization — kills contaminants", season: "Pre-growing", priceRange: "₹2,000 – ₹6,000",
        amazonUrl: "https://www.amazon.in/s?k=pressure+cooker+autoclave+mushroom", flipkartUrl: "https://www.flipkart.com/search?q=large+pressure+cooker+autoclave" },
      { name: "Ultrasonic Fogger + Humidity Controller", purpose: "Maintain 70–90% humidity for mushroom growth", season: "Growing season", priceRange: "₹1,500 – ₹3,500",
        amazonUrl: "https://www.amazon.in/s?k=ultrasonic+fogger+humidity+controller+mushroom", flipkartUrl: "https://www.flipkart.com/search?q=ultrasonic+fogger+humidity+controller" },
      { name: "Digital Thermometer + Hygrometer", purpose: "Monitor temp (15–25°C) & humidity daily", season: "All year", priceRange: "₹200 – ₹600",
        amazonUrl: "https://www.amazon.in/s?k=digital+thermometer+hygrometer+indoor", flipkartUrl: "https://www.flipkart.com/search?q=digital+thermometer+hygrometer" },
    ],
  };

  if (crop === "mushroom") return cropMachinery.mushroom;
  const specific = cropMachinery[crop] || [];
  return [...specific, ...common].slice(0, 5);
}

// ── Nearby shops via Google Maps ────────────────────────────────

function fetchNearbyShops(lat: number, lon: number): NearbyShop[] {
  const base = `https://www.google.com/maps/search/`;
  return [
    { name: "Agriculture Input Shops Near You", type: "Pesticide, Seed & Fertilizer shops", distanceKm: 0,
      address: "Find all agri input shops near your current location",
      mapsUrl: `${base}agriculture+input+shop/@${lat},${lon},13z` },
    { name: "Fertilizer & Pesticide Dealers", type: "Fertilizer, Pesticide, Weedicide", distanceKm: 0,
      address: "Find fertilizer & pesticide dealers near you",
      mapsUrl: `${base}fertilizer+pesticide+dealer/@${lat},${lon},13z` },
    { name: "Krishi Kendra / Krishi Seva Kendra", type: "Government & co-op farm supply", distanceKm: 0,
      address: "Find nearest Krishi Kendra centre",
      mapsUrl: `${base}krishi+kendra+krishi+seva+kendra/@${lat},${lon},13z` },
    { name: "Tractor & Farm Equipment Dealers", type: "Machinery, Sprayer, Tools", distanceKm: 0,
      address: "Find tractor dealers and farm equipment shops",
      mapsUrl: `${base}tractor+farm+equipment+dealer/@${lat},${lon},13z` },
  ];
}

function getDefaultShops(): NearbyShop[] {
  return [
    { name: "BigHaat — Online Agri Store", type: "Pesticides, Seeds, Fertilizers delivered", distanceKm: 0, address: "Enable location for nearby shop results", mapsUrl: "https://www.bighaat.com" },
    { name: "Agribegri — Farm Inputs Online", type: "Seeds, Pesticides, Tools", distanceKm: 0, address: "Pan-India delivery", mapsUrl: "https://www.agribegri.com" },
    { name: "IFFCO Store Locator", type: "Fertilizers & nutrients", distanceKm: 0, address: "Find nearest IFFCO outlet", mapsUrl: "https://www.iffco.in/en/iffco-store-locator" },
  ];
}

// ── Main data fetch ─────────────────────────────────────────────

export async function getAgriShopData(
  crop: string,
  lat?: number,
  lon?: number,
  weather?: { temperature: number; humidity: number; condition: string }
): Promise<AgriShopData> {
  const c = crop.toLowerCase().trim();

  // Crop alias map — maps variants to CROP_PRODUCTS keys
  const CROP_ALIASES: Record<string, string> = {
    "paddy": "rice", "chawal": "rice", "gehun": "wheat", "gehu": "wheat",
    "makka": "maize", "corn": "maize", "kapas": "cotton",
    "ganna": "sugarcane", "sarso": "mustard", "sarson": "mustard",
    "pyaz": "onion", "aloo": "potato", "tamatar": "tomato",
    "soya": "soybean", "soyabean": "soybean", "moongfali": "groundnut",
    "chickpea": "chickpea", "chana": "chickpea",
    "bajra": "bajra", "jowar": "jowar", "sorghum": "jowar",
  };

  const resolvedCrop = CROP_ALIASES[c] || c;

  // Generic pesticide set for unknown crops — better than wrong wheat seeds
  const GENERIC_PRODUCTS = {
    pesticides: [
      { name: "Chlorpyrifos 20% EC", purpose: "Broad-spectrum insect control",
        dose: "2 ml per litre water", timing: "At first sign of infestation",
        safety: "Wear gloves & mask. Do not spray near water bodies.",
        amazonUrl: `https://www.amazon.in/s?k=chlorpyrifos+insecticide+${resolvedCrop}`,
        bighaatUrl: `https://www.flipkart.com/search?q=chlorpyrifos+insecticide` },
      { name: "Mancozeb 75% WP", purpose: "Fungal disease prevention",
        dose: "2.5 g per litre water", timing: "Preventive spray every 10–14 days",
        safety: "Avoid inhalation. Keep away from food. PHI: 7 days.",
        amazonUrl: `https://www.amazon.in/s?k=mancozeb+fungicide+${resolvedCrop}`,
        bighaatUrl: `https://www.flipkart.com/search?q=mancozeb+fungicide` },
    ],
    seeds: [
      { name: `Certified ${crop.charAt(0).toUpperCase() + crop.slice(1)} Seeds`,
        purpose: "High-yield certified variety — check with local KVK for best variety in your region",
        sowingTime: "As per local season", seedRate: "As per crop variety",
        amazonUrl: `https://www.amazon.in/s?k=${resolvedCrop}+seeds+certified`,
        bighaatUrl: `https://www.flipkart.com/search?q=${resolvedCrop}+seeds` },
    ],
  };

  const cropData = CROP_PRODUCTS[resolvedCrop] || GENERIC_PRODUCTS;
  const machinery = getMachineryForCrop(c, weather?.temperature ?? 28);
  const nearbyShops = (lat && lon) ? fetchNearbyShops(lat, lon) : getDefaultShops();
  return { crop, pesticides: cropData.pesticides, seeds: cropData.seeds, machinery, nearbyShops, weather };
}

// ── UI Component ────────────────────────────────────────────────

type Tab = "pesticides" | "machinery" | "shops";

export const AgriShopCard: React.FC<{ data: AgriShopData }> = ({ data }) => {
  const [tab, setTab] = useState<Tab>("pesticides");
  const [expanded, setExpanded] = useState<number | null>(null);

  const tabs = [
    { id: "pesticides" as Tab, label: "Pesticides & Seeds", icon: "🌿" },
    { id: "machinery" as Tab, label: "Machinery", icon: "🚜" },
    { id: "shops" as Tab, label: "Nearby Shops", icon: "🏪" },
  ];

  return (
    <div className="w-full max-w-xl rounded-2xl overflow-hidden border border-slate-200 shadow-md mt-3">

      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-700 to-green-600 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-100">Farm Inputs & Shops</p>
        <p className="text-white font-bold text-lg capitalize">{data.crop} Recommendations</p>
        {data.weather && (
          <p className="text-emerald-100 text-xs mt-0.5">
            {data.weather.condition} · {data.weather.temperature}°C · {data.weather.humidity}% humidity
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-white">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-2 text-xs font-semibold transition-colors ${tab === t.id ? "border-b-2 border-emerald-600 text-emerald-700 bg-emerald-50" : "text-slate-500 hover:text-slate-700"}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-white p-4 space-y-3">

        {/* ── Pesticides & Seeds ── */}
        {tab === "pesticides" && (
          <>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Recommended Pesticides</p>
            {data.pesticides.map((item, i) => (
              <div key={i} className="rounded-xl border border-slate-100 bg-slate-50 overflow-hidden">
                {/* Main row */}
                <div className="p-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-semibold text-sm text-slate-800">{item.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">🎯 {item.purpose}</p>
                    </div>
                    <button onClick={() => setExpanded(expanded === i ? null : i)}
                      className="ml-2 text-xs bg-emerald-100 text-emerald-700 rounded-full px-2.5 py-1 font-semibold flex-shrink-0">
                      {expanded === i ? "▲ Less" : "▼ How to use"}
                    </button>
                  </div>

                  {/* Expanded usage guide */}
                  {expanded === i && (
                    <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">
                      <div className="flex items-start gap-2">
                        <span className="text-base">⚗️</span>
                        <div>
                          <p className="text-xs font-bold text-slate-600">Dose / Quantity</p>
                          <p className="text-xs text-slate-700 mt-0.5">{item.dose}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-base">📅</span>
                        <div>
                          <p className="text-xs font-bold text-slate-600">When to Apply</p>
                          <p className="text-xs text-slate-700 mt-0.5">{item.timing}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-base">⚠️</span>
                        <div>
                          <p className="text-xs font-bold text-red-600">Safety & PHI</p>
                          <p className="text-xs text-slate-700 mt-0.5">{item.safety}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 mt-2">
                    <a href={item.amazonUrl} target="_blank" rel="noopener noreferrer"
                      className="flex-1 text-center text-xs bg-orange-500 hover:bg-orange-600 text-white rounded-lg py-1.5 font-semibold transition">
                      🛒 Amazon
                    </a>
                    <a href={item.bighaatUrl} target="_blank" rel="noopener noreferrer"
                      className="flex-1 text-center text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-1.5 font-semibold transition">
                      🛍️ Flipkart
                    </a>
                  </div>
                </div>
              </div>
            ))}

            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mt-4">Recommended Seeds</p>
            {data.seeds.map((item, i) => (
              <div key={i} className="rounded-xl border border-emerald-100 bg-emerald-50 overflow-hidden">
                <div className="p-3">
                  <p className="font-semibold text-sm text-slate-800">{item.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">✅ {item.purpose}</p>
                  <div className="flex gap-3 mt-2">
                    <div className="flex items-center gap-1 text-xs text-emerald-700">
                      <span>📅</span><span>{(item as any).sowingTime}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-blue-700">
                      <span>🌱</span><span>{(item as any).seedRate}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <a href={item.amazonUrl} target="_blank" rel="noopener noreferrer"
                      className="flex-1 text-center text-xs bg-orange-500 hover:bg-orange-600 text-white rounded-lg py-1.5 font-semibold transition">
                      🛒 Amazon
                    </a>
                    <a href={item.bighaatUrl} target="_blank" rel="noopener noreferrer"
                      className="flex-1 text-center text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-1.5 font-semibold transition">
                      🛍️ Flipkart
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        {/* ── Machinery ── */}
        {tab === "machinery" && (
          <>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              Machinery for {data.crop}
            </p>
            {data.machinery.map((item, i) => (
              <div key={i} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-slate-800">{item.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">🎯 {item.purpose}</p>
                    <div className="flex gap-2 mt-1.5 flex-wrap">
                      <span className="text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5">📅 {item.season}</span>
                      <span className="text-xs bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">💰 {item.priceRange}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  <a href={item.amazonUrl} target="_blank" rel="noopener noreferrer"
                    className="flex-1 text-center text-xs bg-orange-500 hover:bg-orange-600 text-white rounded-lg py-1.5 font-semibold transition">
                    🛒 Amazon
                  </a>
                  <a href={item.flipkartUrl} target="_blank" rel="noopener noreferrer"
                    className="flex-1 text-center text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-1.5 font-semibold transition">
                    🛍️ Flipkart
                  </a>
                </div>
              </div>
            ))}
          </>
        )}

        {/* ── Nearby Shops ── */}
        {tab === "shops" && (
          <>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Agri Shops Near You</p>
            {data.nearbyShops.map((shop, i) => (
              <div key={i} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <p className="font-semibold text-sm text-slate-800">{shop.name}</p>
                <p className="text-xs text-emerald-700 mt-0.5">🏪 {shop.type}</p>
                <p className="text-xs text-slate-400 mt-0.5">📍 {shop.address}</p>
                <a href={shop.mapsUrl} target="_blank" rel="noopener noreferrer"
                  className="mt-2 block text-center text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg py-1.5 font-semibold transition">
                  🗺️ Search on Google Maps
                </a>
              </div>
            ))}

            {/* Online ordering */}
            <div className="rounded-xl border border-orange-100 bg-orange-50 p-3 mt-2">
              <p className="text-xs font-semibold text-orange-700 mb-2">🛒 Order Online — Delivered to Farm</p>
              <div className="grid grid-cols-3 gap-2">
                <a href="https://www.flipkart.com/search?q=agriculture+farming" target="_blank" rel="noopener noreferrer"
                  className="text-center text-xs bg-blue-600 text-white rounded-lg py-1.5 font-semibold">🛍️ Flipkart</a>
                <a href="https://www.agribegri.com" target="_blank" rel="noopener noreferrer"
                  className="text-center text-xs bg-emerald-600 text-white rounded-lg py-1.5 font-semibold">🌱 Agribegri</a>
                <a href={`https://www.amazon.in/s?k=${data.crop}+farming+pesticide+india`} target="_blank" rel="noopener noreferrer"
                  className="text-center text-xs bg-orange-500 text-white rounded-lg py-1.5 font-semibold">🛒 Amazon</a>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
