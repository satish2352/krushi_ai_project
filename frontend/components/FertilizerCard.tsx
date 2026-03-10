"use client";

import React, { useState } from "react";

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

export interface SoilGapData {
  crop: string;
  gaps: FertilizerGap[];
  fertilizer_plan: FertilizerPlan[];
  correction_steps?: string[];
  overall_status?: string;
}

interface Props {
  data: SoilGapData;
}

const statusStyle = (s: FertilizerGap["status"]) => {
  if (s === "DEFICIENT") return { bar: "bg-red-400", badge: "bg-red-50 text-red-700 border-red-200", dot: "🔴" };
  if (s === "EXCESS")    return { bar: "bg-amber-400", badge: "bg-amber-50 text-amber-700 border-amber-200", dot: "🟡" };
  return                        { bar: "bg-emerald-400", badge: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "🟢" };
};

export const FertilizerCard: React.FC<Props> = ({ data }) => {
  const [tab, setTab] = useState<"gaps" | "plan">("gaps");

  // Guard against missing data from backend
  const gaps = data.gaps ?? [];
  const fertilizerPlan = data.fertilizer_plan ?? [];
  const correctionSteps = data.correction_steps ?? [];
  const hasDeficiencies = gaps.some((g) => g.status === "DEFICIENT");

  return (
    <div className="w-full max-w-xl rounded-2xl overflow-hidden border border-slate-200 shadow-md bg-white text-sm">
      {/* Header */}
      <div className={`px-5 py-4 ${hasDeficiencies ? "bg-gradient-to-r from-amber-500 to-orange-500" : "bg-gradient-to-r from-emerald-500 to-teal-500"}`}>
        <div className="text-white/70 text-[11px] uppercase tracking-widest font-medium mb-0.5">
          Soil & Fertilizer Analysis
        </div>
        <div className="text-white font-bold text-lg capitalize">{data.crop}</div>
        <div className="text-white/80 text-xs mt-0.5">
          {hasDeficiencies
            ? `${data.gaps.filter(g => g.status === "DEFICIENT").length} nutrient deficiency detected`
            : "Soil nutrients are well balanced"}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-100">
        {(["gaps", "plan"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-wide transition
              ${tab === t ? "text-emerald-700 border-b-2 border-emerald-500 bg-emerald-50/50" : "text-slate-400 hover:text-slate-600"}`}
          >
            {t === "gaps" ? "🧪 Soil Gaps" : "💊 Fertilizer Plan"}
          </button>
        ))}
      </div>

      {/* Soil Gaps Tab */}
      {tab === "gaps" && (
        <div className="px-4 py-3 space-y-3">
          {gaps.map((gap) => {
            const style = statusStyle(gap.status);
            const pct = Math.min((gap.current / gap.required_max) * 100, 100);
            return (
              <div key={gap.nutrient} className="bg-slate-50 rounded-xl px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{style.dot}</span>
                    <span className="font-bold text-slate-800">
                      {gap.nutrient === "N" ? "Nitrogen (N)" : gap.nutrient === "P" ? "Phosphorus (P)" : gap.nutrient === "K" ? "Potassium (K)" : gap.nutrient}
                    </span>
                  </div>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${style.badge}`}>
                    {gap.status}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden mb-1.5">
                  <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>Current: <strong className="text-slate-700">{gap.current}</strong></span>
                  <span>Target: <strong className="text-slate-700">{gap.required_min}–{gap.required_max}</strong></span>
                </div>
                {gap.status === "DEFICIENT" && gap.deficit != null && (
                  <div className="mt-1.5 text-[11px] text-red-600 font-medium">
                    Deficit: {gap.deficit.toFixed(1)} units — needs correction
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Fertilizer Plan Tab */}
      {tab === "plan" && (
        <div className="px-4 py-3 space-y-3">
          {fertilizerPlan.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-sm">
              🌱 No fertilizer needed — soil is well balanced!
            </div>
          ) : (
            fertilizerPlan.map((item, i) => (
              <div key={i} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-slate-800 text-sm">{item.product}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{item.nutrient}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-extrabold text-emerald-700 text-base">{item.quantity_kg_acre} kg</div>
                    <div className="text-[11px] text-slate-400">per acre</div>
                  </div>
                </div>
                <div className="mt-2 text-[11px] text-slate-600 bg-slate-50 rounded-lg px-3 py-1.5">
                  📋 {item.application}
                </div>
                {item.alternative && (
                  <div className="mt-1.5 text-[11px] text-amber-700">
                    Alternative: {item.alternative}
                  </div>
                )}
              </div>
            ))
          )}

          {correctionSteps.length > 0 && (
            <div className="mt-1">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Step-by-step correction
              </div>
              <ol className="space-y-1.5">
                {correctionSteps.map((step, i) => (
                  <li key={i} className="flex gap-2 text-[11px] text-slate-600">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px] flex items-center justify-center">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
