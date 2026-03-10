export type Role = "user" | "assistant" | "system";

export interface YieldDashboardData {
  yield_estimation: {
    yield_per_hectare_tons: number;
    total_yield_tons: number;
    total_yield_quintals: number;
    farm_size_acres: number;
  };
  profit_analysis: {
    market_price_per_quintal: number;
    input_cost_per_acre: number;
    total_cost_rs: number;
    total_revenue_rs: number;
    gross_profit_rs: number;
    profit_margin_pct: number;
    is_profitable: boolean;
  };
  breakeven_analysis: {
    breakeven_yield_quintals: number;
    actual_vs_breakeven: string;
    safety_margin_pct: number;
  };
  crop: string;
  farm_size_acres: number;
}

// BUG FIX: Field names now match FertilizerCard.tsx exactly.
// Old shape used {fertilizer, quantity_kg_per_acre, cost_estimate} —
// FertilizerCard.tsx expects {product, quantity_kg_acre, application, alternative?}
// gaps also aligned: FertilizerCard expects {required_min, required_max, deficit, excess}
export interface FertilizerGap {
  nutrient: string;
  current: number;
  required_min: number;
  required_max: number;
  status: "DEFICIENT" | "OPTIMAL" | "EXCESS";
  deficit?: number;
  excess?: number;
}

export interface FertilizerPlan {
  nutrient: string;
  product: string;
  quantity_kg_acre: number;
  application: string;
  alternative?: string;
}

export interface FertilizerDashboardData {
  crop: string;
  gaps: FertilizerGap[];
  fertilizer_plan: FertilizerPlan[];
  correction_steps: string[];
  overall_status?: string;
}

export interface AgriShopData {
  crop: string;
  pesticides: { name: string; purpose: string; amazonUrl: string; bighaatUrl: string }[];
  seeds: { name: string; purpose: string; amazonUrl: string; bighaatUrl: string }[];
  machinery: { name: string; purpose: string; season: string; amazonUrl: string; flipkartUrl: string }[];
  nearbyShops: { name: string; type: string; distanceKm: number; address: string; mapsUrl: string }[];
  weather?: { temperature: number; humidity: number; condition: string };
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  createdAt: string;
  isLoading?: boolean;
  yieldDashboard?: YieldDashboardData;
  fertilizerDashboard?: FertilizerDashboardData;
  weatherData?: WeatherSummary & { cityName?: string; droughtRisk?: string; floodRisk?: string; windSpeed?: number };
  mandiPrices?: MandiPrice[];
  cropName?: string;
  agriShopData?: AgriShopData;
  cropPrediction?: unknown;
  pestPrediction?: unknown;
  // Context generation IDs — when location or soil is cleared, these increment.
  // Messages with a different ID are excluded from LLM history so Groq never
  // "remembers" data the user has explicitly removed.
  locationGenId?: number;
  soilGenId?: number;
}

export interface Location {
  lat: number;
  lon: number;
}

export interface WeatherSummary {
  temperature: number | null;
  humidity: number | null;
  rainfall: number | null;
  condition: string | null;
}

export interface MandiPrice {
  mandiName: string;
  distanceKm: number;
  modalPrice: number;
  state: string;
}

export interface CropPredictionInput {
  N: number;
  P: number;
  K: number;
  temperature: number;
  humidity: number;
  ph: number;
  rainfall: number;
  top_n?: number;
}

export interface PestPredictionInput {
  insects_count: number;
  crop_type?: number;
  soil_type?: number;
  pesticide_use_category?: number;
  number_doses_week?: number;
  number_weeks_used?: number;
  number_weeks_quit?: number;
  season?: number;
}

export interface YieldPredictionInput {
  rainfall_mm: number;
  temperature_celsius: number;
  days_to_harvest: number;
  fertilizer_used: number;
  irrigation_used: number;
  region: string;
  soil_type: string;
  crop: string;
  weather_condition: string;
  farm_size_acres?: number;
  market_price_per_quintal?: number;
  input_cost_per_acre?: number;
}

export interface RoutingContext {
  message: string;
  location?: Location;
  uploadedSoilData?: Partial<CropPredictionInput>;
  conversationHistory?: { role: "user" | "assistant"; content: string }[];
}

export interface SoilGapInput {
  N: number;
  P: number;
  K: number;
  ph: number;
  desired_crop: string;
}
