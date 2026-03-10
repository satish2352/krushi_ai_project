"use client";

import React from "react";
import { Message } from "../types";

interface Props {
  messages: Message[];
}

export const ExportChatButton: React.FC<Props> = ({ messages }) => {

  const handleExport = () => {
    const visibleMessages = messages.filter(m => !m.isLoading && m.content.trim());

    // Convert markdown-ish text to basic HTML
    const formatContent = (text: string): string => {
      return text
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        // headings ####, ###, ##, #
        .replace(/^#{4,}\s+(.+)$/gm, "<h4>$1</h4>")
        .replace(/^###\s+(.+)$/gm, "<h3>$1</h3>")
        .replace(/^##\s+(.+)$/gm, "<h2>$2</h2>".replace("$2", "$1"))
        .replace(/^#\s+(.+)$/gm, "<h1>$1</h1>")
        // bold
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        // bullet points
        .replace(/^[-*•]\s+(.+)$/gm, "<li>$1</li>")
        // wrap consecutive <li> in <ul>
        .replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`)
        // line breaks → paragraphs
        .split("\n\n").map(p => p.startsWith("<") ? p : `<p>${p.replace(/\n/g, "<br/>")}</p>`).join("\n");
    };

    const rows = visibleMessages.map((m, i) => {
      const isUser = m.role === "user";
      const time = new Date(m.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
      const date = new Date(m.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

      // Extra cards summary
      const extras: string[] = [];
      if (m.weatherData) {
        const w = m.weatherData as any;
        extras.push(`<div class="card weather-card">🌤️ <strong>Weather:</strong> ${w.condition ?? ""} · ${w.temperature ?? "—"}°C · Humidity ${w.humidity ?? "—"}% · Drought Risk: ${w.droughtRisk ?? "—"}</div>`);
      }
      if (m.mandiPrices?.length) {
        const best = [...m.mandiPrices].sort((a,b) => b.modalPrice - a.modalPrice)[0];
        const rows = m.mandiPrices.map(p => `<tr><td>${p.mandiName}</td><td>${p.state}</td><td>~${p.distanceKm} km</td><td><strong>₹${p.modalPrice}/qt</strong></td></tr>`).join("");
        extras.push(`<div class="card mandi-card">🏪 <strong>Mandi Prices — ${m.cropName ?? "Crop"}</strong> · Best: ₹${best.modalPrice}/qt at ${best.mandiName}<table><thead><tr><th>Mandi</th><th>State</th><th>Distance</th><th>Price</th></tr></thead><tbody>${rows}</tbody></table></div>`);
      }
      if (m.yieldDashboard) {
        const y = m.yieldDashboard;
        extras.push(`<div class="card yield-card">📈 <strong>Yield & Profit — ${y.crop}</strong><br/>Yield: ${y.yield_estimation?.total_yield_quintals?.toFixed(1)} qt · Revenue: ₹${y.profit_analysis?.total_revenue_rs?.toLocaleString("en-IN")} · Profit: ₹${y.profit_analysis?.gross_profit_rs?.toLocaleString("en-IN")} (${y.profit_analysis?.profit_margin_pct?.toFixed(1)}% margin)</div>`);
      }
      if (m.agriShopData) {
        const s = m.agriShopData;
        const pestList = s.pesticides.map(p => `${p.name} — ${p.purpose}`).join(", ");
        const seedList = s.seeds.map(p => `${p.name}`).join(", ");
        extras.push(`<div class="card shop-card">🌿 <strong>Farm Inputs — ${s.crop}</strong><br/>Pesticides: ${pestList}<br/>Seeds: ${seedList}</div>`);
      }

      return `
        <div class="message ${isUser ? "user" : "assistant"}">
          <div class="meta">${isUser ? "👤 You" : "🌿 Krishi AI"} <span class="time">${date} · ${time}</span></div>
          <div class="bubble">${formatContent(m.content)}</div>
          ${extras.join("")}
        </div>`;
    }).join("\n");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Krishi AI — Chat Export · ${new Date().toLocaleDateString("en-IN")}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; background: #f8fafc; color: #1e293b; padding: 0; }

    /* Cover header */
    .header { background: linear-gradient(135deg, #065f46, #047857); color: white; padding: 28px 40px 20px; }
    .header h1 { font-size: 22px; font-weight: 700; letter-spacing: -0.3px; }
    .header p  { font-size: 12px; opacity: 0.8; margin-top: 4px; }
    .header .stats { display: flex; gap: 24px; margin-top: 12px; }
    .header .stat { background: rgba(255,255,255,0.15); border-radius: 8px; padding: 6px 12px; font-size: 11px; }

    /* Messages */
    .chat { padding: 24px 40px; max-width: 860px; margin: 0 auto; }

    .message { margin-bottom: 20px; page-break-inside: avoid; }

    .meta { font-size: 10.5px; font-weight: 600; color: #64748b; margin-bottom: 5px; }
    .meta .time { font-weight: 400; color: #94a3b8; }

    .message.user .bubble {
      background: #1e293b; color: white;
      border-radius: 16px 16px 4px 16px;
      padding: 10px 14px; display: inline-block; max-width: 70%; float: right; clear: both;
    }
    .message.user { text-align: right; }
    .message.user .meta { text-align: right; }

    .message.assistant .bubble {
      background: white; color: #1e293b;
      border-radius: 4px 16px 16px 16px;
      padding: 12px 16px; display: block; clear: both;
      border-left: 3px solid #10b981;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }

    .bubble p  { margin: 4px 0; line-height: 1.6; }
    .bubble h1 { font-size: 14px; font-weight: 700; color: #065f46; margin: 8px 0 4px; }
    .bubble h2 { font-size: 13px; font-weight: 700; color: #047857; margin: 6px 0 3px; }
    .bubble h3, .bubble h4 { font-size: 12px; font-weight: 600; color: #374151; margin: 5px 0 2px; }
    .bubble ul  { padding-left: 18px; margin: 4px 0; }
    .bubble li  { margin: 2px 0; line-height: 1.5; }
    .bubble strong { color: #0f172a; }

    /* Cards */
    .card { border-radius: 10px; padding: 10px 14px; margin-top: 10px; font-size: 12px; line-height: 1.6; clear: both; }
    .weather-card { background: #eff6ff; border: 1px solid #bfdbfe; }
    .mandi-card   { background: #f5f3ff; border: 1px solid #ddd6fe; }
    .yield-card   { background: #f0fdf4; border: 1px solid #bbf7d0; }
    .shop-card    { background: #fefce8; border: 1px solid #fef08a; }

    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11.5px; }
    th { background: #6d28d9; color: white; padding: 5px 10px; text-align: left; }
    td { padding: 5px 10px; border-bottom: 1px solid #e9d5ff; }
    tr:last-child td { border-bottom: none; }
    tr:nth-child(even) td { background: #faf5ff; }

    /* Footer */
    .footer { text-align: center; padding: 16px; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; margin-top: 16px; }

    /* Print */
    @media print {
      body { background: white; }
      .header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .card, .message.assistant .bubble { box-shadow: none; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .message { page-break-inside: avoid; }
    }
    @page { margin: 0; }

    .clearfix::after { content: ""; display: table; clear: both; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🌿 Krishi AI — Chat Export</h1>
    <p>Exported on ${new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} at ${new Date().toLocaleTimeString("en-IN")}</p>
    <div class="stats">
      <div class="stat">💬 ${visibleMessages.length} messages</div>
      <div class="stat">🌾 Powered by Krishi AI</div>
    </div>
  </div>
  <div class="chat clearfix">
    ${rows}
  </div>
  <div class="footer">Krishi AI · Intelligent Farming Assistant · This export contains your full conversation including crop predictions, mandi prices, weather data and farm inputs.</div>
</body>
</html>`;

    // Open in new tab — user can Ctrl+P / Cmd+P → Save as PDF
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    // Auto-trigger print dialog after page loads
    if (win) {
      win.onload = () => {
        setTimeout(() => { win.print(); }, 300);
      };
    }
  };

  return (
    <button
      onClick={handleExport}
      title="Export full chat as PDF"
      className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50 hover:text-emerald-700 hover:border-emerald-200 transition-all"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      </svg>
      Export PDF
    </button>
  );
};
