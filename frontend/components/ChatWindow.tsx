"use client";

import React, { useMemo, useRef, useState, useEffect } from "react";
import { Message, Location, CropPredictionInput, AgriShopData, FertilizerDashboardData, WeatherSummary, MandiPrice, YieldDashboardData } from "../types";
import { MessageBubble } from "./MessageBubble";
import { InputBar } from "./InputBar";
import { FileUploader } from "./FileUploader";
import { LocationButton } from "./LocationButton";
import { LoadingIndicator } from "./LoadingIndicator";
import { handleUserMessage } from "../services/router";
import { YieldDashboard } from "./YieldDashboard";
import { ExportChatButton } from "./ExportChatButton";
import { WeatherCard } from "./WeatherCard";
import { MandiCard } from "./MandiCard";
import { FertilizerCard } from "./FertilizerCard";
import { AgriShopCard } from "./AgriShopCard";

const initialMessages: Message[] = [
  {
    id: "welcome",
    role: "assistant",
    content: "Namaste! 🌾 I am Krishi AI.\n\nI can help you with:\n* **Crop recommendation** — share your soil NPK, pH values\n* **Soil & fertilizer plan** — upload your soil report\n* **Yield & profit forecast** — tell me your acres and crop\n* **Mandi prices** — ask for rates near your location\n* **Weather & farm risks** — enable location for live data\n* **Pesticides, seeds & machinery** — ask for any crop\n* **Growing any crop** — mushroom, strawberry, or any choice\n\nTip: Press 📍 to share your location for mandi prices and weather.",
    createdAt: new Date().toISOString(),
  }
];

export const ChatWindow: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [location, setLocation] = useState<Location | undefined>();
  const [soilData, setSoilData] = useState<Partial<CropPredictionInput> | undefined>();
  // Each time location or soil is set OR cleared, the generation ID increments.
  // This lets us tag every message with the context it was generated under,
  // so when context is removed, we can exclude those messages from LLM history.
  // Result: Groq never "remembers" data the user has explicitly cleared.
  const [locationGenId, setLocationGenId] = useState(0);
  const [soilGenId, setSoilGenId] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      if (containerRef.current) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
      }
    });
  };

  useEffect(() => { scrollToBottom(); }, [messages]);

  const hasLoadingMessage = useMemo(() => messages.some((m) => m.isLoading), [messages]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`, role: "user",
      content: trimmed, createdAt: new Date().toISOString(),
      locationGenId, soilGenId,
    };
    const loadingMsg: Message = {
      id: `loading-${Date.now()}`, role: "assistant",
      content: "", isLoading: true, createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg, loadingMsg]);
    setInput("");
    setIsSending(true);

    try {
      // Build conversation history from previous messages for memory
      // Only include messages generated under the CURRENT location and soil context.
      // When user clears location or soil, the genId increments — old messages
      // (tagged with the previous genId) are excluded. Groq starts fresh.
      const conversationHistory = messages
        .filter(m => !m.isLoading && m.content.trim() && m.role !== "system")
        .filter(m => {
          // System messages (welcome, location-added, soil-added) have no genId — always include
          if (m.locationGenId === undefined && m.soilGenId === undefined) return true;
          // Exclude if generated under a different location context
          if (m.locationGenId !== undefined && m.locationGenId !== locationGenId) return false;
          // Exclude if generated under a different soil context
          if (m.soilGenId !== undefined && m.soilGenId !== soilGenId) return false;
          return true;
        })
        .slice(-10)
        .map(m => ({ role: m.role as "user" | "assistant", content: m.content.slice(0, 600) }));

      const result = await handleUserMessage({ message: trimmed, location, uploadedSoilData: soilData, conversationHistory });

      const assistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: result.reply,
        createdAt: new Date().toISOString(),
        yieldDashboard:      result.yieldDashboard,
        fertilizerDashboard: result.fertilizerDashboard,
        weatherData:         result.weather as any,
        mandiPrices:         result.mandiPrices ?? undefined,
        cropName:            result.cropName,
        agriShopData:        result.agriShopData,
        cropPrediction:      result.cropPrediction,
        pestPrediction:      result.pestPrediction,
        locationGenId, soilGenId,
      };

      setMessages((prev) => prev.filter((m) => !m.isLoading).concat(assistantMsg));
    } catch (error: any) {
      console.error("ChatWindow.handleSend error:", error);
      setMessages((prev) => prev.filter((m) => !m.isLoading).concat({
        id: `error-${Date.now()}`, role: "assistant",
        content: `⚠️ Something went wrong: ${error?.message ?? "Unknown error"}\n\nPlease check:\n* Backend is running at http://localhost:8000\n* Your Groq API key is set in \`.env.local\``,
        createdAt: new Date().toISOString(),
      }));
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleLocation = (loc: Location) => {
    setLocation(loc);
    setLocationGenId(id => id + 1);
    setMessages((prev) => [...prev, {
      id: `loc-${Date.now()}`, role: "assistant",
      content: `📍 Got your location (${loc.lat.toFixed(3)}, ${loc.lon.toFixed(3)}). I will now use this for live weather, mandi prices, and nearby shop recommendations.`,
      createdAt: new Date().toISOString(),
    }]);
  };

  const handleLocationClear = () => {
    setLocation(undefined);
    setLocationGenId(id => id + 1);
    setMessages((prev) => [...prev, {
      id: `loc-clear-${Date.now()}`, role: "assistant",
      content: "📍 Location removed. Mandi prices and weather will use default data until you share your location again.",
      createdAt: new Date().toISOString(),
    }]);
  };

  const handleSoilParsed = (data: Partial<CropPredictionInput>) => {
    setSoilData(data);
    setSoilGenId(id => id + 1);
    const parts: string[] = [];
    if (data.N != null) parts.push(`N: ${data.N}`);
    if (data.P != null) parts.push(`P: ${data.P}`);
    if (data.K != null) parts.push(`K: ${data.K}`);
    if (data.ph != null) parts.push(`pH: ${data.ph}`);
    if (data.rainfall != null) parts.push(`Rainfall: ${data.rainfall} mm`);
    const text = parts.length > 0
      ? `📋 Soil report read:\n\n${parts.map(p => `• ${p}`).join("\n")}\n\nNow ask: *"Which crop should I grow?"* or *"What fertilizer do I need for wheat?"*`
      : "📋 Soil report received. Ask which crop is suitable.";
    setMessages((prev) => [...prev, {
      id: `soil-${Date.now()}`, role: "assistant",
      content: text, createdAt: new Date().toISOString(),
    }]);
  };

  const handleSoilClear = () => {
    setSoilData(undefined);
    setSoilGenId(id => id + 1);
    setMessages((prev) => [...prev, {
      id: `soil-clear-${Date.now()}`, role: "assistant",
      content: "📋 Soil report removed. Answers will now use general defaults until you upload a new report.",
      createdAt: new Date().toISOString(),
    }]);
  };

  return (
    <div className="flex h-full w-full items-stretch">
      <div className="flex h-full w-full flex-col rounded-3xl bg-white/90 shadow-xl ring-1 ring-slate-100 backdrop-blur-md animate-shell overflow-hidden">

        {/* ── Header ─────────────────────────────────────────────── */}
        <header className="flex-shrink-0 flex items-center justify-between border-b border-slate-100 px-5 py-3 bg-white z-10">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-emerald-100 text-lg">🌿</div>
              <div className="text-sm font-semibold text-slate-900">Krishi AI Assistant</div>
            </div>
            <div className="text-[11px] text-slate-500">
              Crop · Soil · Yield · Weather · Mandi · Inputs
            </div>
          </div>
          <ExportChatButton messages={messages} />
          {location && (
            <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] text-emerald-700 border border-emerald-100">
              <span>📍</span>
              <span>{location.lat.toFixed(2)}, {location.lon.toFixed(2)}</span>
            </div>
          )}
        </header>

        {/* ── Messages ──────────────────────────────────────────── */}
        <main ref={containerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
          {messages.map((m) =>
            m.isLoading ? (
              <div key={m.id} className="flex justify-start">
                <div className="rounded-2xl bg-slate-50 px-4 py-3 shadow-sm border border-slate-100">
                  <LoadingIndicator />
                </div>
              </div>
            ) : (
              <div key={m.id} className="flex flex-col gap-3 w-full">
                {/* Text bubble */}
                <MessageBubble message={m} />

                {/* Weather card */}
                {m.weatherData && (m.weatherData.temperature != null || m.weatherData.condition != null) && (
                  <div className="flex justify-start w-full">
                    <WeatherCard weather={m.weatherData as any} />
                  </div>
                )}

                {/* Mandi card */}
                {m.mandiPrices && m.mandiPrices.length > 0 && (
                  <div className="flex justify-start w-full">
                    <MandiCard prices={m.mandiPrices} crop={m.cropName} />
                  </div>
                )}

                {/* Yield dashboard */}
                {m.yieldDashboard && (
                  <div className="flex justify-start w-full">
                    <YieldDashboard data={m.yieldDashboard} />
                  </div>
                )}

                {/* Fertilizer card */}
                {m.fertilizerDashboard && (
                  <div className="flex justify-start w-full">
                    <FertilizerCard data={m.fertilizerDashboard} />
                  </div>
                )}

                {/* AgriShop card */}
                {m.agriShopData && (
                  <div className="flex justify-start w-full">
                    <AgriShopCard data={m.agriShopData} />
                  </div>
                )}
              </div>
            )
          )}
        </main>

        {/* ── Footer — STICKY, never scrolls ────────────────────── */}
        <footer className="flex-shrink-0 border-t border-slate-100 bg-white px-4 pt-2 pb-3 z-10">
          {/* Soil report + Location buttons */}
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileUploader onParsed={handleSoilParsed} onClear={handleSoilClear} hasData={!!soilData} />
              <LocationButton onLocation={handleLocation} onClear={handleLocationClear} hasLocation={!!location} />
            </div>
            <div className="hidden md:block text-[11px] text-slate-400">
              {location ? `📍 Location active` : `Enable location for mandi & weather`}
            </div>
          </div>

          {/* Input bar */}
          <InputBar
            value={input}
            onChange={setInput}
            onSend={handleSend}
            disabled={isSending || hasLoadingMessage}
          />
        </footer>

      </div>
    </div>
  );
};
