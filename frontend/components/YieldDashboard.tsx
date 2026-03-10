"use client";

import React, { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell
} from "recharts";

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

interface Props {
  data: YieldDashboardData;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl bg-white/95 border border-slate-200 shadow-lg px-3 py-2 text-xs font-medium text-slate-700">
        <div className="text-slate-500 mb-1">{label}</div>
        <div className="text-emerald-700 font-semibold">₹{fmt(payload[0].value)}</div>
      </div>
    );
  }
  return null;
};

export const YieldDashboard: React.FC<Props> = ({ data }) => {
  const { yield_estimation, profit_analysis, breakeven_analysis, crop, farm_size_acres } = data;
  const profitable = profit_analysis.is_profitable;
  const marginPct = Math.min(Math.round(profit_analysis.profit_margin_pct), 100);
  const aboveBreakeven = breakeven_analysis.actual_vs_breakeven === "ABOVE";

  const chartData = [
    { name: "Revenue", value: profit_analysis.total_revenue_rs },
    { name: "Cost", value: profit_analysis.total_cost_rs },
    { name: "Profit", value: Math.abs(profit_analysis.gross_profit_rs) }
  ];

  const chartColors = [
    "#10b981", // emerald for revenue
    "#f59e0b", // amber for cost
    profitable ? "#059669" : "#ef4444" // green/red for profit
  ];

  return (
    <div className="w-full max-w-xl rounded-2xl overflow-hidden border border-slate-200 shadow-md bg-white text-sm font-['DM_Sans',_sans-serif]">
      {/* Header */}
      <div
        className={`px-5 py-4 ${
          profitable
            ? "bg-gradient-to-r from-emerald-600 to-teal-500"
            : "bg-gradient-to-r from-red-500 to-rose-600"
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-white/70 text-xs font-medium uppercase tracking-widest mb-0.5">
              Yield & Profit Forecast
            </div>
            <div className="text-white font-bold text-lg capitalize">
              {crop}
            </div>
            <div className="text-white/80 text-xs mt-0.5">
              {farm_size_acres} acres &middot; {fmt(yield_estimation.total_yield_quintals)} qt estimated
            </div>
          </div>
          <div className="text-right">
            <div className="text-white/70 text-xs mb-0.5">Gross Profit</div>
            <div className="text-white font-extrabold text-2xl leading-tight">
              ₹{fmt(profit_analysis.gross_profit_rs)}
            </div>
            <div
              className={`text-xs font-semibold mt-0.5 px-2 py-0.5 rounded-full inline-block ${
                profitable
                  ? "bg-white/20 text-white"
                  : "bg-white/20 text-white"
              }`}
            >
              {profitable ? "✓ Profitable" : "⚠ Loss"}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-px bg-slate-100 border-b border-slate-200">
        {[
          {
            label: "Expected Yield",
            value: `${fmt(yield_estimation.total_yield_quintals)} qt`,
            sub: `${yield_estimation.total_yield_tons.toFixed(2)} tons`
          },
          {
            label: "Market Price",
            value: `₹${fmt(profit_analysis.market_price_per_quintal)}/qt`,
            sub: "per quintal"
          },
          {
            label: "Total Revenue",
            value: `₹${fmt(profit_analysis.total_revenue_rs)}`,
            sub: "gross income"
          },
          {
            label: "Total Cost",
            value: `₹${fmt(profit_analysis.total_cost_rs)}`,
            sub: `₹${fmt(profit_analysis.input_cost_per_acre)}/acre`
          }
        ].map((stat) => (
          <div key={stat.label} className="bg-white px-4 py-3">
            <div className="text-slate-400 text-[11px] font-medium uppercase tracking-wide">
              {stat.label}
            </div>
            <div className="text-slate-900 font-bold text-base mt-0.5">{stat.value}</div>
            <div className="text-slate-400 text-[11px] mt-0.5">{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* Profit Margin Bar */}
      <div className="px-5 py-4 bg-white border-b border-slate-100">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
            Profit Margin
          </span>
          <span
            className={`text-sm font-bold ${
              profitable ? "text-emerald-600" : "text-red-500"
            }`}
          >
            {profit_analysis.profit_margin_pct.toFixed(1)}%
          </span>
        </div>
        <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              profitable
                ? "bg-gradient-to-r from-emerald-400 to-teal-500"
                : "bg-gradient-to-r from-red-400 to-rose-500"
            }`}
            style={{ width: `${Math.max(marginPct, 2)}%` }}
          />
        </div>
        <div className="text-[11px] text-slate-400 mt-1">
          {profitable
            ? `You keep ₹${fmt(profit_analysis.gross_profit_rs)} after expenses.`
            : `You lose ₹${fmt(Math.abs(profit_analysis.gross_profit_rs))}. Review input costs.`}
        </div>
      </div>

      {/* Breakeven */}
      <div
        className={`px-5 py-3 flex items-center gap-3 border-b border-slate-100 ${
          aboveBreakeven ? "bg-emerald-50" : "bg-amber-50"
        }`}
      >
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center text-base flex-shrink-0 ${
            aboveBreakeven ? "bg-emerald-100" : "bg-amber-100"
          }`}
        >
          {aboveBreakeven ? "📈" : "⚠️"}
        </div>
        <div>
          <div
            className={`text-xs font-semibold ${
              aboveBreakeven ? "text-emerald-800" : "text-amber-800"
            }`}
          >
            Break-even: {fmt(breakeven_analysis.breakeven_yield_quintals)} qt —{" "}
            {aboveBreakeven ? "You're above it!" : "You're below it."}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Safety margin: {breakeven_analysis.safety_margin_pct.toFixed(1)}% &middot;{" "}
            {aboveBreakeven
              ? "Good buffer against price drops."
              : "Increase yield or reduce costs."}
          </div>
        </div>
      </div>

      {/* Bar Chart */}
      <div className="px-4 pt-3 pb-4 bg-white">
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 px-1">
          Financial Summary (₹)
        </div>
        <ResponsiveContainer width="100%" height={100}>
          <BarChart data={chartData} barCategoryGap="25%">
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 600 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis hide />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f8fafc" }} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={chartColors[i]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
