import React, { KeyboardEvent, useRef, useEffect } from "react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled?: boolean;
  leftSlot?: React.ReactNode;
}

export const InputBar: React.FC<Props> = ({
  value,
  onChange,
  onSend,
  disabled,
  leftSlot
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea height as user types
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [value]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends, Shift+Enter adds newline — Ctrl+Shift does NOT move cursor
    if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey) {
      e.preventDefault();
      if (!disabled && value.trim()) {
        onSend();
      }
    }
    // Ctrl+Shift+Up/Down — prevent default browser cursor jump
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
    }
  };

  return (
    <div className="flex w-full items-end space-x-2 rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 shadow-sm focus-within:border-slate-400 focus-within:shadow-md transition-all duration-200">
      {leftSlot && <div className="flex items-center space-x-2">{leftSlot}</div>}
      <textarea
        ref={textareaRef}
        rows={1}
        className="flex-1 resize-none border-none bg-transparent text-sm outline-none placeholder:text-slate-400 leading-5 py-1"
        placeholder="Ask about crop, pests, yield, weather, or prices..."
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        style={{ minHeight: "28px", maxHeight: "120px", overflowY: "auto" }}
      />
      <button
        type="button"
        onClick={onSend}
        disabled={disabled || !value.trim()}
        className="flex-shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-slate-900 via-slate-800 to-slate-700 text-xs font-medium text-white shadow-md hover:shadow-lg hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:from-slate-400 disabled:to-slate-500 transition-transform transition-shadow duration-200"
      >
        ↗
      </button>
    </div>
  );
};

