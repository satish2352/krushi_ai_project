import React from "react";
import { Message } from "../types";

interface Props { message: Message; }

function getSectionIcon(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("weather") || t.includes("mausam") || t.includes("climate")) return "🌤️";
  if (t.includes("soil") || t.includes("mitti") || t.includes("nutrient") || t.includes("tatva")) return "🌱";
  if (t.includes("pest") || t.includes("keeda") || t.includes("disease") || t.includes("bimari")) return "🐛";
  if (t.includes("yield") || t.includes("paidavar") || t.includes("production") || t.includes("upaj")) return "📈";
  if (t.includes("mandi") || t.includes("price") || t.includes("bhav") || t.includes("market") || t.includes("rate")) return "🏪";
  if (t.includes("action") || t.includes("step") || t.includes("karo") || t.includes("agla") || t.includes("next")) return "✅";
  if (t.includes("risk") || t.includes("alert") || t.includes("warning") || t.includes("khatra")) return "⚠️";
  if (t.includes("tip") || t.includes("advice") || t.includes("salah") || t.includes("sujhav")) return "💡";
  if (t.includes("cost") || t.includes("laagat") || t.includes("kharcha") || t.includes("price") || t.includes("paisa")) return "💰";
  if (t.includes("crop") || t.includes("fasal") || t.includes("grow") || t.includes("cultivat") || t.includes("ugao")) return "🌾";
  if (t.includes("water") || t.includes("irrigation") || t.includes("sinchai") || t.includes("pani")) return "💧";
  if (t.includes("fertilizer") || t.includes("khad") || t.includes("urea") || t.includes("nutrient")) return "🧪";
  if (t.includes("season") || t.includes("mausam") || t.includes("month") || t.includes("mahina")) return "📅";
  if (t.includes("introduction") || t.includes("about") || t.includes("overview")) return "📌";
  return "📌";
}

// Inline bold: **text** → <strong>text</strong>
function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={i} className="font-semibold text-slate-800">{part.slice(2, -2)}</strong>
      : part
  );
}

function parseMarkdown(content: string) {
  const lines = content.split("\n");
  type Block =
    | { type: "h1" | "h2" | "h3"; text: string }
    | { type: "list"; items: string[] }
    | { type: "price"; text: string }
    | { type: "p"; text: string };

  const blocks: Block[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length) { blocks.push({ type: "list", items: [...listItems] }); listItems = []; }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    // Handle ALL heading levels (#, ##, ###, ####, #####) — strip all # prefix
    if (/^#{1,5}\s/.test(line)) {
      flushList();
      const text = line.replace(/^#{1,5}\s+/, "");
      const level = line.match(/^(#{1,5})/)?.[1].length ?? 2;
      blocks.push({ type: level <= 2 ? "h1" : level === 3 ? "h2" : "h3", text });
      continue;
    }

    // Bullet points (-, *, •, +)
    if (/^[-*•+]\s/.test(line)) {
      const item = line.replace(/^[-*•+]\s+/, "").replace(/\*\*(.*?)\*\*/g, "$1");
      listItems.push(item);
      continue;
    }

    // Numbered list
    if (/^\d+[.)]\s/.test(line)) {
      const item = line.replace(/^\d+[.)]\s+/, "").replace(/\*\*(.*?)\*\*/g, "$1");
      listItems.push(item);
      continue;
    }

    // Indented lines (continuation of list or sub-item)
    if (/^\s{2,}[-*•+]?\s*\S/.test(raw) && !raw.startsWith("  #")) {
      const item = raw.trim().replace(/^[-*•+]\s+/, "");
      if (listItems.length) { listItems.push("  " + item); continue; }
    }

    flushList();
    const cleaned = line.replace(/\*\*(.*?)\*\*/g, "$1");

    // Price/cost lines get amber highlight
    if (/₹|rs\.|rupee|\bper acre\b|\bper quintal\b|\bkg\/acre\b/i.test(cleaned)) {
      blocks.push({ type: "price", text: cleaned });
    } else {
      blocks.push({ type: "p", text: line }); // keep ** for inline rendering
    }
  }
  flushList();
  return blocks;
}

function RenderBlock({ block }: { block: any }) {
  if (block.type === "h1") {
    return (
      <div className="mb-3 mt-1">
        <div className="flex items-center gap-2">
          <span className="text-base">{getSectionIcon(block.text)}</span>
          <h2 className="text-sm font-bold text-slate-800 leading-tight">{block.text}</h2>
        </div>
        <div className="mt-1 h-px bg-gradient-to-r from-emerald-400 to-transparent" />
      </div>
    );
  }
  if (block.type === "h2") {
    return <p className="text-xs font-bold text-emerald-700 mt-2.5 mb-1 uppercase tracking-wide">{getSectionIcon(block.text)} {block.text}</p>;
  }
  if (block.type === "h3") {
    return <p className="text-xs font-semibold text-slate-600 mt-2 mb-0.5 italic">{block.text}</p>;
  }
  if (block.type === "list") {
    return (
      <ul className="space-y-1 mb-2">
        {block.items.map((item: string, i: number) => {
          const isIndented = item.startsWith("  ");
          const text = item.trim();
          return (
            <li key={i} className={`flex items-start gap-2 text-sm text-slate-700 leading-snug ${isIndented ? "ml-4" : ""}`}>
              <span className={`mt-1.5 flex-shrink-0 rounded-full ${isIndented ? "h-1 w-1 bg-slate-400" : "h-1.5 w-1.5 bg-emerald-500"}`} />
              <span>{renderInline(text)}</span>
            </li>
          );
        })}
      </ul>
    );
  }
  if (block.type === "price") {
    return (
      <div className="flex items-start gap-2 mb-1.5 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
        <span className="text-sm flex-shrink-0">💰</span>
        <p className="text-sm text-slate-700 leading-snug">{block.text}</p>
      </div>
    );
  }
  // paragraph
  return <p className="text-sm text-slate-700 leading-relaxed mb-1.5">{renderInline(block.text)}</p>;
}

export const MessageBubble: React.FC<Props> = ({ message }) => {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex w-full justify-end">
        <div className="max-w-sm rounded-2xl rounded-br-sm px-4 py-2.5 text-sm leading-relaxed shadow-sm bg-gradient-to-br from-slate-800 to-slate-900 text-white">
          {message.content}
        </div>
      </div>
    );
  }

  const blocks = parseMarkdown(message.content);
  const isSimple = blocks.length <= 2 && blocks.every(b => b.type === "p");

  if (isSimple) {
    return (
      <div className="flex w-full justify-start">
        <div className="max-w-xl rounded-2xl rounded-bl-sm px-4 py-3 text-sm leading-relaxed shadow-sm bg-slate-50 text-slate-800 border border-slate-100">
          {renderInline(message.content)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full justify-start">
      <div className="max-w-xl w-full rounded-2xl rounded-bl-sm shadow-sm bg-white border border-slate-100 overflow-hidden">
        <div className="h-0.5 bg-gradient-to-r from-emerald-500 via-green-400 to-teal-400" />
        <div className="px-4 py-3">
          {blocks.map((block, i) => <RenderBlock key={i} block={block} />)}
        </div>
        <div className="px-4 pb-2 flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 flex items-center justify-center">
            <div className="h-1.5 w-1.5 rounded-full bg-white" />
          </div>
          <span className="text-[10px] text-slate-400">Krishi AI</span>
        </div>
      </div>
    </div>
  );
};
