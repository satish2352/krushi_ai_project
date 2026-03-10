import { MandiPrice } from "../types";

const DATAGOVIN_KEY = process.env.NEXT_PUBLIC_DATAGOVIN_KEY;
const DATAGOVIN_URL = "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070";

// ── Map coordinates → Indian state ────────────────────────────────────────
function getStateFromCoords(lat: number, lon: number): string {
  const STATE_BOUNDS: { state: string; latMin: number; latMax: number; lonMin: number; lonMax: number }[] = [
    { state: "Jammu and Kashmir",  latMin: 32.5, latMax: 37.1, lonMin: 73.0, lonMax: 80.5 },
    { state: "Himachal Pradesh",   latMin: 30.4, latMax: 33.2, lonMin: 75.6, lonMax: 79.0 },
    { state: "Punjab",             latMin: 29.5, latMax: 32.5, lonMin: 73.9, lonMax: 76.9 },
    { state: "Haryana",            latMin: 27.6, latMax: 30.9, lonMin: 74.5, lonMax: 77.6 },
    { state: "Uttarakhand",        latMin: 28.7, latMax: 31.5, lonMin: 77.6, lonMax: 81.1 },
    { state: "Uttar Pradesh",      latMin: 23.9, latMax: 30.4, lonMin: 77.1, lonMax: 84.7 },
    { state: "Rajasthan",          latMin: 23.0, latMax: 30.2, lonMin: 69.5, lonMax: 78.3 },
    { state: "Gujarat",            latMin: 20.1, latMax: 24.7, lonMin: 68.2, lonMax: 74.5 },
    { state: "Madhya Pradesh",     latMin: 21.1, latMax: 26.9, lonMin: 74.0, lonMax: 82.8 },
    { state: "Bihar",              latMin: 24.3, latMax: 27.5, lonMin: 83.3, lonMax: 88.3 },
    { state: "West Bengal",        latMin: 21.5, latMax: 27.2, lonMin: 85.8, lonMax: 89.9 },
    { state: "Jharkhand",          latMin: 21.9, latMax: 25.3, lonMin: 83.3, lonMax: 87.5 },
    { state: "Odisha",             latMin: 17.8, latMax: 22.5, lonMin: 81.4, lonMax: 87.5 },
    { state: "Chhattisgarh",       latMin: 17.8, latMax: 24.1, lonMin: 80.3, lonMax: 84.4 },
    { state: "Maharashtra",        latMin: 15.6, latMax: 22.1, lonMin: 72.7, lonMax: 80.9 },
    { state: "Telangana",          latMin: 15.9, latMax: 19.9, lonMin: 77.2, lonMax: 81.8 },
    { state: "Andhra Pradesh",     latMin: 12.6, latMax: 19.9, lonMin: 76.8, lonMax: 84.8 },
    { state: "Karnataka",          latMin: 11.6, latMax: 18.5, lonMin: 74.1, lonMax: 78.6 },
    { state: "Tamil Nadu",         latMin: 8.0,  latMax: 13.6, lonMin: 76.2, lonMax: 80.4 },
    { state: "Kerala",             latMin: 8.2,  latMax: 12.8, lonMin: 74.9, lonMax: 77.4 },
    { state: "Goa",                latMin: 14.9, latMax: 15.8, lonMin: 73.7, lonMax: 74.3 },
    { state: "Assam",              latMin: 24.1, latMax: 28.0, lonMin: 89.7, lonMax: 96.0 },
    { state: "Delhi",              latMin: 28.4, latMax: 28.9, lonMin: 76.8, lonMax: 77.4 },
  ];
  for (const s of STATE_BOUNDS) {
    if (lat >= s.latMin && lat <= s.latMax && lon >= s.lonMin && lon <= s.lonMax) return s.state;
  }
  return "Maharashtra";
}

// ── Real mandi prices from data.gov.in ────────────────────────────────────
async function fetchRealMandiPrices(crop: string, state: string): Promise<MandiPrice[]> {
  if (!DATAGOVIN_KEY) throw new Error("No API key");

  const cropMap: Record<string, string> = {
    rice: "Rice", paddy: "Paddy(Dhan)(Common)", wheat: "Wheat", gehu: "Wheat",
    maize: "Maize", makka: "Maize", cotton: "Cotton", kapas: "Cotton",
    sugarcane: "Sugarcane", onion: "Onion", pyaz: "Onion", tomato: "Tomato",
    tamatar: "Tomato", potato: "Potato", aloo: "Potato", soybean: "Soyabean",
    groundnut: "Groundnut", bajra: "Bajra(Pearl Millet/Cumbu)",
    jowar: "Jowar(Sorghum)", tur: "Arhar (Tur/Red Gram)(Whole)",
    arhar: "Arhar (Tur/Red Gram)(Whole)", chana: "Bengal Gram(Gram)(Whole)",
    moong: "Moong(Green Gram)(Whole)", urad: "Black Gram (Urd Beans)(Whole)",
    mustard: "Mustard", garlic: "Garlic", chilli: "Dry Chillies",
  };

  const c = crop.toLowerCase();
  const apiCrop = Object.entries(cropMap).find(([k]) => c.includes(k))?.[1]
    ?? (crop.charAt(0).toUpperCase() + crop.slice(1));

  const params = new URLSearchParams({
    "api-key": DATAGOVIN_KEY,
    format: "json",
    limit: "8",
    "filters[state]": state,
    "filters[commodity]": apiCrop,
  });

  const res = await fetch(`${DATAGOVIN_URL}?${params}`);
  if (!res.ok) throw new Error(`API ${res.status}`);
  const data = await res.json();
  if (!data?.records?.length) throw new Error("No records");

  return (data.records as any[]).slice(0, 5).map((r: any) => ({
    mandiName: r.market ?? r.district ?? "Local Mandi",
    distanceKm: 0,
    modalPrice: Number(r.modal_price) || Number(r.min_price) || 0,
    state: r.state ?? state,
  }));
}

// ── Haversine distance ─────────────────────────────────────────────────────
function distKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
    * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// ── State centroids — last-resort fallback ────────────────────────────────
const STATE_CENTROIDS: Record<string, { lat: number; lon: number }> = {
  "Gujarat":          { lat: 22.26, lon: 71.20 },
  "Maharashtra":      { lat: 19.75, lon: 75.71 },
  "Madhya Pradesh":   { lat: 23.47, lon: 77.95 },
  "Rajasthan":        { lat: 27.02, lon: 74.22 },
  "Uttar Pradesh":    { lat: 26.85, lon: 80.95 },
  "Punjab":           { lat: 31.15, lon: 75.34 },
  "Haryana":          { lat: 29.06, lon: 76.08 },
  "Karnataka":        { lat: 15.32, lon: 75.71 },
  "Andhra Pradesh":   { lat: 15.91, lon: 79.74 },
  "Telangana":        { lat: 17.85, lon: 79.10 },
  "Tamil Nadu":       { lat: 11.13, lon: 78.66 },
  "Bihar":            { lat: 25.59, lon: 85.13 },
  "West Bengal":      { lat: 22.99, lon: 87.85 },
  "Odisha":           { lat: 20.95, lon: 85.09 },
  "Chhattisgarh":     { lat: 21.27, lon: 81.86 },
  "Jharkhand":        { lat: 23.61, lon: 85.28 },
  "Uttarakhand":      { lat: 30.07, lon: 79.00 },
  "Himachal Pradesh": { lat: 31.10, lon: 77.17 },
  "Assam":            { lat: 26.18, lon: 91.75 },
  "Kerala":           { lat: 10.85, lon: 76.27 },
};

// ── Comprehensive mandi coordinates — ~450 towns across all states ─────────
// Keys stored WITHOUT "APMC" suffix. Matching is done via normalization.
const MANDI_COORDS: Record<string, { lat: number; lon: number }> = {
  // ── GUJARAT ──────────────────────────────────────────────────────────────
  "Rajkot":           { lat: 22.30, lon: 70.80 }, "Surat":            { lat: 21.19, lon: 72.84 },
  "Ahmedabad":        { lat: 23.03, lon: 72.58 }, "Vadodara":         { lat: 22.31, lon: 73.18 },
  "Bharuch":          { lat: 21.70, lon: 72.98 }, "Anand":            { lat: 22.55, lon: 72.95 },
  "Gandhinagar":      { lat: 23.22, lon: 72.65 }, "Mehsana":          { lat: 23.59, lon: 72.38 },
  "Dhoraji":          { lat: 21.73, lon: 70.45 }, "Babra":            { lat: 21.83, lon: 71.32 },
  "Amreli":           { lat: 21.60, lon: 71.22 }, "Junagadh":         { lat: 21.52, lon: 70.46 },
  "Gondal":           { lat: 21.96, lon: 70.80 }, "Jam Khambhalia":   { lat: 22.20, lon: 70.22 },
  "Porbandar":        { lat: 21.64, lon: 69.60 }, "Bodeliu":          { lat: 22.01, lon: 71.68 },
  "Hadad":            { lat: 22.07, lon: 71.52 }, "Jasdan":           { lat: 22.04, lon: 71.20 },
  "Kalediya":         { lat: 22.10, lon: 71.30 }, "Bagasara":         { lat: 21.48, lon: 71.02 },
  "Botad":            { lat: 22.17, lon: 71.67 }, "Sihor":            { lat: 21.71, lon: 71.96 },
  "Palitana":         { lat: 21.52, lon: 71.82 }, "Mahuva":           { lat: 21.09, lon: 71.76 },
  "Talaja":           { lat: 21.36, lon: 72.04 }, "Vallabhipur":      { lat: 21.90, lon: 71.90 },
  "Visavadar":        { lat: 21.33, lon: 70.73 }, "Upleta":           { lat: 21.74, lon: 70.28 },
  "Wankaner":         { lat: 22.61, lon: 70.95 }, "Morbi":            { lat: 22.82, lon: 70.84 },
  "Surendranagar":    { lat: 22.73, lon: 71.64 }, "Dhrangadhra":      { lat: 22.99, lon: 71.47 },
  "Halvad":           { lat: 23.02, lon: 71.18 }, "Viramgam":         { lat: 23.12, lon: 72.03 },
  "Sanand":           { lat: 22.99, lon: 72.38 }, "Bavla":            { lat: 22.83, lon: 72.37 },
  "Dhandhuka":        { lat: 22.38, lon: 71.98 }, "Borsad":           { lat: 22.40, lon: 72.90 },
  "Petlad":           { lat: 22.47, lon: 72.80 }, "Nadiad":           { lat: 22.69, lon: 72.86 },
  "Kheda":            { lat: 22.75, lon: 72.69 }, "Kapadvanj":        { lat: 23.02, lon: 73.07 },
  "Dakor":            { lat: 22.75, lon: 73.15 }, "Godhra":           { lat: 22.78, lon: 73.62 },
  "Halol":            { lat: 22.50, lon: 73.47 }, "Dahod":            { lat: 22.84, lon: 74.26 },
  "Lunawada":         { lat: 23.13, lon: 73.62 }, "Himmatnagar":      { lat: 23.60, lon: 72.96 },
  "Modasa":           { lat: 23.46, lon: 73.30 }, "Patan":            { lat: 23.85, lon: 72.12 },
  "Unjha":            { lat: 23.80, lon: 72.40 }, "Palanpur":         { lat: 24.17, lon: 72.43 },
  "Deesa":            { lat: 24.26, lon: 72.19 }, "Tharad":           { lat: 24.40, lon: 71.63 },
  "Vapi":             { lat: 20.37, lon: 72.91 }, "Navsari":          { lat: 20.95, lon: 72.92 },
  "Vyara":            { lat: 21.10, lon: 73.39 }, "Bardoli":          { lat: 21.12, lon: 73.11 },
  "Mandvi":           { lat: 22.83, lon: 69.35 }, "Bhuj":             { lat: 23.25, lon: 69.67 },
  "Gandhidham":       { lat: 23.07, lon: 70.13 }, "Anjar":            { lat: 23.11, lon: 70.02 },
  "Rapar":            { lat: 23.57, lon: 70.64 }, "Una":              { lat: 20.82, lon: 71.04 },

  // ── MAHARASHTRA ──────────────────────────────────────────────────────────
  "Pune":             { lat: 18.51, lon: 73.92 }, "Nashik":           { lat: 19.99, lon: 73.79 },
  "Nagpur":           { lat: 21.14, lon: 79.08 }, "Aurangabad":       { lat: 19.87, lon: 75.34 },
  "Kolhapur":         { lat: 16.70, lon: 74.24 }, "Solapur":          { lat: 17.68, lon: 75.90 },
  "Mumbai":           { lat: 19.08, lon: 72.87 }, "Lasalgaon":        { lat: 20.12, lon: 74.05 },
  "Amravati":         { lat: 20.93, lon: 77.75 }, "Akola":            { lat: 20.71, lon: 77.00 },
  "Latur":            { lat: 18.40, lon: 76.56 }, "Nanded":           { lat: 19.15, lon: 77.32 },
  "Osmanabad":        { lat: 18.18, lon: 76.04 }, "Jalna":            { lat: 19.84, lon: 75.89 },
  "Beed":             { lat: 18.99, lon: 75.76 }, "Hingoli":          { lat: 19.72, lon: 77.15 },
  "Parbhani":         { lat: 19.27, lon: 76.78 }, "Nandurbar":        { lat: 21.36, lon: 74.24 },
  "Dhule":            { lat: 20.90, lon: 74.78 }, "Jalgaon":          { lat: 21.00, lon: 75.56 },
  "Ahmednagar":       { lat: 19.09, lon: 74.74 }, "Sangamner":        { lat: 19.57, lon: 74.21 },
  "Yeola":            { lat: 20.04, lon: 74.49 }, "Rahata":           { lat: 19.72, lon: 74.48 },
  "Kopargaon":        { lat: 19.90, lon: 74.48 }, "Manmad":           { lat: 20.25, lon: 74.44 },
  "Niphad":           { lat: 20.08, lon: 74.11 }, "Satara":           { lat: 17.68, lon: 74.00 },
  "Karad":            { lat: 17.29, lon: 74.18 }, "Sangli":           { lat: 16.86, lon: 74.57 },
  "Miraj":            { lat: 16.82, lon: 74.66 }, "Pandharpur":       { lat: 17.68, lon: 75.33 },
  "Barshi":           { lat: 18.23, lon: 75.69 }, "Yavatmal":         { lat: 20.39, lon: 78.12 },
  "Wardha":           { lat: 20.75, lon: 78.60 }, "Washim":           { lat: 20.11, lon: 77.15 },
  "Buldhana":         { lat: 20.53, lon: 76.18 }, "Chandrapur":       { lat: 19.95, lon: 79.30 },
  "Gondia":           { lat: 21.46, lon: 80.20 }, "Bhandara":         { lat: 21.17, lon: 79.65 },
  "Ratnagiri":        { lat: 16.99, lon: 73.30 }, "Shirdi":           { lat: 19.77, lon: 74.48 },

  // ── MADHYA PRADESH ───────────────────────────────────────────────────────
  "Indore":           { lat: 22.72, lon: 75.86 }, "Bhopal":           { lat: 23.26, lon: 77.40 },
  "Ratlam":           { lat: 23.33, lon: 75.04 }, "Ujjain":           { lat: 23.18, lon: 75.78 },
  "Jabalpur":         { lat: 23.18, lon: 79.94 }, "Gwalior":          { lat: 26.22, lon: 78.18 },
  "Sagar":            { lat: 23.83, lon: 78.73 }, "Satna":            { lat: 24.60, lon: 80.83 },
  "Rewa":             { lat: 24.53, lon: 81.30 }, "Khandwa":          { lat: 21.83, lon: 76.35 },
  "Khargone":         { lat: 21.82, lon: 75.62 }, "Dewas":            { lat: 22.97, lon: 76.05 },
  "Shajapur":         { lat: 23.43, lon: 76.28 }, "Mandsaur":         { lat: 24.07, lon: 75.07 },
  "Neemuch":          { lat: 24.47, lon: 74.87 }, "Morena":           { lat: 26.50, lon: 78.00 },
  "Shivpuri":         { lat: 25.43, lon: 77.66 }, "Vidisha":          { lat: 23.52, lon: 77.81 },
  "Hoshangabad":      { lat: 22.75, lon: 77.72 }, "Itarsi":           { lat: 22.62, lon: 77.76 },
  "Betul":            { lat: 21.91, lon: 77.90 }, "Chhindwara":       { lat: 22.06, lon: 78.93 },
  "Seoni":            { lat: 22.09, lon: 79.54 }, "Balaghat":         { lat: 21.81, lon: 80.19 },
  "Katni":            { lat: 23.83, lon: 80.40 }, "Dindori":          { lat: 22.94, lon: 81.08 },

  // ── RAJASTHAN ────────────────────────────────────────────────────────────
  "Jaipur":           { lat: 26.91, lon: 75.79 }, "Jodhpur":          { lat: 26.29, lon: 73.02 },
  "Kota":             { lat: 25.18, lon: 75.85 }, "Bikaner":          { lat: 28.02, lon: 73.31 },
  "Udaipur":          { lat: 24.57, lon: 73.68 }, "Ajmer":            { lat: 26.45, lon: 74.64 },
  "Bharatpur":        { lat: 27.22, lon: 77.49 }, "Alwar":            { lat: 27.55, lon: 76.61 },
  "Sikar":            { lat: 27.61, lon: 75.14 }, "Nagaur":           { lat: 27.20, lon: 73.73 },
  "Barmer":           { lat: 25.75, lon: 71.39 }, "Jaisalmer":        { lat: 26.92, lon: 70.90 },
  "Jhalawar":         { lat: 24.60, lon: 76.16 }, "Bundi":            { lat: 25.44, lon: 75.64 },
  "Tonk":             { lat: 26.17, lon: 75.79 }, "Bhilwara":         { lat: 25.35, lon: 74.63 },
  "Chittorgarh":      { lat: 24.89, lon: 74.62 }, "Sri Ganganagar":   { lat: 29.92, lon: 73.88 },
  "Hanumangarh":      { lat: 29.58, lon: 74.33 }, "Churu":            { lat: 28.30, lon: 74.97 },
  "Jhunjhunu":        { lat: 28.13, lon: 75.40 }, "Dungarpur":        { lat: 23.84, lon: 73.72 },
  "Banswara":         { lat: 23.55, lon: 74.44 }, "Sawai Madhopur":   { lat: 26.00, lon: 76.36 },

  // ── UTTAR PRADESH ────────────────────────────────────────────────────────
  "Agra":             { lat: 27.18, lon: 78.01 }, "Lucknow":          { lat: 26.85, lon: 80.95 },
  "Varanasi":         { lat: 25.32, lon: 82.97 }, "Kanpur":           { lat: 26.45, lon: 80.33 },
  "Allahabad":        { lat: 25.44, lon: 81.84 }, "Meerut":           { lat: 28.98, lon: 77.71 },
  "Bareilly":         { lat: 28.35, lon: 79.43 }, "Aligarh":          { lat: 27.88, lon: 78.08 },
  "Moradabad":        { lat: 28.84, lon: 78.77 }, "Saharanpur":       { lat: 29.97, lon: 77.55 },
  "Gorakhpur":        { lat: 26.76, lon: 83.37 }, "Muzaffarnagar":    { lat: 29.47, lon: 77.70 },
  "Firozabad":        { lat: 27.15, lon: 78.40 }, "Mathura":          { lat: 27.49, lon: 77.67 },
  "Mainpuri":         { lat: 27.23, lon: 79.03 }, "Etah":             { lat: 27.56, lon: 78.67 },
  "Sikandraraau":     { lat: 27.70, lon: 78.35 }, "Bulandshahr":      { lat: 28.41, lon: 77.85 },
  "Bijnor":           { lat: 29.37, lon: 78.14 }, "Sitapur":          { lat: 27.57, lon: 80.68 },
  "Hardoi":           { lat: 27.40, lon: 80.13 }, "Unnao":            { lat: 26.55, lon: 80.48 },
  "Rae Bareli":       { lat: 26.23, lon: 81.23 }, "Sultanpur":        { lat: 26.26, lon: 82.07 },
  "Faizabad":         { lat: 26.78, lon: 82.14 }, "Gonda":            { lat: 27.13, lon: 81.97 },
  "Bahraich":         { lat: 27.57, lon: 81.60 }, "Lakhimpur":        { lat: 27.95, lon: 80.78 },
  "Pilibhit":         { lat: 28.63, lon: 79.80 }, "Shahjahanpur":     { lat: 27.88, lon: 79.91 },
  "Rampur":           { lat: 28.81, lon: 79.03 }, "Badaun":           { lat: 28.03, lon: 79.12 },
  "Etawah":           { lat: 26.78, lon: 79.02 }, "Kannauj":          { lat: 27.06, lon: 79.91 },
  "Fatehpur":         { lat: 25.93, lon: 80.81 }, "Jaunpur":          { lat: 25.73, lon: 82.68 },
  "Ghazipur":         { lat: 25.58, lon: 83.58 }, "Ballia":           { lat: 25.75, lon: 84.15 },
  "Azamgarh":         { lat: 26.07, lon: 83.19 }, "Deoria":           { lat: 26.50, lon: 83.78 },
  "Kushinagar":       { lat: 26.74, lon: 83.89 }, "Basti":            { lat: 26.79, lon: 82.72 },
  "Kasganj":          { lat: 27.81, lon: 78.64 }, "Hapur":            { lat: 28.73, lon: 77.78 },
  "Shamli":           { lat: 29.45, lon: 77.31 }, "Maharajganj":      { lat: 27.13, lon: 83.56 },

  // ── PUNJAB ───────────────────────────────────────────────────────────────
  "Amritsar":         { lat: 31.63, lon: 74.87 }, "Ludhiana":         { lat: 30.90, lon: 75.85 },
  "Jalandhar":        { lat: 31.33, lon: 75.58 }, "Patiala":          { lat: 30.34, lon: 76.39 },
  "Bathinda":         { lat: 30.21, lon: 74.94 }, "Moga":             { lat: 30.82, lon: 75.17 },
  "Ferozepur":        { lat: 30.93, lon: 74.62 }, "Gurdaspur":        { lat: 32.03, lon: 75.41 },
  "Hoshiarpur":       { lat: 31.53, lon: 75.91 }, "Sangrur":          { lat: 30.25, lon: 75.84 },
  "Barnala":          { lat: 30.38, lon: 75.55 }, "Fazilka":          { lat: 30.40, lon: 74.02 },
  "Muktsar":          { lat: 30.47, lon: 74.52 }, "Mansa":            { lat: 29.99, lon: 75.39 },
  "Faridkot":         { lat: 30.67, lon: 74.76 }, "Kapurthala":       { lat: 31.38, lon: 75.38 },
  "Tarn Taran":       { lat: 31.45, lon: 74.93 }, "Pathankot":        { lat: 32.27, lon: 75.65 },
  "Nawanshahr":       { lat: 31.12, lon: 76.11 }, "Rupnagar":         { lat: 30.97, lon: 76.53 },

  // ── HARYANA ──────────────────────────────────────────────────────────────
  "Karnal":           { lat: 29.68, lon: 76.99 }, "Rohtak":           { lat: 28.89, lon: 76.58 },
  "Hisar":            { lat: 29.15, lon: 75.72 }, "Panipat":          { lat: 29.38, lon: 76.97 },
  "Sirsa":            { lat: 29.53, lon: 75.02 }, "Ambala":           { lat: 30.38, lon: 76.78 },
  "Sonipat":          { lat: 28.99, lon: 77.01 }, "Faridabad":        { lat: 28.41, lon: 77.31 },
  "Jhajjar":          { lat: 28.61, lon: 76.66 }, "Rewari":           { lat: 28.19, lon: 76.62 },
  "Mahendragarh":     { lat: 28.27, lon: 76.15 }, "Bhiwani":          { lat: 28.79, lon: 76.13 },
  "Jind":             { lat: 29.32, lon: 76.31 }, "Kaithal":          { lat: 29.80, lon: 76.40 },
  "Kurukshetra":      { lat: 29.97, lon: 76.88 }, "Yamunanagar":      { lat: 30.13, lon: 77.28 },
  "Fatehabad":        { lat: 29.52, lon: 75.45 }, "Nuh":              { lat: 28.10, lon: 77.00 },
  "Palwal":           { lat: 28.14, lon: 77.33 }, "Chandigarh":       { lat: 30.73, lon: 76.78 },

  // ── KARNATAKA ────────────────────────────────────────────────────────────
  "Bangalore":        { lat: 13.00, lon: 77.58 }, "Hubli":            { lat: 15.36, lon: 75.14 },
  "Mysore":           { lat: 12.30, lon: 76.65 }, "Davangere":        { lat: 14.46, lon: 75.92 },
  "Raichur":          { lat: 16.20, lon: 77.36 }, "Bellary":          { lat: 15.15, lon: 76.92 },
  "Bidar":            { lat: 17.91, lon: 77.52 }, "Gulbarga":         { lat: 17.33, lon: 76.82 },
  "Bijapur":          { lat: 16.83, lon: 75.72 }, "Bagalkot":         { lat: 16.18, lon: 75.70 },
  "Dharwad":          { lat: 15.46, lon: 75.01 }, "Gadag":            { lat: 15.43, lon: 75.63 },
  "Haveri":           { lat: 14.79, lon: 75.40 }, "Koppal":           { lat: 15.35, lon: 76.15 },
  "Shimoga":          { lat: 13.93, lon: 75.56 }, "Chitradurga":      { lat: 14.23, lon: 76.40 },
  "Tumkur":           { lat: 13.34, lon: 77.10 }, "Kolar":            { lat: 13.14, lon: 78.13 },
  "Mandya":           { lat: 12.52, lon: 76.90 }, "Hassan":           { lat: 13.00, lon: 76.10 },
  "Chikmagalur":      { lat: 13.32, lon: 75.77 }, "Udupi":            { lat: 13.34, lon: 74.74 },
  "Mangalore":        { lat: 12.87, lon: 74.88 }, "Yadgir":           { lat: 16.77, lon: 77.14 },
  "Chikkaballapur":   { lat: 13.43, lon: 77.73 },

  // ── ANDHRA PRADESH ───────────────────────────────────────────────────────
  "Guntur":           { lat: 16.30, lon: 80.45 }, "Kurnool":          { lat: 15.83, lon: 78.04 },
  "Vijayawada":       { lat: 16.51, lon: 80.64 }, "Nellore":          { lat: 14.44, lon: 79.99 },
  "Tirupati":         { lat: 13.63, lon: 79.42 }, "Kakinada":         { lat: 16.98, lon: 82.24 },
  "Rajahmundry":      { lat: 17.00, lon: 81.80 }, "Visakhapatnam":    { lat: 17.69, lon: 83.22 },
  "Eluru":            { lat: 16.71, lon: 81.10 }, "Ongole":           { lat: 15.50, lon: 80.04 },
  "Nandyal":          { lat: 15.48, lon: 78.49 }, "Kadapa":           { lat: 14.47, lon: 78.82 },
  "Anantapur":        { lat: 14.68, lon: 77.60 }, "Chittoor":         { lat: 13.22, lon: 79.10 },
  "Srikakulam":       { lat: 18.30, lon: 83.90 }, "Vizianagaram":     { lat: 18.11, lon: 83.42 },

  // ── TELANGANA ────────────────────────────────────────────────────────────
  "Hyderabad":        { lat: 17.38, lon: 78.48 }, "Warangal":         { lat: 17.97, lon: 79.59 },
  "Nizamabad":        { lat: 18.67, lon: 78.09 }, "Karimnagar":       { lat: 18.44, lon: 79.12 },
  "Khammam":          { lat: 17.25, lon: 80.15 }, "Nalgonda":         { lat: 17.05, lon: 79.27 },
  "Mahbubnagar":      { lat: 16.74, lon: 77.99 }, "Adilabad":         { lat: 19.66, lon: 78.53 },
  "Medak":            { lat: 18.05, lon: 78.26 }, "Siddipet":         { lat: 18.10, lon: 78.85 },
  "Sangareddy":       { lat: 17.63, lon: 78.09 }, "Wanaparthy":       { lat: 16.36, lon: 78.05 },
  "Vikarabad":        { lat: 17.34, lon: 77.90 },

  // ── TAMIL NADU ───────────────────────────────────────────────────────────
  "Chennai":          { lat: 13.08, lon: 80.27 }, "Coimbatore":       { lat: 11.01, lon: 76.97 },
  "Madurai":          { lat:  9.93, lon: 78.12 }, "Salem":            { lat: 11.67, lon: 78.15 },
  "Erode":            { lat: 11.34, lon: 77.72 }, "Tiruchirappalli":  { lat: 10.79, lon: 78.70 },
  "Tirunelveli":      { lat:  8.73, lon: 77.70 }, "Thanjavur":        { lat: 10.79, lon: 79.14 },
  "Vellore":          { lat: 12.92, lon: 79.13 }, "Cuddalore":        { lat: 11.75, lon: 79.77 },
  "Dindigul":         { lat: 10.36, lon: 77.97 }, "Tirupur":          { lat: 11.11, lon: 77.34 },
  "Namakkal":         { lat: 11.22, lon: 78.17 }, "Dharmapuri":       { lat: 12.13, lon: 78.16 },
  "Krishnagiri":      { lat: 12.52, lon: 78.22 }, "Villupuram":       { lat: 11.94, lon: 79.49 },
  "Pudukottai":       { lat: 10.38, lon: 78.82 }, "Nagapattinam":     { lat: 10.77, lon: 79.84 },

  // ── BIHAR ────────────────────────────────────────────────────────────────
  "Patna":            { lat: 25.59, lon: 85.13 }, "Gaya":             { lat: 24.80, lon: 85.00 },
  "Muzaffarpur":      { lat: 26.12, lon: 85.39 }, "Bhagalpur":        { lat: 25.25, lon: 87.01 },
  "Darbhanga":        { lat: 26.16, lon: 85.90 }, "Begusarai":        { lat: 25.42, lon: 86.13 },
  "Samastipur":       { lat: 25.86, lon: 85.78 }, "Sitamarhi":        { lat: 26.60, lon: 85.49 },
  "Madhubani":        { lat: 26.36, lon: 86.07 }, "Purnea":           { lat: 25.78, lon: 87.47 },
  "Katihar":          { lat: 25.54, lon: 87.57 }, "Chapra":           { lat: 25.78, lon: 84.74 },
  "Siwan":            { lat: 26.22, lon: 84.36 }, "Gopalganj":        { lat: 26.47, lon: 84.43 },
  "Buxar":            { lat: 25.56, lon: 83.97 }, "Nalanda":          { lat: 25.10, lon: 85.44 },
  "Nawada":           { lat: 24.89, lon: 85.54 }, "Rohtas":           { lat: 25.05, lon: 84.02 },

  // ── WEST BENGAL ──────────────────────────────────────────────────────────
  "Kolkata":          { lat: 22.57, lon: 88.36 }, "Howrah":           { lat: 22.59, lon: 88.31 },
  "Siliguri":         { lat: 26.73, lon: 88.40 }, "Burdwan":          { lat: 23.23, lon: 87.86 },
  "Malda":            { lat: 25.01, lon: 88.14 }, "Asansol":          { lat: 23.69, lon: 86.98 },
  "Durgapur":         { lat: 23.55, lon: 87.32 }, "Tamluk":           { lat: 22.46, lon: 87.92 },
  "Kolaghat":         { lat: 22.47, lon: 87.79 }, "Murshidabad":      { lat: 24.18, lon: 88.27 },
  "Bankura":          { lat: 23.23, lon: 87.07 }, "Purulia":          { lat: 23.33, lon: 86.36 },
  "Birbhum":          { lat: 23.90, lon: 87.53 }, "Jalpaiguri":       { lat: 26.54, lon: 88.73 },
  "Cooch Behar":      { lat: 26.32, lon: 89.45 },

  // ── ODISHA ───────────────────────────────────────────────────────────────
  "Bhubaneswar":      { lat: 20.30, lon: 85.82 }, "Cuttack":          { lat: 20.46, lon: 85.88 },
  "Sambalpur":        { lat: 21.47, lon: 83.97 }, "Berhampur":        { lat: 19.31, lon: 84.79 },
  "Rourkela":         { lat: 22.22, lon: 84.86 }, "Balasore":         { lat: 21.49, lon: 86.93 },
  "Baripada":         { lat: 21.93, lon: 86.73 }, "Bhadrak":          { lat: 21.05, lon: 86.50 },
  "Puri":             { lat: 19.81, lon: 85.83 }, "Ganjam":           { lat: 19.39, lon: 84.98 },
  "Kalahandi":        { lat: 19.90, lon: 83.17 }, "Bolangir":         { lat: 20.71, lon: 83.48 },
  "Bargarh":          { lat: 21.34, lon: 83.62 },

  // ── CHHATTISGARH ─────────────────────────────────────────────────────────
  "Raipur":           { lat: 21.24, lon: 81.63 }, "Bilaspur":         { lat: 22.09, lon: 82.15 },
  "Durg":             { lat: 21.19, lon: 81.28 }, "Korba":            { lat: 22.36, lon: 82.73 },
  "Rajnandgaon":      { lat: 21.10, lon: 81.03 }, "Raigarh":          { lat: 21.90, lon: 83.40 },
  "Jagdalpur":        { lat: 19.08, lon: 82.03 }, "Dhamtari":         { lat: 20.71, lon: 81.55 },

  // ── JHARKHAND ────────────────────────────────────────────────────────────
  "Ranchi":           { lat: 23.36, lon: 85.33 }, "Jamshedpur":       { lat: 22.80, lon: 86.18 },
  "Dhanbad":          { lat: 23.80, lon: 86.44 }, "Hazaribagh":       { lat: 23.99, lon: 85.36 },
  "Deoghar":          { lat: 24.48, lon: 86.70 }, "Dumka":            { lat: 24.27, lon: 87.25 },

  // ── UTTARAKHAND ──────────────────────────────────────────────────────────
  "Dehradun":         { lat: 30.32, lon: 78.03 }, "Haridwar":         { lat: 29.95, lon: 78.16 },
  "Haldwani":         { lat: 29.22, lon: 79.52 }, "Rudrapur":         { lat: 28.98, lon: 79.40 },
  "Kashipur":         { lat: 29.21, lon: 78.96 }, "Roorkee":          { lat: 29.87, lon: 77.89 },

  // ── HIMACHAL PRADESH ─────────────────────────────────────────────────────
  "Shimla":           { lat: 31.10, lon: 77.17 }, "Kangra":           { lat: 32.10, lon: 76.27 },
  "Mandi HP":         { lat: 31.71, lon: 76.93 }, "Solan":            { lat: 30.91, lon: 77.10 },
  "Kullu":            { lat: 31.96, lon: 77.11 },

  // ── ASSAM ────────────────────────────────────────────────────────────────
  "Guwahati":         { lat: 26.18, lon: 91.75 }, "Dibrugarh":        { lat: 27.47, lon: 94.91 },
  "Jorhat":           { lat: 26.75, lon: 94.22 }, "Nagaon":           { lat: 26.35, lon: 92.69 },
  "Silchar":          { lat: 24.83, lon: 92.80 }, "Tezpur":           { lat: 26.63, lon: 92.80 },

  // ── KERALA ───────────────────────────────────────────────────────────────
  "Kochi":            { lat:  9.93, lon: 76.26 }, "Thiruvananthapuram": { lat: 8.52, lon: 76.94 },
  "Kozhikode":        { lat: 11.25, lon: 75.78 }, "Thrissur":         { lat: 10.52, lon: 76.21 },
  "Kollam":           { lat:  8.88, lon: 76.60 }, "Palakkad":         { lat: 10.78, lon: 76.65 },
  "Alappuzha":        { lat:  9.49, lon: 76.32 }, "Kannur":           { lat: 11.87, lon: 75.37 },
  "Kottayam":         { lat:  9.59, lon: 76.52 }, "Malappuram":       { lat: 11.07, lon: 76.07 },

  // ── DELHI ─────────────────────────────────────────────────────────────────
  "Delhi":            { lat: 28.61, lon: 77.23 }, "Azadpur":          { lat: 28.71, lon: 77.18 },
  "Okhla":            { lat: 28.53, lon: 77.27 },
};

// ── Name normalisation ─────────────────────────────────────────────────────
// "Jasdan(Vichhiya) APMC" → "jasdan"
// "Tamluk (Medinipur E) APMC" → "tamluk"
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")        // remove (Vichhiya), (Medinipur E)
    .replace(/\b(apmc|mandi|market)\b/g, "")
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Build normalised lookup index once at module load
const _normIndex = Object.keys(MANDI_COORDS).map(k => ({
  key: k,
  norm: normalizeName(k),
}));

// ── Local dictionary lookup (4 tiers, no network) ─────────────────────────
function lookupLocalCoords(mandiName: string): { lat: number; lon: number } | null {
  // Tier 1: exact key
  if (MANDI_COORDS[mandiName]) return MANDI_COORDS[mandiName];

  const norm = normalizeName(mandiName);

  // Tier 2: exact normalised
  const exact = _normIndex.find(k => k.norm === norm);
  if (exact) return MANDI_COORDS[exact.key];

  // Tier 3: first significant word (≥4 chars)
  const firstWord = norm.split(" ")[0];
  if (firstWord.length >= 4) {
    const fw = _normIndex.find(k => k.norm.split(" ")[0] === firstWord);
    if (fw) return MANDI_COORDS[fw.key];
  }

  // Tier 4: substring — one contains the other
  const sub = _normIndex.find(k =>
    k.norm.length >= 4 && (norm.includes(k.norm) || k.norm.includes(norm))
  );
  if (sub) return MANDI_COORDS[sub.key];

  return null;
}

// ── Nominatim geocoding — via YOUR FastAPI backend ────────────────────────
//
//  WHY NOT CALL NOMINATIM DIRECTLY FROM HERE?
//  Nominatim requires a real User-Agent header. Browsers always override
//  the User-Agent header for security — you cannot set it from JavaScript.
//  So we proxy through our own FastAPI backend, which sets the header correctly.
//
//  Flow:  browser → /geocode?name=Jasdan&state=Gujarat
//                      → FastAPI → Nominatim (with proper User-Agent)
//                      ← { lat, lon }
//
//  In-memory cache on the browser side prevents calling the backend
//  more than once per session for the same mandi.
//
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";
const _nominatimCache: Record<string, { lat: number; lon: number } | null> = {};

async function geocodeViaNominatim(
  mandiName: string,
  state: string
): Promise<{ lat: number; lon: number } | null> {
  const cacheKey = `${mandiName}|${state}`;
  if (cacheKey in _nominatimCache) return _nominatimCache[cacheKey];

  try {
    const params = new URLSearchParams({ name: mandiName, state });
    const res = await fetch(`${BACKEND_URL}/geocode?${params}`);

    if (!res.ok) throw new Error(`Backend geocode returned ${res.status}`);
    const data = await res.json();

    if (data?.lat != null && data?.lon != null) {
      const coords = { lat: data.lat, lon: data.lon };
      console.log(`[Geocode] ✅ "${mandiName}" → ${coords.lat.toFixed(3)}, ${coords.lon.toFixed(3)} (${data.source})`);
      _nominatimCache[cacheKey] = coords;
      return coords;
    }

    _nominatimCache[cacheKey] = null;
    return null;
  } catch (e) {
    console.warn(`[Geocode] ❌ "${mandiName}":`, e);
    _nominatimCache[cacheKey] = null;
    return null;
  }
}

// ── Resolve mandi coords: dict → Nominatim → state centroid ───────────────
async function resolveMandiCoords(
  mandiName: string,
  state: string
): Promise<{ lat: number; lon: number; source: string }> {
  // 1. Instant local lookup — ~450 towns, no network
  const local = lookupLocalCoords(mandiName);
  if (local) return { ...local, source: "local" };

  // 2. Backend geocode proxy → Nominatim (free, covers every Indian town/village)
  const geocoded = await geocodeViaNominatim(mandiName, state);
  if (geocoded) return { ...geocoded, source: "nominatim" };

  // 3. State centroid — approximate but never ~0 km
  const centroid = STATE_CENTROIDS[state];
  if (centroid) {
    console.log(`[Mandi] State centroid fallback for "${mandiName}" (${state})`);
    return { ...centroid, source: "centroid" };
  }

  // 4. India geographic centre — absolute last resort
  return { lat: 20.59, lon: 78.96, source: "india-centre" };
}

// ── Mock prices — used when real API unavailable ───────────────────────────
function getMockMandiPrices(crop: string, state: string, lat: number, lon: number): MandiPrice[] {
  const c = crop.toLowerCase();
  const PRICES: Record<string, number> = {
    wheat: 2275, rice: 2183, paddy: 2183, maize: 1850, bajra: 2500,
    jowar: 3180, cotton: 7000, soybean: 4600, onion: 1500, potato: 1200,
    tomato: 1000, groundnut: 5550, mustard: 5650, tur: 7000, arhar: 7000,
    chana: 5440, moong: 8558, urad: 7400, sugarcane: 340, garlic: 6000, chilli: 8000,
  };
  const base = Object.entries(PRICES).find(([k]) => c.includes(k))?.[1] ?? 2000;

  const STATE_MANDIS: Record<string, { name: string; lat: number; lon: number }[]> = {
    "Gujarat":        [{ name: "Rajkot APMC",      lat: 22.30, lon: 70.80 }, { name: "Gondal APMC",     lat: 21.96, lon: 70.80 }, { name: "Junagadh APMC",  lat: 21.52, lon: 70.46 }, { name: "Amreli APMC",    lat: 21.60, lon: 71.22 }, { name: "Anand APMC",     lat: 22.55, lon: 72.95 }],
    "Maharashtra":    [{ name: "Nashik APMC",       lat: 19.99, lon: 73.79 }, { name: "Pune APMC",       lat: 18.51, lon: 73.92 }, { name: "Lasalgaon APMC", lat: 20.12, lon: 74.05 }, { name: "Solapur APMC",   lat: 17.68, lon: 75.90 }, { name: "Aurangabad APMC",lat: 19.87, lon: 75.34 }],
    "Madhya Pradesh": [{ name: "Indore APMC",       lat: 22.72, lon: 75.86 }, { name: "Ujjain APMC",     lat: 23.18, lon: 75.78 }, { name: "Ratlam APMC",    lat: 23.33, lon: 75.04 }, { name: "Bhopal APMC",    lat: 23.26, lon: 77.40 }, { name: "Khandwa APMC",   lat: 21.83, lon: 76.35 }],
    "Rajasthan":      [{ name: "Jodhpur APMC",      lat: 26.29, lon: 73.02 }, { name: "Jaipur APMC",     lat: 26.91, lon: 75.79 }, { name: "Bikaner APMC",   lat: 28.02, lon: 73.31 }, { name: "Alwar APMC",     lat: 27.55, lon: 76.61 }, { name: "Kota APMC",      lat: 25.18, lon: 75.85 }],
    "Uttar Pradesh":  [{ name: "Agra APMC",          lat: 27.18, lon: 78.01 }, { name: "Kanpur APMC",     lat: 26.45, lon: 80.33 }, { name: "Lucknow APMC",   lat: 26.85, lon: 80.95 }, { name: "Allahabad APMC", lat: 25.44, lon: 81.84 }, { name: "Varanasi APMC",  lat: 25.32, lon: 82.97 }],
    "Punjab":         [{ name: "Ludhiana APMC",     lat: 30.90, lon: 75.85 }, { name: "Amritsar APMC",   lat: 31.63, lon: 74.87 }, { name: "Jalandhar APMC", lat: 31.33, lon: 75.58 }, { name: "Patiala APMC",   lat: 30.34, lon: 76.39 }, { name: "Bathinda APMC",  lat: 30.21, lon: 74.94 }],
    "Haryana":        [{ name: "Karnal APMC",       lat: 29.68, lon: 76.99 }, { name: "Rohtak APMC",     lat: 28.89, lon: 76.58 }, { name: "Hisar APMC",     lat: 29.15, lon: 75.72 }, { name: "Panipat APMC",   lat: 29.38, lon: 76.97 }, { name: "Sirsa APMC",     lat: 29.53, lon: 75.02 }],
    "Karnataka":      [{ name: "Bangalore APMC",    lat: 13.00, lon: 77.58 }, { name: "Hubli APMC",      lat: 15.36, lon: 75.14 }, { name: "Davangere APMC", lat: 14.46, lon: 75.92 }, { name: "Mysore APMC",    lat: 12.30, lon: 76.65 }, { name: "Raichur APMC",   lat: 16.20, lon: 77.36 }],
    "Andhra Pradesh": [{ name: "Guntur APMC",       lat: 16.30, lon: 80.45 }, { name: "Kurnool APMC",    lat: 15.83, lon: 78.04 }, { name: "Vijayawada APMC",lat: 16.51, lon: 80.64 }, { name: "Nellore APMC",   lat: 14.44, lon: 79.99 }, { name: "Tirupati APMC",  lat: 13.63, lon: 79.42 }],
    "Telangana":      [{ name: "Hyderabad APMC",    lat: 17.38, lon: 78.48 }, { name: "Warangal APMC",   lat: 17.97, lon: 79.59 }, { name: "Nizamabad APMC", lat: 18.67, lon: 78.09 }, { name: "Karimnagar APMC",lat: 18.44, lon: 79.12 }, { name: "Khammam APMC",   lat: 17.25, lon: 80.15 }],
    "Tamil Nadu":     [{ name: "Chennai APMC",      lat: 13.08, lon: 80.27 }, { name: "Coimbatore APMC", lat: 11.01, lon: 76.97 }, { name: "Madurai APMC",   lat:  9.93, lon: 78.12 }, { name: "Salem APMC",     lat: 11.67, lon: 78.15 }, { name: "Erode APMC",     lat: 11.34, lon: 77.72 }],
    "Bihar":          [{ name: "Patna APMC",        lat: 25.59, lon: 85.13 }, { name: "Gaya APMC",       lat: 24.80, lon: 85.00 }, { name: "Muzaffarpur APMC",lat: 26.12, lon: 85.39}, { name: "Bhagalpur APMC", lat: 25.25, lon: 87.01 }, { name: "Darbhanga APMC", lat: 26.16, lon: 85.90 }],
    "West Bengal":    [{ name: "Kolkata APMC",      lat: 22.57, lon: 88.36 }, { name: "Siliguri APMC",   lat: 26.73, lon: 88.40 }, { name: "Burdwan APMC",   lat: 23.23, lon: 87.86 }, { name: "Malda APMC",     lat: 25.01, lon: 88.14 }, { name: "Tamluk APMC",    lat: 22.46, lon: 87.92 }],
    "Odisha":         [{ name: "Bhubaneswar APMC",  lat: 20.30, lon: 85.82 }, { name: "Cuttack APMC",    lat: 20.46, lon: 85.88 }, { name: "Sambalpur APMC", lat: 21.47, lon: 83.97 }, { name: "Berhampur APMC", lat: 19.31, lon: 84.79 }, { name: "Balasore APMC",  lat: 21.49, lon: 86.93 }],
    "Chhattisgarh":   [{ name: "Raipur APMC",       lat: 21.24, lon: 81.63 }, { name: "Bilaspur APMC",   lat: 22.09, lon: 82.15 }, { name: "Durg APMC",      lat: 21.19, lon: 81.28 }],
  };

  const mandis = STATE_MANDIS[state] ?? STATE_MANDIS["Maharashtra"];
  return mandis
    .map((m, i) => ({
      mandiName: m.name,
      distanceKm: distKm(lat, lon, m.lat, m.lon),
      modalPrice: Math.round(base * (1 + ([-0.01, 0.02, -0.02, 0.03][i] ?? 0))),
      state,
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 4);
}

// ── Main export ────────────────────────────────────────────────────────────
export async function getNearbyMandiPrices(
  crop: string,
  lat: number,
  lon: number
): Promise<MandiPrice[]> {
  const state = getStateFromCoords(lat, lon);
  console.log(`[Mandi] State: ${state}  crop: ${crop}  lat: ${lat}  lon: ${lon}`);

  if (DATAGOVIN_KEY) {
    try {
      const realPrices = await fetchRealMandiPrices(crop, state);

      // Resolve distance for every mandi using a 3-tier strategy:
      //   Tier 1 — local MANDI_COORDS dict     (instant, ~450 towns)
      //   Tier 2 — Nominatim OSM geocoding      (free, no key, covers India)
      //   Tier 3 — state centroid               (approximate, never ~0 km)
      const withDistPromises = realPrices.map(async (m) => {
        const resolved = await resolveMandiCoords(m.mandiName, state);
        const d = distKm(lat, lon, resolved.lat, resolved.lon);
        if (resolved.source !== "local") {
          console.log(`[Mandi] "${m.mandiName}" via ${resolved.source} → ${d} km`);
        }
        return { ...m, distanceKm: d };
      });

      const withDist = (await Promise.all(withDistPromises))
        .sort((a, b) => a.distanceKm - b.distanceKm);

      console.log(`[Mandi] Real API success: ${withDist.length} results for ${state}`);
      return withDist;
    } catch (err) {
      console.warn("[Mandi] Real API failed, using mock:", err);
    }
  }

  const mock = getMockMandiPrices(crop, state, lat, lon);
  console.log(`[Mandi] Mock data: ${mock.length} results for ${state}`);
  return mock;
}
