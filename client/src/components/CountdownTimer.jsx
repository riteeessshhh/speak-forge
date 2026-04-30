/**
 * CountdownTimer.jsx — The "Thinking Mode" preparation timer (v2).
 *
 * CHANGES FROM v1:
 * - Now receives and displays `difficulty` alongside track/topic
 * - Improved visual design with glassmorphism and better typography
 * - Difficulty badge with color coding
 * - Responsive layout: stacks vertically on mobile, centers on desktop
 *
 * ARCHITECTURE:
 * - Owns `timeLeft` state via useState
 * - Uses useRef for interval cleanup (avoids stale closure bugs)
 * - SVG circular progress with smooth color transitions
 * - Parent provides onComplete/onSkip callbacks
 */

import { useState, useEffect, useRef } from "react";
import { Mic, SkipForward, Brain } from "lucide-react";
import { DIFFICULTY_META } from "../data/topics";

export default function CountdownTimer({
  duration = 30,
  onComplete,
  onSkip,
  topic,
  sourceTrack,
  difficulty,
}) {
  const [timeLeft, setTimeLeft] = useState(duration);
  const intervalRef = useRef(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          onComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(intervalRef.current);
  }, [duration, onComplete]);

  // ── Visual Calculations ──
  const progress = timeLeft / duration;
  const radius = 72;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  // Color shifts: green → amber → red
  const getTimerStyles = () => {
    if (progress > 0.5) return { ring: "stroke-emerald-400", text: "text-emerald-400", glow: "shadow-emerald-500/20" };
    if (progress > 0.2) return { ring: "stroke-amber-400", text: "text-amber-400", glow: "shadow-amber-500/20" };
    return { ring: "stroke-rose-400", text: "text-rose-400", glow: "shadow-rose-500/20" };
  };

  const styles = getTimerStyles();
  const diffMeta = DIFFICULTY_META[difficulty];

  return (
    <div className="flex flex-col items-center gap-6 animate-fade-in-up px-4">
      {/* ── Track + Difficulty Badges ── */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="px-3 py-1 rounded-lg bg-white/[0.06] border border-white/[0.08] text-text-muted text-[11px] font-medium uppercase tracking-wider">
          {sourceTrack}
        </span>
        {diffMeta && (
          <span className="px-3 py-1 rounded-lg bg-white/[0.06] border border-white/[0.08] text-text-muted text-[11px] font-medium">
            {diffMeta.emoji} {diffMeta.label}
          </span>
        )}
      </div>

      {/* ── Topic Display ── */}
      <div className="max-w-xl text-center">
        <p className="text-text-primary text-lg sm:text-xl md:text-2xl font-semibold leading-relaxed">
          &ldquo;{topic}&rdquo;
        </p>
      </div>

      {/* ── Circular Timer ── */}
      <div className={`relative flex items-center justify-center my-2 rounded-full ${styles.glow} shadow-2xl`}>
        <svg width="180" height="180" className="-rotate-90">
          {/* Background ring */}
          <circle
            cx="90" cy="90" r={radius}
            fill="none"
            strokeWidth="5"
            className="stroke-white/[0.06]"
          />
          {/* Animated progress ring */}
          <circle
            cx="90" cy="90" r={radius}
            fill="none"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className={`${styles.ring} transition-all duration-1000 ease-linear`}
          />
        </svg>
        {/* Centered time */}
        <div className={`absolute flex flex-col items-center ${styles.text}`}>
          <span className={`text-5xl font-bold tabular-nums tracking-tight ${timeLeft <= 5 ? "animate-countdown-pulse" : ""}`}>
            {timeLeft}
          </span>
          <span className="text-text-muted text-xs mt-1 font-medium">seconds</span>
        </div>
      </div>

      {/* ── Status ── */}
      <div className="flex items-center gap-2 text-text-secondary text-sm">
        <Brain className="w-4 h-4 text-primary-light animate-pulse" />
        <span>Organize your thoughts...</span>
      </div>

      {/* ── Skip Button ── */}
      <button
        id="skip-timer-btn"
        onClick={onSkip}
        className="
          group flex items-center gap-2 px-6 py-3 rounded-xl
          bg-primary/90 hover:bg-primary text-white
          font-semibold text-sm cursor-pointer
          transition-all duration-200
          hover:scale-105 hover:shadow-lg hover:shadow-primary/25
          active:scale-[0.97]
        "
      >
        <Mic className="w-4 h-4" />
        Start Speaking
        <SkipForward className="w-3.5 h-3.5 opacity-50 group-hover:opacity-80 transition-opacity" />
      </button>
    </div>
  );
}
