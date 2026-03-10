import {
  CropPredictionInput,
  PestPredictionInput,
  YieldPredictionInput,
  SoilGapInput,
} from "../types";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/+$/, "") ||
  "http://127.0.0.1:8000";

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const url = `${BACKEND_URL}${path}`;
  // console.log("Calling backend API", { url, body });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Backend error (${res.status}): ${text || res.statusText}`);
  }

  return (await res.json()) as T;
}

export async function predictCrop(input: CropPredictionInput) {
  return postJson<unknown>("/predict/crop", input);
}

export async function predictPest(input: PestPredictionInput) {
  return postJson<unknown>("/predict/pest", input);
}

export async function predictYield(input: YieldPredictionInput) {
  return postJson<unknown>("/predict/yield", input);
}

export async function getSoilGapAnalysis(input: SoilGapInput) {
  return postJson<unknown>("/soil/gap-analysis", input);
}
