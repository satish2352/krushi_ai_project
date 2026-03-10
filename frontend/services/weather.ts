import { WeatherSummary } from "../types";

// Support both key names for backward compatibility
const API_KEY =
  process.env.NEXT_PUBLIC_OPENWEATHER_KEY ||
  process.env.NEXT_PUBLIC_WEATHER_API_KEY;

export interface ExtendedWeatherSummary extends WeatherSummary {
  cityName?: string;
  windSpeed?: number | null;
  feelsLike?: number | null;
  // Derived risk signals
  droughtRisk?: "Low" | "Medium" | "High";
  floodRisk?: "Low" | "Medium" | "High";
  pestOutbreakWarning?: boolean;
  pestWarningReason?: string;
}

export async function getWeather(
  lat: number,
  lon: number
): Promise<ExtendedWeatherSummary> {
  if (!API_KEY) {
    throw new Error(
      "Weather API key not configured. Add NEXT_PUBLIC_OPENWEATHER_KEY to .env.local"
    );
  }

  const url = new URL("https://api.openweathermap.org/data/2.5/weather");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  url.searchParams.set("appid", API_KEY);
  url.searchParams.set("units", "metric");

  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Weather API error (${res.status}): ${text || res.statusText}`);
  }

  const data = await res.json();

  const rainfall =
    data.rain && typeof data.rain["1h"] === "number"
      ? data.rain["1h"]
      : data.rain && typeof data.rain["3h"] === "number"
      ? data.rain["3h"]
      : null;

  const temperature = typeof data.main?.temp === "number" ? data.main.temp : null;
  const humidity = typeof data.main?.humidity === "number" ? data.main.humidity : null;
  const windSpeed = typeof data.wind?.speed === "number" ? data.wind.speed : null;
  const feelsLike = typeof data.main?.feels_like === "number" ? data.main.feels_like : null;
  const condition: string | null =
    Array.isArray(data.weather) && data.weather[0]?.description
      ? data.weather[0].description
      : null;

  // Derive agri risk signals
  const droughtRisk: ExtendedWeatherSummary["droughtRisk"] =
    humidity !== null && humidity < 30
      ? "High"
      : humidity !== null && humidity < 50
      ? "Medium"
      : "Low";

  const floodRisk: ExtendedWeatherSummary["floodRisk"] =
    rainfall !== null && rainfall > 50
      ? "High"
      : rainfall !== null && rainfall > 20
      ? "Medium"
      : "Low";

  // Pest outbreak is likely with high humidity + moderate warm temperature
  const pestOutbreakWarning =
    humidity !== null &&
    humidity > 75 &&
    temperature !== null &&
    temperature > 20 &&
    temperature < 35;

  const pestWarningReason =
    pestOutbreakWarning
      ? `Humidity ${humidity}% + temp ${temperature?.toFixed(1)}°C — ideal conditions for fungal disease and insect spread.`
      : undefined;

  return {
    temperature,
    humidity,
    rainfall,
    condition,
    cityName: data.name ?? undefined,
    windSpeed,
    feelsLike,
    droughtRisk,
    floodRisk,
    pestOutbreakWarning,
    pestWarningReason
  };
}

// Detect city name from user message
export function extractCityFromMessage(message: string): string | null {
  const cities: Record<string, { lat: number; lon: number }> = {
    "pune": { lat: 18.52, lon: 73.85 },
    "mumbai": { lat: 19.07, lon: 72.87 },
    "delhi": { lat: 28.61, lon: 77.23 },
    "bangalore": { lat: 12.97, lon: 77.59 },
    "bengaluru": { lat: 12.97, lon: 77.59 },
    "hyderabad": { lat: 17.38, lon: 78.48 },
    "chennai": { lat: 13.08, lon: 80.27 },
    "kolkata": { lat: 22.57, lon: 88.36 },
    "ahmedabad": { lat: 23.03, lon: 72.58 },
    "surat": { lat: 21.17, lon: 72.83 },
    "jaipur": { lat: 26.91, lon: 75.79 },
    "lucknow": { lat: 26.85, lon: 80.95 },
    "nagpur": { lat: 21.14, lon: 79.08 },
    "patna": { lat: 25.59, lon: 85.13 },
    "bhopal": { lat: 23.25, lon: 77.40 },
    "indore": { lat: 22.71, lon: 75.86 },
    "vadodara": { lat: 22.30, lon: 73.19 },
    "nashik": { lat: 19.99, lon: 73.79 },
    "aurangabad": { lat: 19.87, lon: 75.34 },
    "rajkot": { lat: 22.30, lon: 70.80 },
    "amritsar": { lat: 31.63, lon: 74.87 },
    "chandigarh": { lat: 30.73, lon: 76.78 },
    "ludhiana": { lat: 30.90, lon: 75.85 },
    "coimbatore": { lat: 11.01, lon: 76.97 },
    "kochi": { lat: 9.93, lon: 76.26 },
    "visakhapatnam": { lat: 17.69, lon: 83.21 },
    "bhubaneswar": { lat: 20.29, lon: 85.82 },
    "guwahati": { lat: 26.18, lon: 91.74 },
    "dehradun": { lat: 30.31, lon: 78.03 },
    "shimla": { lat: 31.10, lon: 77.17 },
    "bharuch": { lat: 21.70, lon: 72.98 },
    "solan": { lat: 30.90, lon: 77.10 },
    "latur": { lat: 18.40, lon: 76.56 },
    "solapur": { lat: 17.68, lon: 75.90 },
    "kolhapur": { lat: 16.70, lon: 74.24 },
  };

  const msg = message.toLowerCase();
  const found = Object.entries(cities).find(([city]) =>
    new RegExp(`\\b${city}\\b`).test(msg)
  );
  return found ? found[0] : null;
}

export async function getWeatherByCity(cityName: string): Promise<ExtendedWeatherSummary & { lat: number; lon: number }> {
  const cities: Record<string, { lat: number; lon: number }> = {
    "pune": { lat: 18.52, lon: 73.85 },
    "mumbai": { lat: 19.07, lon: 72.87 },
    "delhi": { lat: 28.61, lon: 77.23 },
    "bangalore": { lat: 12.97, lon: 77.59 },
    "bengaluru": { lat: 12.97, lon: 77.59 },
    "hyderabad": { lat: 17.38, lon: 78.48 },
    "chennai": { lat: 13.08, lon: 80.27 },
    "kolkata": { lat: 22.57, lon: 88.36 },
    "ahmedabad": { lat: 23.03, lon: 72.58 },
    "surat": { lat: 21.17, lon: 72.83 },
    "jaipur": { lat: 26.91, lon: 75.79 },
    "lucknow": { lat: 26.85, lon: 80.95 },
    "nagpur": { lat: 21.14, lon: 79.08 },
    "patna": { lat: 25.59, lon: 85.13 },
    "bhopal": { lat: 23.25, lon: 77.40 },
    "indore": { lat: 22.71, lon: 75.86 },
    "vadodara": { lat: 22.30, lon: 73.19 },
    "nashik": { lat: 19.99, lon: 73.79 },
    "rajkot": { lat: 22.30, lon: 70.80 },
    "amritsar": { lat: 31.63, lon: 74.87 },
    "chandigarh": { lat: 30.73, lon: 76.78 },
    "ludhiana": { lat: 30.90, lon: 75.85 },
    "coimbatore": { lat: 11.01, lon: 76.97 },
    "kochi": { lat: 9.93, lon: 76.26 },
    "bharuch": { lat: 21.70, lon: 72.98 },
  };

  const coords = cities[cityName.toLowerCase()];
  if (!coords) throw new Error(`City not found: ${cityName}`);
  const weather = await getWeather(coords.lat, coords.lon);
  return { ...weather, lat: coords.lat, lon: coords.lon };
}
