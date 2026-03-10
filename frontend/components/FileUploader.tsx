"use client";

import React, { useRef, useState } from "react";
import { CropPredictionInput } from "../types";

interface Props {
  onParsed: (data: Partial<CropPredictionInput>) => void;
  onClear?: () => void;
  hasData?: boolean;
}

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

// Convert file to base64
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]); // strip data:...;base64, prefix
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Parse NPK/pH from plain text (CSV or text fallback)
function parseTextForSoilData(text: string): Partial<CropPredictionInput> {
  const lines = text.trim().split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  // --- CSV format: find header row, use EXACT column name matching ---
  // Supports any number of columns e.g.:
  // N,P,K,temperature,humidity,ph,rainfall,label
  // 90,42,43,20.8,82.0,6.5,202.9,rice
  if (lines.length >= 2) {
    const headers = lines[0].split(",").map(h => h.trim().toLowerCase());

    // Use first data row (skip header)
    const values = lines[1].split(",").map(v => parseFloat(v.trim()));

    // Exact column name lookup — no fuzzy matching
    const col = (exactNames: string[]): number | undefined => {
      for (const name of exactNames) {
        const i = headers.indexOf(name);
        if (i !== -1 && i < values.length && !isNaN(values[i])) {
          return values[i];
        }
      }
      return undefined;
    };

    const N         = col(["n", "nitrogen"]);
    const P         = col(["p", "phosphorus", "phosphorous"]);
    const K         = col(["k", "potassium"]);
    const ph        = col(["ph"]);
    const rainfall  = col(["rainfall", "rain"]);
    const temp      = col(["temperature", "temp", "temperature_celsius"]);
    const humidity  = col(["humidity"]);

    // pH sanity check: must be between 3 and 14
    const safePh = ph != null && ph >= 3 && ph <= 14 ? ph : undefined;

    if (N != null || P != null || K != null) {
      return { N, P, K, ph: safePh, rainfall, temperature: temp, humidity };
    }
  }

  // --- Fallback: key:value line format ---
  // e.g. "Nitrogen: 80" or "pH = 6.8"
  const grabLine = (keys: string[]): number | undefined => {
    for (const key of keys) {
      const re = new RegExp(`^${key}\\s*[=:\\s]\\s*([0-9]+(?:\\.[0-9]+)?)`, "im");
      const m = text.match(re);
      if (m) return Number(m[1]);
    }
    return undefined;
  };

  const ph = grabLine(["ph"]);
  return {
    N: grabLine(["nitrogen", "n"]),
    P: grabLine(["phosphorus", "phosphorous", "p"]),
    K: grabLine(["potassium", "k"]),
    ph: ph != null && ph >= 3 && ph <= 14 ? ph : undefined,
    rainfall: grabLine(["rainfall", "rain"]),
  };
}

// Use Groq LLaMA vision to parse soil report image/PDF
async function parseWithGroqVision(
  base64: string,
  mimeType: string,
  apiKey: string
): Promise<Partial<CropPredictionInput>> {
  const body = {
    model: "llama-3.2-11b-vision-preview",
    max_tokens: 300,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: `data:${mimeType};base64,${base64}` },
          },
          {
            type: "text",
            text: `This is a soil test report. Extract ONLY these values and respond in this exact JSON format, nothing else:
{"N": <number or null>, "P": <number or null>, "K": <number or null>, "ph": <number or null>, "rainfall": <number or null>}
If a value is not present, use null. N = Nitrogen (kg/ha), P = Phosphorus (kg/ha), K = Potassium (kg/ha), ph = soil pH.`,
          },
        ],
      },
    ],
  };

  const res = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Groq vision error ${res.status}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content ?? "";

  // Parse JSON from response
  const jsonMatch = text.match(/\{[^}]+\}/);
  if (!jsonMatch) throw new Error("No JSON found in Groq response");
  const parsed = JSON.parse(jsonMatch[0]);

  return {
    N: parsed.N ?? undefined,
    P: parsed.P ?? undefined,
    K: parsed.K ?? undefined,
    ph: parsed.ph ?? undefined,
    rainfall: parsed.rainfall ?? undefined,
  };
}

export const FileUploader: React.FC<Props> = ({ onParsed, onClear, hasData }) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseStatus, setParseStatus] = useState<"idle" | "success" | "error">("idle");

  const handleClick = () => inputRef.current?.click();

  const handleClear = () => {
    setFileName(null);
    setParseStatus("idle");
    if (inputRef.current) inputRef.current.value = "";
    onClear?.();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setParsing(true);
    setParseStatus("idle");

    try {
      const isImage = file.type.startsWith("image/");
      const isPdf = file.type === "application/pdf";
      const isCsv = file.type === "text/csv" || file.name.endsWith(".csv");
      const isTxt = file.name.endsWith(".txt");

      const apiKey =
        process.env.NEXT_PUBLIC_GROQ_API_KEY || "";

      // Image or PDF → try Groq vision first
      if ((isImage || isPdf) && apiKey) {
        try {
          const base64 = await fileToBase64(file);
          const mimeType = isPdf ? "application/pdf" : file.type;
          const result = await parseWithGroqVision(base64, mimeType, apiKey);
          onParsed(result);
          setParseStatus("success");
          return;
        } catch (visionErr) {
          console.warn("Groq vision failed, falling back to text parse:", visionErr);
        }
      }

      // CSV or text fallback
      if (isCsv || isTxt || isImage || isPdf) {
        const text = await file.text();
        const result = parseTextForSoilData(text);
        onParsed(result);
        setParseStatus("success");
      }
    } catch (err) {
      console.error("File parse error:", err);
      setParseStatus("error");
    } finally {
      setParsing(false);
      // Reset so same file can be re-uploaded
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={parsing}
        className={`rounded-full border px-3 py-1.5 text-xs shadow-sm transition flex items-center gap-1.5
          ${parsing
            ? "border-slate-200 bg-slate-50 text-slate-400 cursor-wait"
            : parseStatus === "success"
            ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            : parseStatus === "error"
            ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
      >
        {parsing ? (
          <>
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
            Reading...
          </>
        ) : parseStatus === "success" ? (
          <>✓ Soil read</>
        ) : parseStatus === "error" ? (
          <>⚠ Retry</>
        ) : (
          <>📄 Soil report</>
        )}
      </button>

      {/* Filename display */}
      {fileName && !parsing && (
        <span className="truncate text-[11px] text-slate-400 max-w-[80px]">
          {fileName}
        </span>
      )}

      {/* Unattach button — shown when soil data is loaded */}
      {parseStatus === "success" && (
        <button
          type="button"
          onClick={handleClear}
          title="Remove soil data"
          className="flex items-center justify-center h-5 w-5 rounded-full bg-slate-100 hover:bg-red-50 hover:text-red-500 text-slate-400 text-xs transition border border-slate-200 hover:border-red-200"
        >
          ✕
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".csv,.txt,application/pdf,image/jpeg,image/png,image/jpg"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
};
