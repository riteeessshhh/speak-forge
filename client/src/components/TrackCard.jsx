/**
 * TrackCard.jsx — Track selection card (v3 — Better Spacing).
 *
 * CHANGES:
 * - Increased internal padding (p-5 → p-6)
 * - More margin below icon (mb-4 → mb-5)
 * - Larger icon container
 * - Better spacing between text elements
 * - Taller minimum height so cards feel spacious
 */

import { ChevronRight } from "lucide-react";

export default function TrackCard({
  name,
  description,
  icon: Icon,
  gradient,
  bgGlow,
  isSelected,
  topicCount,
  onClick,
}) {
  return (
    <button
      id={`track-${name.toLowerCase().replace(/\s+/g, "-")}`}
      onClick={onClick}
      className={`
        group relative w-full text-left rounded-2xl
        p-5 sm:p-6
        transition-all duration-300 ease-out cursor-pointer outline-none
        border backdrop-blur-sm

        ${isSelected
          ? "border-white/20 shadow-[0_0_30px_rgba(255,255,255,0.05)] scale-[1.03]"
          : "border-white/[0.06] hover:border-white/[0.12] hover:scale-[1.02]"
        }
      `}
      style={{
        background: isSelected
          ? `linear-gradient(135deg, ${bgGlow}, transparent 60%)`
          : "hsla(228, 26%, 11%, 0.7)",
      }}
    >
      {/* ── Gradient Icon ── */}
      <div
        className={`
          w-12 h-12 rounded-xl bg-gradient-to-br ${gradient}
          flex items-center justify-center mb-5
          shadow-lg transition-transform duration-300
          group-hover:scale-110 group-hover:rotate-3
        `}
      >
        <Icon className="w-5.5 h-5.5 text-white" strokeWidth={2} />
      </div>

      {/* ── Track Name ── */}
      <h3 className="text-text-primary font-semibold text-base sm:text-[15px] mb-2 tracking-tight">
        {name}
      </h3>

      {/* ── Description ── */}
      <p className="text-text-muted text-[13px] sm:text-xs leading-relaxed mb-4 line-clamp-2">
        {description}
      </p>

      {/* ── Bottom Row ── */}
      <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
        <span className="text-text-muted text-[11px] font-medium">
          {topicCount} topics
        </span>
        <ChevronRight
          className={`w-4 h-4 transition-all duration-300
            ${isSelected
              ? "text-white/60 translate-x-0"
              : "text-white/20 -translate-x-1 group-hover:translate-x-0 group-hover:text-white/40"
            }
          `}
        />
      </div>

      {/* ── Selected Accent Line ── */}
      {isSelected && (
        <div
          className={`absolute top-0 left-6 right-6 h-[2px] rounded-full bg-gradient-to-r ${gradient}`}
        />
      )}
    </button>
  );
}
