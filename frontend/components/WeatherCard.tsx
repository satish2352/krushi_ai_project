"use client";

import React from "react";
import { ExtendedWeatherSummary } from "../services/weather";

interface Props {
  weather: ExtendedWeatherSummary;
}

const riskColor = (level?: "Low" | "Medium" | "High") => {
  if (level === "High") return "text-red-600 bg-red-50 border-red-200";
  if (level === "Medium") return "text-amber-600 bg-amber-50 border-amber-200";
  return "text-emerald-600 bg-emerald-50 border-emerald-200";
};

const riskIcon = (level?: "Low" | "Medium" | "High") => {
  if (level === "High") return "🔴";
  if (level === "Medium") return "🟡";
  return "🟢";
};

export const WeatherCard: React.FC<Props> = ({ weather }) => {
  return (
    <div className="w-full max-w-sm rounded-2xl overflow-hidden border border-slate-200 shadow-md bg-white text-sm">
      {/* Header */}
      <div className="bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-3">
        <div className="text-white/70 text-[11px] uppercase tracking-widest font-medium">
          Weather Near Your Farm
        </div>
        <div className="text-white font-bold text-base mt-0.5">
          {weather.cityName ?? "Your Location"}
        </div>
        <div className="text-white/80 text-xs capitalize mt-0.5">
          {weather.condition ?? "—"}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-px bg-slate-100">
        {[
          { label: "Temperature", value: weather.temperature != null ? `${weather.temperature.toFixed(1)} °C` : "—", icon: "🌡️" },
          { label: "Humidity", value: weather.humidity != null ? `${weather.humidity} %` : "—", icon: "💧" },
          { label: "Rainfall (1h)", value: weather.rainfall != null ? `${weather.rainfall} mm` : "No rain", icon: "🌧️" },
          { label: "Wind Speed", value: weather.windSpeed != null ? `${weather.windSpeed} m/s` : "—", icon: "🌬️" }
        ].map((stat) => (
          <div key={stat.label} className="bg-white px-4 py-3">
            <div className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">
              {stat.icon} {stat.label}
            </div>
            <div className="text-slate-900 font-bold text-sm mt-0.5">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Risk Alerts */}
      <div className="px-4 py-3 space-y-2 bg-white border-t border-slate-100">
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          Farm Risk Alerts
        </div>

        <div className={`flex items-center gap-2 rounded-lg px-3 py-2 border text-xs font-medium ${riskColor(weather.droughtRisk)}`}>
          {riskIcon(weather.droughtRisk)} Drought Risk: <span className="font-bold ml-1">{weather.droughtRisk ?? "—"}</span>
        </div>

        <div className={`flex items-center gap-2 rounded-lg px-3 py-2 border text-xs font-medium ${riskColor(weather.floodRisk)}`}>
          {riskIcon(weather.floodRisk)} Flood Risk: <span className="font-bold ml-1">{weather.floodRisk ?? "—"}</span>
        </div>

        {weather.pestOutbreakWarning && (
          <div className="flex items-start gap-2 rounded-lg px-3 py-2 border border-orange-200 bg-orange-50 text-xs font-medium text-orange-700">
            <span>⚠️</span>
            <span>
              <span className="font-bold">Pest Outbreak Warning</span>
              {weather.pestWarningReason && (
                <span className="block font-normal text-orange-600 mt-0.5">
                  {weather.pestWarningReason}
                </span>
              )}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
