/**
 * DifficultySelector.jsx — Difficulty pill buttons (v3 — Strict Layout Rules).
 *
 * LAYOUT RULES APPLIED:
 * - p-8 internal breathing room
 * - flex flex-col sm:flex-row justify-center items-center gap-4
 *   (stacks on mobile, side-by-side on larger screens)
 */

import { Gauge } from "lucide-react";
import { DIFFICULTY_META } from "../data/topics";

export default function DifficultySelector({ selected, onSelect, getCount }) {
  const difficulties = Object.entries(DIFFICULTY_META);

  return (
    <div className="animate-scale-in">
      {/* ── Container card with generous padding ── */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8">
        {/* Label row */}
        <div className="flex items-center justify-center gap-2 mb-2">
          <Gauge className="w-4 h-4 text-text-secondary" />
          <p className="text-text-primary text-sm font-semibold tracking-tight">
            Select Difficulty
          </p>
        </div>

        {/* Subtitle */}
        <p className="text-text-muted text-xs text-center mb-6">
          Topics get progressively harder within each level
        </p>

        {/* Pill Group — stacks on mobile, row on sm+ */}
        <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
          {difficulties.map(([key, meta]) => {
            const isActive = selected === key;
            const count = getCount(key);

            const colorMap = {
              emerald: { bg: "bg-emerald-500/15", border: "border-emerald-500/40", text: "text-emerald-400" },
              amber:   { bg: "bg-amber-500/15",   border: "border-amber-500/40",   text: "text-amber-400" },
              rose:    { bg: "bg-rose-500/15",     border: "border-rose-500/40",    text: "text-rose-400" },
            };

            const colors = colorMap[meta.color];

            return (
              <button
                key={key}
                id={`difficulty-${key}`}
                onClick={() => onSelect(key)}
                className={`
                  flex items-center justify-center gap-2
                  w-full sm:w-auto px-6 py-3 rounded-xl
                  text-sm font-semibold transition-all duration-200
                  cursor-pointer outline-none border
                  ${isActive
                    ? `${colors.bg} ${colors.border} ${colors.text} scale-105 shadow-sm`
                    : "bg-surface-800/60 border-white/[0.06] text-text-muted hover:border-white/[0.12] hover:text-text-secondary"
                  }
                `}
              >
                <span className="text-base">{meta.emoji}</span>
                <span>{meta.label}</span>
                <span className={`
                  text-[11px] font-medium px-2 py-0.5 rounded-md
                  ${isActive ? "bg-white/10" : "bg-white/[0.04]"}
                `}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
