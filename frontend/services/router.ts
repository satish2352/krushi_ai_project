import {
  CropPredictionInput, FertilizerDashboardData, MandiPrice,
  PestPredictionInput, RoutingContext, SoilGapInput,
  WeatherSummary, YieldDashboardData, AgriShopData,
} from "../types";
import {
  containsCropKeywords, containsFertilizerKeywords, containsMarketKeywords,
  containsPestKeywords, containsWeatherKeywords, containsYieldKeywords,
} from "../utils/keywordDetection";
import { predictCrop, predictPest, predictYield, getSoilGapAnalysis } from "./api";
import { getWeather } from "./weather";
import { getNearbyMandiPrices } from "./market";
import { getAgriShopData } from "../components/AgriShopCard";
import { generateConversationalResponse } from "./llm";

export interface RoutedResult {
  reply: string;
  cropPrediction?: unknown;
  pestPrediction?: unknown;
  yieldPrediction?: unknown;
  yieldDashboard?: YieldDashboardData;
  fertilizerDashboard?: FertilizerDashboardData;
  weather?: WeatherSummary | null;
  mandiPrices?: MandiPrice[] | null;
  cropName?: string;
  agriShopData?: AgriShopData;
}

// ── Crop lists ─────────────────────────────────────────────────────────────

const TRADEABLE_CROPS = [
  "rice","paddy","wheat","gehu","maize","makka","cotton","kapas",
  "sugarcane","ganna","onion","pyaz","tomato","tamatar","potato","aloo",
  "soybean","soya","groundnut","bajra","jowar","tur","arhar","chana",
  "moong","urad","mustard","sunflower","ginger","turmeric","garlic","chilli","barley",
];

const NON_STANDARD_CROPS = [
  "mushroom","strawberry","rose","marigold","jasmine","guava","pineapple",
  "litchi","avocado","kiwi","brinjal","cabbage","cauliflower","spinach",
  "carrot","radish","cucumber","pumpkin","capsicum","peas","beans","beetroot",
  "banana","mango","grapes","orange","papaya","coconut","pomegranate",
  "apple","watermelon","muskmelon","lemon","lavender","coffee","tea",
];

// City coordinates — fully inline, no external import needed
const CITY_COORDS: Record<string, { lat: number; lon: number }> = {
  "pune": { lat: 18.52, lon: 73.85 }, "mumbai": { lat: 19.07, lon: 72.87 },
  "delhi": { lat: 28.61, lon: 77.23 }, "bangalore": { lat: 12.97, lon: 77.59 },
  "bengaluru": { lat: 12.97, lon: 77.59 }, "hyderabad": { lat: 17.38, lon: 78.48 },
  "chennai": { lat: 13.08, lon: 80.27 }, "kolkata": { lat: 22.57, lon: 88.36 },
  "ahmedabad": { lat: 23.03, lon: 72.58 }, "surat": { lat: 21.17, lon: 72.83 },
  "jaipur": { lat: 26.91, lon: 75.79 }, "lucknow": { lat: 26.85, lon: 80.95 },
  "nagpur": { lat: 21.14, lon: 79.08 }, "nashik": { lat: 19.99, lon: 73.79 },
  "bharuch": { lat: 21.70, lon: 72.98 }, "indore": { lat: 22.71, lon: 75.86 },
  "bhopal": { lat: 23.25, lon: 77.40 }, "rajkot": { lat: 22.30, lon: 70.80 },
  "amritsar": { lat: 31.63, lon: 74.87 }, "chandigarh": { lat: 30.73, lon: 76.78 },
  "ludhiana": { lat: 30.90, lon: 75.85 }, "coimbatore": { lat: 11.01, lon: 76.97 },
  "kochi": { lat: 9.93, lon: 76.26 }, "patna": { lat: 25.59, lon: 85.13 },
  "vadodara": { lat: 22.30, lon: 73.19 }, "solapur": { lat: 17.68, lon: 75.90 },
  "kolhapur": { lat: 16.70, lon: 74.24 }, "aurangabad": { lat: 19.87, lon: 75.34 },
};

// ── Helpers ────────────────────────────────────────────────────────────────

function extractCropName(message: string): string | undefined {
  const t = message.toLowerCase();
  // Non-standard first (more specific)
  const nonStd = NON_STANDARD_CROPS.find(c => new RegExp(`\\b${c}\\b`).test(t));
  if (nonStd) return nonStd;
  // Standard crops — word boundary prevents "rice" matching inside "price"
  return TRADEABLE_CROPS.find(c => new RegExp(`\\b${c}\\b`).test(t));
}

function extractCity(message: string): string | null {
  const t = message.toLowerCase();
  return Object.keys(CITY_COORDS).find(c => new RegExp(`\\b${c}\\b`).test(t)) ?? null;
}

// Is user telling us what crop they want (rather than asking for recommendation)?
function isUserPickingCrop(message: string, crop: string | undefined): boolean {
  if (!crop) return false;
  // Non-standard crops = user is always specifying (no ML model for mushroom)
  if (NON_STANDARD_CROPS.includes(crop)) return true;
  // Standard crop — only override if explicit grow intent
  return /i want to grow|i will grow|i want to plant|planning to grow|want to cultivate|mujhe.*ugana|main.*ugaunga/i.test(message);
}

function parseYieldParams(msg: string) {
  // Match: "2 acre", "2 bigha", "2 hectare" — also "agar 2 acre jameen hai"
  const farmSizeMatch = msg.match(/(\d+(?:\.\d+)?)\s*(?:acre|acres|bigha|hectare)/i);
  // Match input cost: "cost 8000", "lagat 8000", "kharcha 5000", or "8000 per acre"
  const costMatch = msg.match(/(?:cost|input|lagat|kharcha)[^\d]*(\d{4,6})/i) || msg.match(/(\d{4,6})\s*(?:per acre|\/acre)/i);
  // Match market price: "price 2500", "bhav 3000", "₹2500/quintal"
  const priceMatch = msg.match(/(?:price|bhav|rate|daam)[^\d]*(\d{3,5})/i) || msg.match(/[₹rs]\s*(\d{3,5})\s*(?:per|\/)\s*(?:quintal|qt)/i);
  return {
    farmSize:    farmSizeMatch ? parseFloat(farmSizeMatch[1]) : undefined,
    inputCost:   costMatch     ? parseInt(costMatch[1])       : undefined,
    marketPrice: priceMatch    ? parseInt(priceMatch[1])      : undefined,
  };
}

// ── Main handler ───────────────────────────────────────────────────────────

export async function handleUserMessage(ctx: RoutingContext): Promise<RoutedResult> {
  const { message, location, uploadedSoilData, conversationHistory } = ctx;

  // ── Intent detection ──
  const wantsCrop       = containsCropKeywords(message) || !!uploadedSoilData;
  const wantsPest       = containsPestKeywords(message);
  const wantsYield      = containsYieldKeywords(message);
  const wantsWeather    = containsWeatherKeywords(message);
  const wantsMarket     = containsMarketKeywords(message);
  // Universal rule: fertilizer card ONLY when user explicitly asks
  // Never auto-trigger from soil upload alone — would spam every message
  const wantsFertilizer = containsFertilizerKeywords(message);
  // Shop intent — broad: buy/share/show + product keywords
  const wantsShop = /buy|shop|store|kharid|dukan/.test(message.toLowerCase()) ||
    /\b(pesticide|spray|machine|equipment|tractor|sprayer|spawn|supply|yantra)\b/i.test(message) ||
    /share\s+\w+\s+(pesticide|seed|machine|spawn|machinery)/i.test(message) ||
    /show\s+(me\s+)?(pesticide|seed|machine|spawn)/i.test(message);

  // ── Crop detection ──
  const userCrop  = extractCropName(message);
  const userPicks = isUserPickingCrop(message, userCrop);

  // ── Detect city-region question ──────────────────────────────────────────
  // "pune madhe konte crops" / "delhi mein kya ugta hai" / "crops in bangalore"
  // = user asking about a REGION, not about their personal soil.
  // When this is true, do NOT pass uploaded soil to ML — use region defaults.
  const mentionedCityEarly = extractCity(message);
  const isRegionCropQuestion =
    !!mentionedCityEarly &&
    wantsCrop &&
    !userPicks &&
    // Must actually be asking about that region (not just mentioning city for weather/mandi)
    /\b(crops?|ugta|ugana|kya ugta|grow|konte|konsa|which crop|suggest|recommend|fasal|kheti)\b/i.test(message);

  // When asking about a region, use that city's climate defaults, not uploaded soil
  // The uploaded soil is from the farmer's actual farm (Bharuch) — not from Pune
  const soilForML = isRegionCropQuestion ? undefined : uploadedSoilData;

  // Run ML crop prediction only when user didn't specify a crop
  const [cropPrediction, pestPrediction] = await Promise.all([
    (wantsCrop && !userPicks) ? safePredictCrop(message, soilForML, mentionedCityEarly) : Promise.resolve(undefined),
    wantsPest ? safePredictPest(message) : Promise.resolve(undefined),
  ]);

  // Final crop — user's explicit crop wins over ML
  let cropName = userCrop;
  if (!cropName && cropPrediction && typeof cropPrediction === "object") {
    const p = cropPrediction as any;
    cropName = p.recommendations?.[0]?.crop || p.recommended_crop || p.crop || undefined;
  }

  // ── Cross-turn crop memory ──────────────────────────────────────────────
  // If this turn has no crop (e.g. "can you share near mandi" after "which crop should i grow?")
  // scan the last few assistant messages in conversationHistory to recover the crop context.
  // This ensures mandi/weather/shop follow-up questions use the crop from the previous turn.
  if (!cropName && conversationHistory?.length) {
    const recentAssistant = [...conversationHistory]
      .reverse()
      .filter(m => m.role === "assistant")
      .slice(0, 3); // only look at last 3 assistant messages
    for (const m of recentAssistant) {
      const found = extractCropName(m.content);
      if (found) { cropName = found; break; }
    }
  }

  // ── Location ──
  const mentionedCity = mentionedCityEarly;
  const cityCoords    = mentionedCity ? CITY_COORDS[mentionedCity] : null;
  const effectiveLat  = cityCoords?.lat ?? location?.lat;
  const effectiveLon  = cityCoords?.lon ?? location?.lon;

  // ── Weather ──
  // Pure shop query = user just asking for products, not farm context
  const isPureShop = wantsShop && !wantsCrop && !wantsWeather && !wantsYield &&
    !uploadedSoilData && !mentionedCity && userPicks;
  const shouldWeather = !isPureShop && (wantsWeather || wantsCrop || wantsYield || !!mentionedCity);

  const weatherPromise = (shouldWeather && effectiveLat && effectiveLon)
    ? safeGetWeather(effectiveLat, effectiveLon)
    : Promise.resolve<WeatherSummary | null>(null);

  // ── Mandi ──
  // Universal rules: show mandi for market queries, crop queries, AND yield queries
  // Hide for pest-only and shop-only (farmer wants to buy not sell)
  const isTradeable  = cropName ? TRADEABLE_CROPS.some(c => cropName!.toLowerCase().includes(c)) : false;
  const isPestOnly   = wantsPest  && !wantsMarket && !wantsCrop && !wantsYield;
  const isShopOnly   = wantsShop  && !wantsMarket && !wantsCrop && !wantsYield;
  const shouldShowMandi = effectiveLat && effectiveLon &&
    (wantsMarket || (isTradeable && !!cropName && !isPestOnly && !isShopOnly));
  const mandiPromise = shouldShowMandi
    ? safeGetMandiPrices(cropName || "wheat", effectiveLat, effectiveLon)
    : Promise.resolve<MandiPrice[] | null>(null);

  // ── Await weather BEFORE yield block so we have real rainfall/temp ──
  const [weather, mandiPrices] = await Promise.all([weatherPromise, mandiPromise]);

  // ── Yield ──
  let yieldPrediction: unknown;
  let yieldDashboard: YieldDashboardData | undefined;
  if (wantsYield && cropName) {
    const { farmSize, inputCost, marketPrice } = parseYieldParams(message);
    try {
      // Universal data priority: soil report > live weather > sensible defaults
      // Never use hardcoded 600mm/26°C when real data is available
      const actualRainfall    = uploadedSoilData?.rainfall
                              ?? (weather as any)?.rainfall
                              ?? 600;
      const actualTemperature = uploadedSoilData?.temperature
                              ?? (weather as any)?.temperature
                              ?? 26;
      const actualHumidity    = uploadedSoilData?.humidity
                              ?? (weather as any)?.humidity
                              ?? 65;
      const weatherCondition  = actualRainfall < 300 ? "Sunny"
                              : actualRainfall < 600 ? "Cloudy" : "Rainy";

      const yieldInput = {
        rainfall_mm: actualRainfall,
        temperature_celsius: actualTemperature,
        days_to_harvest: 120,
        fertilizer_used: 1, irrigation_used: 1, region: "default-region",
        soil_type: "loamy", weather_condition: weatherCondition,
        crop: cropName,
        farm_size_acres: farmSize ?? 1.0,
        ...(marketPrice != null && { market_price_per_quintal: marketPrice }),
        ...(inputCost   != null && { input_cost_per_acre: inputCost }),
      };
      // console.log("[Yield] Calling predictYield with:", JSON.stringify(yieldInput));
      const raw = await predictYield(yieldInput as any) as any;
      // console.log("[Yield] Raw response:", JSON.stringify(raw));
      yieldPrediction = raw;
      // Accept various response shapes from the backend
      if (raw?.yield_estimation && raw?.profit_analysis) {
        yieldDashboard = { ...raw, crop: cropName, farm_size_acres: farmSize ?? raw.yield_estimation?.farm_size_acres ?? 1 };
        // console.log("[Yield] Dashboard created:", cropName, farmSize);
      } else {
        console.warn("[Yield] Unexpected response shape — dashboard not created. Keys:", Object.keys(raw ?? {}));
      }
    } catch (e) { console.error("[Yield] FAILED:", e); }
  }

  // ── Fertilizer ──
  let fertilizerDashboard: FertilizerDashboardData | undefined;
  if (wantsFertilizer && cropName) {
    try {
      const raw = await getSoilGapAnalysis({
        N: uploadedSoilData?.N ?? 80, P: uploadedSoilData?.P ?? 40,
        K: uploadedSoilData?.K ?? 40, ph: uploadedSoilData?.ph ?? 6.5,
        desired_crop: cropName,
      } as SoilGapInput) as any;
      if (raw && !raw.error) {
        fertilizerDashboard = {
          crop: cropName,
          gaps: raw.nutrient_gaps ?? raw.gaps ?? [],
          fertilizer_plan: raw.fertilizer_plan ?? [],
          correction_steps: raw.correction_steps ?? [],
          overall_status: raw.overall_status,
        };
      }
    } catch (e) { console.error("Fertilizer failed:", e); }
  }

  // ── AgriShop ──
  let agriShopData: AgriShopData | undefined;
  // ── Universal Card Decision Table ─────────────────────────────────
  // Clear rules: which cards show for which intent
  // AgriShop: ONLY for crop recommendation, pest, shop, or user picking a crop
  //           NEVER for yield-only, weather-only, or mandi-only queries
  const isYieldOnly   = wantsYield  && !wantsShop && !wantsPest && !wantsCrop;
  const isWeatherOnly = wantsWeather && !wantsCrop && !wantsYield && !wantsPest && !wantsShop;
  const isMandiOnly   = wantsMarket  && !wantsCrop && !wantsYield && !wantsPest && !wantsShop;

  // For pest-only queries: only show AgriShop if user explicitly named a crop in THIS message.
  // Prevents stale ML crop (e.g. Rice) from bleeding into generic pesticide questions.
  const cropExplicitInMessage = !!userCrop; // user said the crop name in this message
  const showAgriShopForPest   = wantsPest && cropExplicitInMessage;
  const showAgriShop = !!cropName && (wantsShop || wantsCrop || showAgriShopForPest || userPicks) && !isYieldOnly;

  if (showAgriShop) {
    try {
      agriShopData = await getAgriShopData(cropName, effectiveLat, effectiveLon,
        weather ? {
          temperature: (weather as any).temperature ?? 28,
          humidity: (weather as any).humidity ?? 65,
          condition: (weather as any).condition ?? "Clear",
        } : undefined
      );
    } catch (e) { console.error("AgriShop failed:", e); }
  }

  // ── LLM response ──
  // For pest-only queries with no explicit crop: do NOT pass cropPrediction to Groq.
  // Otherwise Groq sees stale ML crop (Rice) and talks about it even though
  // the user just asked a generic pesticide question.
  const llmCropPrediction = (isPestOnly && !userCrop) ? undefined : cropPrediction;

  let reply = "Here is your farm analysis. Check the cards below.";
  try {
    reply = await generateConversationalResponse({
      userMessage: message, cropPrediction: llmCropPrediction, pestPrediction, yieldPrediction,
      weather, mandiPrices,
      location: (effectiveLat && effectiveLon) ? { lat: effectiveLat, lon: effectiveLon } : null,
      locationAvailable: !!(location || mentionedCity), // true only when real location exists
      wantsMarket, wantsWeather,
      hasYieldDashboard: !!yieldDashboard,
      hasFertilizerDashboard: !!fertilizerDashboard,
      hasMandiCard: !!(mandiPrices?.length),
      hasWeatherCard: !!weather,
      uploadedSoilData: uploadedSoilData ?? null,
      conversationHistory,
    });
  } catch (e) {
    console.error("LLM failed:", e);
    reply = yieldDashboard ? "Here is your yield forecast." : cropPrediction ? "Here are your crop recommendations." : "Check the cards below for details.";
  }

  return {
    reply, cropPrediction, pestPrediction, yieldPrediction,
    yieldDashboard, fertilizerDashboard,
    weather: weather ?? null, mandiPrices, cropName, agriShopData,
  };
}

// ── Safe wrappers ──────────────────────────────────────────────────────────

// City climate defaults — used when user asks about a region without uploaded soil
// Values: typical annual rainfall(mm), avg temperature(C), humidity(%), pH
const CITY_CLIMATE: Record<string, { rainfall: number; temperature: number; humidity: number; ph: number }> = {
  "pune":        { rainfall: 720,  temperature: 26, humidity: 60, ph: 6.8 },
  "mumbai":      { rainfall: 2200, temperature: 28, humidity: 82, ph: 6.5 },
  "delhi":       { rainfall: 650,  temperature: 25, humidity: 60, ph: 7.2 },
  "bangalore":   { rainfall: 970,  temperature: 24, humidity: 65, ph: 6.5 },
  "bengaluru":   { rainfall: 970,  temperature: 24, humidity: 65, ph: 6.5 },
  "hyderabad":   { rainfall: 780,  temperature: 27, humidity: 58, ph: 6.8 },
  "chennai":     { rainfall: 1400, temperature: 29, humidity: 75, ph: 7.0 },
  "kolkata":     { rainfall: 1600, temperature: 27, humidity: 80, ph: 6.5 },
  "ahmedabad":   { rainfall: 780,  temperature: 28, humidity: 55, ph: 7.5 },
  "surat":       { rainfall: 1200, temperature: 28, humidity: 72, ph: 7.0 },
  "jaipur":      { rainfall: 650,  temperature: 26, humidity: 50, ph: 7.5 },
  "lucknow":     { rainfall: 900,  temperature: 26, humidity: 70, ph: 7.2 },
  "nagpur":      { rainfall: 1050, temperature: 28, humidity: 62, ph: 7.0 },
  "nashik":      { rainfall: 680,  temperature: 24, humidity: 58, ph: 6.8 },
  "bharuch":     { rainfall: 900,  temperature: 28, humidity: 65, ph: 7.0 },
  "indore":      { rainfall: 960,  temperature: 25, humidity: 62, ph: 7.0 },
  "bhopal":      { rainfall: 1150, temperature: 25, humidity: 65, ph: 6.8 },
  "rajkot":      { rainfall: 600,  temperature: 28, humidity: 52, ph: 7.5 },
  "amritsar":    { rainfall: 680,  temperature: 22, humidity: 60, ph: 7.8 },
  "chandigarh":  { rainfall: 1100, temperature: 22, humidity: 65, ph: 7.5 },
  "ludhiana":    { rainfall: 750,  temperature: 22, humidity: 62, ph: 7.8 },
  "coimbatore":  { rainfall: 700,  temperature: 27, humidity: 68, ph: 6.5 },
  "kochi":       { rainfall: 3100, temperature: 28, humidity: 85, ph: 5.8 },
  "patna":       { rainfall: 1100, temperature: 26, humidity: 75, ph: 7.0 },
  "vadodara":    { rainfall: 900,  temperature: 27, humidity: 60, ph: 7.2 },
  "solapur":     { rainfall: 560,  temperature: 27, humidity: 55, ph: 7.5 },
  "kolhapur":    { rainfall: 1000, temperature: 25, humidity: 70, ph: 6.8 },
  "aurangabad":  { rainfall: 720,  temperature: 27, humidity: 58, ph: 7.5 },
};

function parseNPKFromMessage(message: string): Partial<CropPredictionInput> | null {
  // Parses "N: 80 P: 40 K: 40 pH: 6.8 Rainfall: 600 mm" from user message
  const nMatch        = message.match(/\bN\s*[:=]\s*(\d+(?:\.\d+)?)/i);
  const pMatch        = message.match(/\bP\s*[:=]\s*(\d+(?:\.\d+)?)/i);
  const kMatch        = message.match(/\bK\s*[:=]\s*(\d+(?:\.\d+)?)/i);
  const phMatch       = message.match(/\bph\s*[:=]\s*(\d+(?:\.\d+)?)/i);
  const rainfallMatch = message.match(/\brainfall\s*[:=]\s*(\d+(?:\.\d+)?)/i);
  // Need at least N and P to be useful
  if (!nMatch || !pMatch) return null;
  return {
    N:        parseFloat(nMatch[1]),
    P:        parseFloat(pMatch[1]),
    K:        kMatch        ? parseFloat(kMatch[1])        : 40,
    ph:       phMatch       ? parseFloat(phMatch[1])       : 6.5,
    rainfall: rainfallMatch ? parseFloat(rainfallMatch[1]) : 500,
    temperature: 25,
    humidity:    65,
  };
}

async function safePredictCrop(
  message: string,
  soil?: Partial<CropPredictionInput>,
  city?: string | null
): Promise<unknown> {
  try {
    // Case 1: Have uploaded soil data — use it (most accurate)
    if (soil?.N != null && soil?.P != null) {
      return await predictCrop({
        N: soil.N, P: soil.P, K: soil.K ?? 0,
        temperature: soil.temperature ?? 25,
        humidity: soil.humidity ?? 60,
        ph: soil.ph ?? 6.5,
        rainfall: soil.rainfall ?? 50,
        top_n: 3,
      });
    }
    // Case 2: User typed NPK values directly in message
    const parsedSoil = parseNPKFromMessage(message);
    if (parsedSoil) {
      return await predictCrop({
        N: parsedSoil.N!, P: parsedSoil.P!, K: parsedSoil.K ?? 40,
        temperature: parsedSoil.temperature ?? 25,
        humidity:    parsedSoil.humidity    ?? 65,
        ph:          parsedSoil.ph          ?? 6.5,
        rainfall:    parsedSoil.rainfall    ?? 500,
        top_n: 3,
      });
    }
    // Case 3: Region question for a known city — use that city's climate
    if (city && CITY_CLIMATE[city]) {
      const climate = CITY_CLIMATE[city];
      return await predictCrop({
        N: 80, P: 40, K: 40,
        temperature: climate.temperature,
        humidity:    climate.humidity,
        ph:          climate.ph,
        rainfall:    climate.rainfall,
        top_n: 3,
      });
    }
    // Case 4: No soil, no city — use generic defaults
    return await predictCrop({
      N: 80, P: 40, K: 40,
      temperature: 28, humidity: 65, ph: 6.8, rainfall: 45,
      top_n: 3,
    });
  } catch (e) { console.error("safePredictCrop failed", e); return undefined; }
}

async function safePredictPest(message: string): Promise<unknown> {
  try {
    return await predictPest({ insects_count: /(\d+)/.test(message) ? Number(RegExp.$1) : 10, crop_type: 1, soil_type: 1, pesticide_use_category: 1, number_doses_week: 1, number_weeks_used: 2, number_weeks_quit: 0, season: 2 } as PestPredictionInput);
  } catch (e) { console.error("safePredictPest failed", e); return undefined; }
}

async function safeGetWeather(lat: number, lon: number): Promise<WeatherSummary | null> {
  try { return await getWeather(lat, lon); }
  catch (e) { console.error("safeGetWeather failed", e); return null; }
}

async function safeGetMandiPrices(crop: string, lat: number, lon: number): Promise<MandiPrice[] | null> {
  try { return await getNearbyMandiPrices(crop, lat, lon); }
  catch (e) { console.error("safeGetMandiPrices failed", e); return null; }
}
