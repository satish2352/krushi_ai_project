"use client";

import React from "react";
import { MandiPrice } from "../types";

interface Props {
  prices: MandiPrice[];
  crop?: string;
}

export const MandiCard: React.FC<Props> = ({ prices, crop }) => {
  if (!prices || prices.length === 0) return null;

  const sorted = [...prices].sort((a, b) => b.modalPrice - a.modalPrice);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  const priceDiff = best.modalPrice - worst.modalPrice;

  return (
    <div className="w-full max-w-sm rounded-2xl overflow-hidden border border-slate-200 shadow-md bg-white text-sm">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3">
        <div className="text-white/70 text-[11px] uppercase tracking-widest font-medium mb-0.5">
          Nearby Mandi Prices
        </div>
        <div className="text-white font-bold text-base capitalize">
          {crop ?? "Crop"} Market Rates
        </div>
        <div className="text-white/80 text-xs mt-0.5">
          Best rate: ₹{best.modalPrice}/qt at {best.mandiName}
        </div>
      </div>

      {/* Price list */}
      <div className="divide-y divide-slate-50">
        {sorted.map((m, i) => {
          const isBest = i === 0;
          return (
            <div key={i} className={`flex items-center justify-between px-4 py-3 ${isBest ? "bg-violet-50/60" : "bg-white"}`}>
              <div className="flex items-center gap-2.5">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0
                  ${isBest ? "bg-violet-200 text-violet-800" : "bg-slate-100 text-slate-500"}`}>
                  {i + 1}
                </div>
                <div>
                  <div className={`font-semibold text-xs ${isBest ? "text-violet-900" : "text-slate-700"}`}>
                    {m.mandiName}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {m.state} {m.distanceKm > 0 ? `· ~${m.distanceKm} km` : ""}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className={`font-extrabold text-sm ${isBest ? "text-violet-700" : "text-slate-600"}`}>
                  ₹{m.modalPrice}
                </div>
                <div className="text-[11px] text-slate-400">per quintal</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Price spread tip */}
      {priceDiff > 0 && (
        <div className="px-4 py-2.5 bg-indigo-50 border-t border-indigo-100">
          <div className="text-[11px] text-indigo-700 font-medium">
            💡 Price spread ₹{priceDiff}/qt — selling at {best.mandiName} gives best return.
          </div>
        </div>
      )}
    </div>
  );
};
