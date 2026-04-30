/**
 * App.jsx — Vercel v0 Design + Our State Logic.
 *
 * DESIGN: Compact single-frame desktop layout from v0.
 * LOGIC:  Track selection, difficulty, topic generation, phase machine.
 *
 * Key: lg:h-screen + lg:overflow-hidden = no scroll on desktop.
 *      overflow-y-auto = scrolls naturally on mobile.
 */

import { useState, useCallback } from "react";
import { Building2, Cpu, Flame, Rocket, Shuffle, Sparkles, Mic, ChevronRight, RotateCcw } from "lucide-react";
import { getRandomTopic, getTopicCount } from "./data/topics";
import CountdownTimer from "./components/CountdownTimer";

/* ── Card data (visual config — matches v0 design exactly) ── */
const arenaCards = [
  {
    id: "interview",
    trackName: "Interview Prep",
    icon: Building2,
    title: "Interview Prep",
    description: "Behavioral & HR questions from easy icebreakers to tough conflict scenarios.",
    color: "bg-emerald-500",
    hoverBorder: "hover:border-emerald-500/50",
  },
  {
    id: "tech",
    trackName: "Tech & CS",
    icon: Cpu,
    title: "Tech & CS",
    description: "Data structures, algorithms, systems design, and networking fundamentals.",
    color: "bg-pink-500",
    hoverBorder: "hover:border-pink-500/50",
  },
  {
    id: "hottakes",
    trackName: "Hot Takes",
    icon: Flame,
    title: "Hot Takes",
    description: "Defend the indefensible. Practice thinking on your feet under pressure.",
    color: "bg-rose-500",
    hoverBorder: "hover:border-rose-500/50",
  },
  {
    id: "pitch",
    trackName: "Creative Pitch",
    icon: Rocket,
    title: "Creative Pitch",
    description: "Sell an idea, a product, or yourself to investors in 60 seconds flat.",
    color: "bg-orange-500",
    hoverBorder: "hover:border-orange-500/50",
  },
  {
    id: "random",
    trackName: "True Random",
    icon: Shuffle,
    title: "True Random",
    description: "Bizarre, philosophical, and everyday impromptu questions. Expect chaos.",
    color: "bg-violet-500",
    hoverBorder: "hover:border-violet-500/50",
  },
];

const difficulties = [
  { key: "easy",   label: "Easy",   emoji: "🌱", color: "text-emerald-400", bgHover: "hover:bg-emerald-500/10", borderHover: "hover:border-emerald-500/50" },
  { key: "medium", label: "Medium", emoji: "⚡",  color: "text-amber-400",   bgHover: "hover:bg-amber-500/10",   borderHover: "hover:border-amber-500/50" },
  { key: "hard",   label: "Hard",   emoji: "🔥",  color: "text-rose-400",    bgHover: "hover:bg-rose-500/10",    borderHover: "hover:border-rose-500/50" },
];

const PREP_DURATION = 30;

export default function App() {
  /* ══════ STATE ══════ */
  const [phase, setPhase] = useState("selection");
  const [selectedArena, setSelectedArena] = useState(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState(null);
  const [currentTopic, setCurrentTopic] = useState(null);

  /* ══════ DERIVED ══════ */
  const canGenerate = selectedArena !== null && selectedDifficulty !== null;
  const selectedCard = arenaCards.find((c) => c.id === selectedArena);

  /* ══════ HANDLERS ══════ */
  const handleArenaSelect = (id) => {
    setSelectedArena(id);
    setSelectedDifficulty(null);
  };

  const handleDifficultySelect = (key) => {
    setSelectedDifficulty(key);
  };

  const handleGenerate = () => {
    if (!canGenerate || !selectedCard) return;
    const result = getRandomTopic(selectedCard.trackName, selectedDifficulty);
    if (!result) return;
    setCurrentTopic(result);
    setPhase("thinking");
  };

  const handleTimerComplete = useCallback(() => {
    setPhase("ready");
  }, []);

  const handleSkip = () => setPhase("ready");

  const handleReset = () => {
    setPhase("selection");
    setSelectedArena(null);
    setSelectedDifficulty(null);
    setCurrentTopic(null);
  };

  /* ══════ RENDER ══════ */
  return (
    <div className="min-h-screen lg:h-screen bg-[#0a0e17] text-white flex flex-col overflow-y-auto lg:overflow-hidden">
      {/* Top accent bar */}
      <div className="fixed top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500 via-pink-500 to-violet-500 z-50" />

      {/* Header */}
      <header className="border-b border-slate-800/80 bg-[#0a0e17]/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Mic className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-semibold tracking-tight">SpeakForge</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="hidden sm:inline">Master the art of speaking</span>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col justify-center px-4 py-4 lg:py-0">
        <div className="max-w-5xl w-full mx-auto flex flex-col">

          {/* ══════ PHASE: SELECTION ══════ */}
          {phase === "selection" && (
            <>
              {/* Page Title */}
              <div className="text-center mb-5 lg:mb-4">
                <h1 className="text-2xl md:text-3xl font-bold mb-1.5 tracking-tight">
                  Pick Your Arena
                </h1>
                <p className="text-slate-400 text-sm max-w-xl mx-auto">
                  Choose a track and difficulty. Each combination sharpens a different muscle
                  for speaking with clarity and confidence.
                </p>
              </div>

              {/* Arena Cards Grid — Top 3 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                {arenaCards.slice(0, 3).map((card) => (
                  <ArenaCard
                    key={card.id}
                    {...card}
                    topics={getTopicCount(card.trackName)}
                    isSelected={selectedArena === card.id}
                    onClick={() => handleArenaSelect(card.id)}
                  />
                ))}
              </div>

              {/* Bottom row — centered 2 cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 mt-2 sm:mt-3 lg:max-w-[66%] lg:mx-auto">
                {arenaCards.slice(3).map((card) => (
                  <ArenaCard
                    key={card.id}
                    {...card}
                    topics={getTopicCount(card.trackName)}
                    isSelected={selectedArena === card.id}
                    onClick={() => handleArenaSelect(card.id)}
                  />
                ))}
              </div>

              {/* Bottom Action Panel — "Configure Session" */}
              <div className="mt-3 sm:mt-4 lg:mt-3 bg-gradient-to-b from-slate-800/50 to-slate-900/50 border border-slate-700/60 rounded-xl overflow-hidden">
                {/* Panel Header */}
                <div className="px-3 sm:px-4 py-2 sm:py-2.5 border-b border-slate-700/40 bg-slate-800/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-md bg-slate-700/50 flex items-center justify-center">
                      <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                      </svg>
                    </div>
                    <span className="text-xs sm:text-sm font-medium text-slate-300">Configure Session</span>
                  </div>
                  <span className="text-[10px] sm:text-xs text-slate-500">
                    {selectedArena ? "1 arena selected" : "Select an arena"}
                  </span>
                </div>

                {/* Panel Content */}
                <div className="p-3 sm:p-4 flex flex-col lg:flex-row items-center justify-between gap-3 sm:gap-4">
                  {/* Difficulty Selection */}
                  <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 w-full lg:w-auto">
                    <span className="text-xs text-slate-500 uppercase tracking-wider font-medium shrink-0">Difficulty</span>
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-center">
                      {difficulties.map((diff) => {
                        const count = selectedCard
                          ? getTopicCount(selectedCard.trackName, diff.key)
                          : 10;

                        return (
                          <button
                            key={diff.key}
                            id={`difficulty-${diff.key}`}
                            onClick={() => handleDifficultySelect(diff.key)}
                            className={`px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg border transition-all duration-200 flex items-center gap-1.5 sm:gap-2 cursor-pointer ${
                              selectedDifficulty === diff.key
                                ? `bg-slate-700/80 border-slate-500 ${diff.color}`
                                : `bg-slate-800/50 border-slate-700/50 ${diff.bgHover} ${diff.borderHover}`
                            }`}
                          >
                            <span className="text-xs sm:text-sm">{diff.emoji}</span>
                            <span className={`text-xs sm:text-sm font-medium ${selectedDifficulty === diff.key ? diff.color : "text-slate-300"}`}>
                              {diff.label}
                            </span>
                            <span className="text-[10px] sm:text-xs text-slate-500 bg-slate-700/50 px-1 sm:px-1.5 py-0.5 rounded">
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="hidden lg:block w-px h-10 bg-slate-700/50" />

                  {/* Generate Button */}
                  <button
                    id="generate-topic-btn"
                    onClick={handleGenerate}
                    disabled={!canGenerate}
                    className={`group relative px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg font-medium flex items-center gap-2 transition-all duration-300 text-sm sm:text-base w-full sm:w-auto justify-center cursor-pointer ${
                      canGenerate
                        ? "bg-gradient-to-r from-violet-600 to-purple-600 shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:scale-[1.02]"
                        : "bg-slate-700/50 text-slate-400 cursor-not-allowed"
                    }`}
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Generate Topic</span>
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ══════ PHASE: THINKING ══════ */}
          {phase === "thinking" && currentTopic && (
            <div className="flex-1 flex items-center justify-center py-8">
              <CountdownTimer
                duration={PREP_DURATION}
                topic={currentTopic.topic}
                sourceTrack={currentTopic.track}
                difficulty={currentTopic.difficulty}
                onComplete={handleTimerComplete}
                onSkip={handleSkip}
              />
            </div>
          )}

          {/* ══════ PHASE: READY ══════ */}
          {phase === "ready" && currentTopic && (
            <div className="flex flex-col items-center gap-6 py-8">
              {/* Badges */}
              <div className="flex flex-wrap items-center justify-center gap-2">
                <span className="px-3 py-1 rounded-lg bg-slate-800/60 border border-slate-700 text-slate-400 text-[11px] font-medium uppercase tracking-wider">
                  {currentTopic.track}
                </span>
                <span className="px-3 py-1 rounded-lg bg-slate-800/60 border border-slate-700 text-slate-400 text-[11px] font-medium capitalize">
                  {currentTopic.difficulty}
                </span>
              </div>

              {/* Topic */}
              <div className="max-w-xl text-center">
                <p className="text-white text-lg sm:text-xl md:text-2xl font-semibold leading-relaxed">
                  &ldquo;{currentTopic.topic}&rdquo;
                </p>
              </div>

              {/* Ready Indicator */}
              <div className="flex flex-col items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center animate-float shadow-2xl shadow-violet-500/20">
                  <Mic className="w-8 h-8 text-white" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-emerald-400 font-bold text-lg sm:text-xl">You&rsquo;re Ready!</p>
                  <p className="text-slate-500 text-xs">Recording will be available in Capsule 2.</p>
                </div>
              </div>

              {/* Reset */}
              <button
                id="new-topic-btn"
                onClick={handleReset}
                className="group flex items-center gap-2 px-5 py-2.5 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-400 font-medium text-sm hover:bg-slate-700/60 hover:text-slate-200 transition-all duration-200 cursor-pointer hover:scale-105 active:scale-[0.97]"
              >
                <RotateCcw className="w-4 h-4 group-hover:-rotate-90 transition-transform duration-300" />
                New Topic
              </button>
            </div>
          )}

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/50 py-2 text-center">
        <p className="text-xs text-slate-600">Practice speaking with confidence</p>
      </footer>
    </div>
  );
}

/* ── ArenaCard — Horizontal layout (icon left, content right) ── */
function ArenaCard({ icon: Icon, title, description, topics, color, hoverBorder, isSelected, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`group relative text-left bg-slate-800/20 border rounded-xl p-2.5 sm:p-3.5 transition-all duration-200 cursor-pointer ${
        isSelected
          ? "border-slate-500 bg-slate-800/40 ring-1 ring-slate-500/20"
          : `border-slate-800 ${hoverBorder} hover:bg-slate-800/30`
      }`}
    >
      <div className="flex items-start gap-2.5 sm:gap-3">
        {/* Icon */}
        <div className={`w-8 h-8 sm:w-9 sm:h-9 ${color} rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg`}>
          <Icon className="w-4 h-4 text-white" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <h3 className="text-xs sm:text-sm font-semibold truncate">{title}</h3>
            <ChevronRight className={`w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 transition-all ${isSelected ? "text-slate-400" : "text-slate-600 group-hover:text-slate-400 group-hover:translate-x-0.5"}`} />
          </div>
          <p className="text-slate-500 text-[11px] sm:text-xs leading-relaxed line-clamp-2">{description}</p>
          <div className="mt-1 sm:mt-1.5 flex items-center gap-1.5">
            <span className="text-[10px] sm:text-xs text-slate-600 bg-slate-800/80 px-1.5 sm:px-2 py-0.5 rounded-full">{topics} topics</span>
          </div>
        </div>
      </div>

      {/* Selection indicator */}
      {isSelected && (
        <div className={`absolute top-2 right-2 w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${color}`} />
      )}
    </button>
  );
}
