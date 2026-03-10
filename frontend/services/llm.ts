import { MandiPrice, WeatherSummary } from "../types";

const GROQ_MODEL = "llama-3.3-70b-versatile";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

export interface ChatHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ConversationalInput {
  userMessage: string;
  cropPrediction?: unknown;
  pestPrediction?: unknown;
  yieldPrediction?: unknown;
  weather?: WeatherSummary | null;
  mandiPrices?: MandiPrice[] | null;
  location?: { lat: number; lon: number } | null;
  hasYieldDashboard?: boolean;
  hasFertilizerDashboard?: boolean;
  hasMandiCard?: boolean;
  hasWeatherCard?: boolean;
  conversationHistory?: ChatHistoryMessage[];
}

function buildPrompt(p: ConversationalInput): string {
  const lang = /[\u0900-\u097F]/.test(p.userMessage) ||
    /\b(meri|mera|kya|karo|batao|chahiye|fasal|khad|keeda|baarish|mausam|pani|kheti|gehu|gehun|chawal|sarso|til|makka|kapas|tur|arhar)\b/i.test(p.userMessage)
    ? "Hindi (Hinglish style — mix of Hindi and simple English)"
    : "English";

  const isShopQuery = /buy|shop|pesticide|seed|machine|spawn|supply|share.*pesticide|show.*pesticide/i.test(p.userMessage);
  const isWeatherQuery = /weather|mausam|temperature|rain|humidity/i.test(p.userMessage);
  const isMandiQuery = /mandi|price|rate|bhav|sell/i.test(p.userMessage);
  const isFertilizerQuery = /fertilizer|fertiliser|khad|urea|dap|nutrient/i.test(p.userMessage);
  const isCropQuery = !!p.cropPrediction;
  const isPestQuery = !!p.pestPrediction;

  // ── Crop context for Groq ─────────────────────────────────────────────────
  // Priority: user-named crop in message > ML recommendation
  // This fixes "fertilizer for mustard" returning "Fertilizer for Your Rice Crop"
  // because ML ran and set cropPrediction to rice from the previous soil upload.
  // MUST be defined before isGenericPestQuery which references userNamedCrop.
  const KNOWN_CROPS = [
    "rice","wheat","maize","cotton","sugarcane","onion","tomato","potato","soybean",
    "groundnut","bajra","jowar","tur","arhar","chana","moong","urad","mustard",
    "sunflower","ginger","turmeric","garlic","chilli","barley","lentil","chickpea",
    "mungbean","blackgram","pigeonpeas","kidneybeans","mothbeans","mushroom",
    "strawberry","banana","mango","papaya","grapes","coconut","pomegranate",
  ];
  const msgLower = p.userMessage.toLowerCase();
  const userNamedCrop = KNOWN_CROPS.find(c => new RegExp(`\\b${c}\\b`).test(msgLower));

  // Generic pest = user asked about pesticide/pest but did NOT name any crop
  const isGenericPestQuery = isPestQuery && !userNamedCrop && !p.cropPrediction;

  // Tell LLM what cards are already visible so it doesn't repeat
  const cardsShown: string[] = [];
  if (p.hasWeatherCard) cardsShown.push("Weather Card (temperature, humidity, rainfall, risk alerts)");
  if (p.hasMandiCard) cardsShown.push("Mandi Price Card (market rates, best price, distance)");
  if (p.hasYieldDashboard) cardsShown.push("Yield & Profit Dashboard (yield tons, revenue, profit margin, breakeven)");
  if (p.hasFertilizerDashboard) cardsShown.push("Fertilizer Plan Card (nutrient gaps, fertilizer doses, correction steps)");
  // AgriShop card always shown if crop + shop query
  if (isShopQuery) cardsShown.push("Farm Inputs Card (pesticides with buy links, seeds, machinery, nearby shops on Google Maps)");

  const cardNote = cardsShown.length > 0
    ? `\nCARDS ALREADY SHOWN TO USER (do NOT repeat this data in your text):\n${cardsShown.map(c => `- ${c}`).join("\n")}\n`
    : "";

  // Length instruction based on query type
  const lengthRule = isShopQuery
    ? "KEEP RESPONSE SHORT: 2-4 lines only. The cards below have all the product details. Just confirm what they'll find."
    : isWeatherQuery && !isCropQuery
    ? "KEEP RESPONSE SHORT: 3-5 lines. Weather card is shown. Just summarize risk and one action tip."
    : isMandiQuery && !isCropQuery
    ? "KEEP RESPONSE SHORT: 3-5 lines. Mandi card is shown. Just give selling advice."
    : isFertilizerQuery && !p.cropPrediction
    ? "MEDIUM LENGTH: 6-10 lines. Give practical fertilizer advice. If soil data available, be specific."
    : "MEDIUM LENGTH: 8-12 lines maximum. Be practical and direct.";

  const cropLockNote = (() => {
    // Case 0: Generic pest query — user asked about pesticide with no crop named.
    // Do NOT talk about any crop. Give general advice on identifying and treating pests.
    if (isGenericPestQuery) return "";

    // Case 1: User explicitly named a crop in their message (fertilizer for mustard, yield for wheat etc.)
    if (userNamedCrop) {
      return [
        `\nCROP CONTEXT:`,
        `The user is asking about: "${userNamedCrop}".`,
        `All your advice must be specific to ${userNamedCrop} — its NPK needs, growing season, and care.`,
        `Do NOT mention any other crop (including rice, wheat, or anything from previous conversation).`,
        `Do NOT reference ML crop recommendations unless the user is asking which crop to grow.`,
      ].join("\n");
    }

    // Case 2: ML picked a crop (user asked "which crop should I grow")
    if (!p.cropPrediction) return "";
    const pred = p.cropPrediction as any;
    const top  = pred?.recommendations?.[0];
    if (!top) return "";
    const cropName     = top.crop;
    const confidence   = top.confidence_pct ?? `${Math.round((top.confidence ?? 0.5) * 100)}%`;
    const riskLevel    = top.risk_level ?? "Medium";
    const reason       = top.reason ?? "";
    const rainfallOk   = top.rainfall_suitable !== false;
    const rainfallWarn = top.rainfall_warning ?? null;

    return [
      `\nML CROP DECISION (FINAL — DO NOT OVERRIDE):`,
      `System selected: "${cropName}" (${confidence} confidence, ${riskLevel} risk).`,
      `Your ONLY job: explain WHY ${cropName} suits this farmer\'s soil. Be positive and specific.`,
      `NEVER suggest a different crop. NEVER say ${cropName} is a bad choice.`,
      reason ? `ML reasoning: ${reason}` : "",
      !rainfallOk && rainfallWarn
        ? `Rainfall note (mention once, briefly): ${rainfallWarn}`
        : `Rainfall is adequate for ${cropName} — do NOT mention water shortage.`,
    ].filter(Boolean).join("\n");
  })();

  // ── Non-standard crop guidance (user picks their own crop, no ML) ──────────
  const userPickNote = (() => {
    if (p.cropPrediction) return ""; // ML already picked — cropLockNote handles it
    const msg = p.userMessage.toLowerCase();
    const nonStandard = ["mushroom","strawberry","rose","marigold","jasmine","brinjal","cabbage","cauliflower","spinach","carrot","cucumber","capsicum","peas","beans","banana","mango","papaya"];
    const userCrop = nonStandard.find(c => new RegExp(`\\b${c}\\b`).test(msg));
    if (userCrop) {
      return `\nUSER WANTS TO GROW: "${userCrop}" — their own choice, no ML involved. Give advice on:\n1. Is current season suitable for ${userCrop} in India?\n2. Soil pH and organic matter needed\n3. Best sowing time\n4. Key care tips (water, shade, temperature)\nDo NOT suggest other crops.`;
    }
    return "";
  })();

  // ── Improvement / "what changes" query ───────────────────────────────────
  // Fires when user asks what changes/steps are needed to grow something.
  // Works for ANY crop or situation — not crop-specific.
  // Does NOT interfere with crop recommendation, pest, yield, weather, or mandi flows.
  const improvementQueryNote = (() => {
    const isImprovementQuery = /what changes|changes needed|changes to grow|changes required|how can i grow|what do i need to grow|requirements to grow|conditions to grow|improve.*soil|soil.*improve|what.*need.*grow|kya karna padega|kya badlav|kya sudhaar|sudharna chahiye|growing conditions|ugane ke liye kya/i.test(p.userMessage);
    if (!isImprovementQuery) return "";
    return [
      `\nUSER IS ASKING WHAT CHANGES OR STEPS ARE NEEDED — CRITICAL INSTRUCTIONS:`,
      `The user wants a practical TO-DO list — NOT a yes/no verdict on whether it is possible.`,
      `DO NOT say the crop is impossible. DO NOT reject or discourage. DO NOT just list problems.`,
      `Structure your response as actionable steps:`,
      `1. Soil changes needed (pH target, organic matter, drainage improvement)`,
      `2. Nutrient/fertilizer adjustments required`,
      `3. Climate or environment adaptations (shade net, drip irrigation, mulching, windbreak, etc.)`,
      `4. Honest difficulty level: easy / moderate / challenging — one line only`,
      `End with the FIRST concrete action the farmer should take this week.`,
      `Be a helpful advisor giving a roadmap — not a gatekeeper saying it cannot be done.`,
    ].join("\n");
  })();

  // ── Generic pest guidance (no crop named) ────────────────────────────────
  const genericPestNote = isGenericPestQuery
    ? [
        `\nPEST QUERY — NO CROP SPECIFIED:`,
        `User asked a general question about which pesticide to use.`,
        `Do NOT mention any specific crop (not rice, not wheat, nothing).`,
        `Give general advice:`,
        `1. Ask or mention they should check which pest/insect they see on their crop`,
        `2. Common broad-spectrum pesticides for Indian farms (Chlorpyrifos, Malathion, Mancozeb)`,
        `3. When to spray — morning or evening, not in rain`,
        `4. Safety: wear gloves, mask, keep children away`,
        `Keep it practical and short — 6-8 lines max.`,
      ].join("\n")
    : "";

  return [
    `You are Krishi AI — a helpful farming assistant for Indian farmers.`,
    `Respond in: ${lang}`,
    `Tone: Simple, direct, practical. Like a knowledgeable friend, not a report writer.`,
    `Format: Use ## for main heading, bullet points with - for lists. NO ####. NO "####". Use only # ## ### headings.`,
    lengthRule,
    cardNote,
    cropLockNote,
    improvementQueryNote,
    userPickNote,
    genericPestNote,
    ``,
    `User asked: "${p.userMessage}"`,
    ``,
    p.cropPrediction ? `Crop ML Result: ${JSON.stringify(p.cropPrediction)}` : "",
    p.pestPrediction ? `Pest ML Result: ${JSON.stringify(p.pestPrediction)}` : "",
    p.yieldPrediction && !p.hasYieldDashboard ? `Yield Result: ${JSON.stringify(p.yieldPrediction)}` : "",
    !p.hasWeatherCard && p.weather ? `Weather: ${JSON.stringify(p.weather)}` : "",
    !p.hasMandiCard && p.mandiPrices?.length ? `Mandi Prices: ${JSON.stringify(p.mandiPrices)}` : "",
    p.location ? `Location: lat ${p.location.lat.toFixed(2)}, lon ${p.location.lon.toFixed(2)}` : "",
    ``,
    `Now write your response. Be brief, clear, and useful for a farmer.`,
    `End with one specific action they should do TODAY or THIS WEEK.`,
  ].filter(Boolean).join("\n");
}

export async function generateConversationalResponse(
  payload: ConversationalInput
): Promise<string> {
const apiKey = process.env.NEXT_PUBLIC_GROQ_API_KEY;
if (!apiKey) return buildFallbackResponse(payload);

  if (!apiKey) return buildFallbackResponse(payload);

  try {
    const res = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          ...(payload.conversationHistory ?? []).slice(-8).map(m => ({ role: m.role, content: m.content })),
          { role: "user", content: buildPrompt(payload) },
        ],
        max_tokens: 600,
        temperature: 0.6,
      })
    });

    const data: any = await res.json().catch(() => null);
    if (!res.ok) { console.error("Groq error", res.status, data); return buildFallbackResponse(payload); }

    const text = data?.choices?.[0]?.message?.content;
    if (!text) return buildFallbackResponse(payload);
    return text;
  } catch (e) {
    console.error("Groq fetch error", e);
    return buildFallbackResponse(payload);
  }
}

function buildFallbackResponse(p: ConversationalInput): string {
  const lines: string[] = ["## Krishi AI"];
  if (p.cropPrediction) {
    const pred = p.cropPrediction as any;
    const top = pred?.recommendations?.[0];
    if (top) lines.push(`Top crop for your soil: **${top.crop}** (${top.confidence_pct?.toFixed(1)}% confidence)`);
  }
  if (p.pestPrediction) {
    const pest = p.pestPrediction as any;
    lines.push(`Pest risk: **${pest?.risk_level ?? "Medium"}** — monitor your crop this week.`);
  }
  if (p.mandiPrices?.length && !p.hasMandiCard) {
    const best = p.mandiPrices[0];
    lines.push(`Best mandi rate: ₹${best.modalPrice}/qt at ${best.mandiName} (~${best.distanceKm} km)`);
  }
  if (!lines[1]) lines.push("Check the cards below for your farm data.");
  return lines.join("\n");
}
