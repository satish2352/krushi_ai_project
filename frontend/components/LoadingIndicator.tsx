import React from "react";

export const LoadingIndicator: React.FC = () => {
  return (
    <div className="flex items-center space-x-2 text-xs text-slate-500">
      <span className="relative flex h-2 w-2">
        <span className="typing-dot" />
      </span>
      <span className="relative flex h-2 w-2">
        <span className="typing-dot typing-dot-delay-1" />
      </span>
      <span className="relative flex h-2 w-2">
        <span className="typing-dot typing-dot-delay-2" />
      </span>
      <span className="ml-1">Thinking...</span>
    </div>
  );
};

