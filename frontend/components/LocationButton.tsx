import React, { useState } from "react";
import { Location } from "../types";

interface Props {
  onLocation: (location: Location) => void;
  onClear?: () => void;
  hasLocation?: boolean;
}

export const LocationButton: React.FC<Props> = ({ onLocation, onClear, hasLocation }) => {
  const [loading, setLoading] = useState(false);

  const handleClick = () => {
    if (hasLocation) return;
    if (!navigator.geolocation) return;
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLoading(false);
        onLocation({ lat: position.coords.latitude, lon: position.coords.longitude });
      },
      () => { setLoading(false); }
    );
  };

  if (loading) {
    return (
      <button type="button" disabled
        className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-400 shadow-sm flex items-center gap-1.5 cursor-wait">
        <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
        Locating...
      </button>
    );
  }

  if (hasLocation) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-700 shadow-sm flex items-center gap-1">
          📍 Location active
        </span>
        <button
          type="button"
          onClick={onClear}
          title="Remove location"
          className="flex items-center justify-center h-5 w-5 rounded-full bg-slate-100 hover:bg-red-50 hover:text-red-500 text-slate-400 text-xs transition border border-slate-200 hover:border-red-200"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <button type="button" onClick={handleClick}
      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 shadow-sm hover:bg-slate-50 transition flex items-center gap-1">
      📍 Use my location
    </button>
  );
};
