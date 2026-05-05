/**
 * App.jsx — Production-Ready SpeakForge
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { 
  Building2, Cpu, Flame, Rocket, Shuffle, Sparkles, Mic, 
  ChevronRight, RotateCcw, Square, BarChart3, LogOut, 
  Loader2, Play, CheckCircle2, History, X, ArrowLeft
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Toaster, toast } from "react-hot-toast";
import { getRandomTopic, getTopicCount } from "./data/topics";
import CountdownTimer from "./components/CountdownTimer";
import { useAudioRecorder } from "./hooks/useAudioRecorder";
import { UserProvider, useAuth } from "./contexts/UserContext";
import AuthView from "./components/AuthView";
import Dashboard from "./components/Dashboard";
import AudioVisualizer from "./components/AudioVisualizer";
import AudioPlayer from "./components/AudioPlayer";
import Skeleton, { SkeletonText } from "./components/Skeleton";

/* ── Card data ── */
const arenaCards = [
  {
    id: "interview",
    trackName: "Interview Prep",
    icon: Building2,
    title: "Interview Prep",
    description: "Behavioral & HR questions from easy icebreakers to tough conflict scenarios.",
    color: "bg-emerald-500",
    shadowColor: "shadow-emerald-500/10",
    ringColor: "ring-emerald-500/50",
  },
  {
    id: "tech",
    trackName: "Tech & CS",
    icon: Cpu,
    title: "Tech & CS",
    description: "Data structures, algorithms, systems design, and networking fundamentals.",
    color: "bg-pink-500",
    shadowColor: "shadow-pink-500/10",
    ringColor: "ring-pink-500/50",
  },
  {
    id: "hottakes",
    trackName: "Hot Takes",
    icon: Flame,
    title: "Hot Takes",
    description: "Defend the indefensible. Practice thinking on your feet under pressure.",
    color: "bg-rose-500",
    shadowColor: "shadow-rose-500/10",
    ringColor: "ring-rose-500/50",
  },
  {
    id: "pitch",
    trackName: "Creative Pitch",
    icon: Rocket,
    title: "Creative Pitch",
    description: "Sell an idea, a product, or yourself to investors in 60 seconds flat.",
    color: "bg-orange-500",
    shadowColor: "shadow-orange-500/10",
    ringColor: "ring-orange-500/50",
  },
  {
    id: "random",
    trackName: "True Random",
    icon: Shuffle,
    title: "True Random",
    description: "Bizarre, philosophical, and everyday impromptu questions. Expect chaos.",
    color: "bg-violet-500",
    shadowColor: "shadow-violet-500/10",
    ringColor: "ring-violet-500/50",
  },
];

const difficulties = [
  { key: "easy",   label: "Easy",   emoji: "🌱", color: "text-emerald-400", activeBg: "bg-emerald-500/10", border: "border-emerald-500/50", bgHover: "hover:bg-emerald-500/5" },
  { key: "medium", label: "Medium", emoji: "⚡",  color: "text-amber-400",   activeBg: "bg-amber-500/10",   border: "border-amber-500/50",   bgHover: "hover:bg-amber-500/5" },
  { key: "hard",   label: "Hard",   emoji: "🔥",  color: "text-rose-400",    activeBg: "bg-rose-500/10",    border: "border-rose-500/50",    bgHover: "hover:bg-rose-500/5" },
];

const PREP_DURATION = 30;

function HeaderButton({ onClick, icon: Icon, label, isActive, variant = "secondary" }) {
  const isPrimary = variant === "primary";
  
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-1.5 rounded-lg border transition-all duration-300 cursor-pointer text-xs ${
        isPrimary
          ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold border-transparent shadow-[0_0_15px_rgba(139,92,246,0.3)] hover:scale-105 active:scale-95"
          : "bg-transparent text-zinc-500 hover:text-zinc-300 border-zinc-800 hover:bg-zinc-800/30 font-medium active:scale-95"
      }`}
    >
      <Icon className={`w-3.5 h-3.5 ${isPrimary ? "stroke-[2.5px]" : "stroke-[1.5px]"}`} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

/* ══════ Root Export ══════ */
export default function App() {
  return (
    <UserProvider>
      <Toaster 
        position="top-center"
        toastOptions={{
          style: {
            background: '#18181b',
            color: '#fafafa',
            border: '1px solid #27272a',
          },
        }} 
      />
      <AppContent />
    </UserProvider>
  );
}

/* ══════ Main App Content ══════ */
function AppContent() {
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth();
  
  const [phase, setPhase] = useState("selection");
  const [selectedArena, setSelectedArena] = useState(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState(null);
  const [currentTopic, setCurrentTopic] = useState(null);
  const [isGeneratingTopic, setIsGeneratingTopic] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [showDashboard, setShowDashboard] = useState(false);
  const isSessionActive = ["thinking", "recording", "review"].includes(phase);

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
  const { status, isRecording, audioUrl, audioBlob, stream, startRecording, stopRecording, clearAudio } = useAudioRecorder();

  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [loadingTextIndex, setLoadingTextIndex] = useState(0);
  const loadingTexts = ["Analyzing Audio...", "Checking Clarity...", "Generating Insights...", "Forging Feedback..."];
  
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingIntervalRef = useRef(null);

  const canGenerate = selectedArena !== null && selectedDifficulty !== null;
  const selectedCard = arenaCards.find((c) => c.id === selectedArena);

  /* ── Loading State Logic ── */
  useEffect(() => {
    let textInterval;
    let progressTimer;

    if (isAnalyzing) {
      setAnalysisProgress(10);
      textInterval = setInterval(() => {
        setLoadingTextIndex((prev) => (prev + 1) % loadingTexts.length);
      }, 2000);

      progressTimer = setTimeout(() => {
        setAnalysisProgress(90);
      }, 3000);
    } else {
      setAnalysisProgress(0);
      setLoadingTextIndex(0);
    }

    return () => {
      clearInterval(textInterval);
      clearTimeout(progressTimer);
    };
  }, [isAnalyzing]);

  /* ── Recording Timer Logic ── */
  useEffect(() => {
    if (phase === "recording") {
      setRecordingTime(0);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(recordingIntervalRef.current);
    }
    return () => clearInterval(recordingIntervalRef.current);
  }, [phase]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  /* ── Navigation Guard ── */
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isSessionActive) {
        e.preventDefault();
        e.returnValue = "Leaving now will reset your current challenge. Continue?";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isSessionActive]);

  /* ── Handlers ── */
  const handleArenaSelect = (id) => {
    setSelectedArena(id);
    setSelectedDifficulty(null);
  };

  const handleDifficultySelect = (key) => setSelectedDifficulty(key);

  const handleGenerate = async () => {
    if (!canGenerate || !selectedCard) return;
    setIsGeneratingTopic(true);

    let generatedTopic = null;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(`${API_URL}/api/generate-topic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          track: selectedCard.trackName,
          difficulty: selectedDifficulty,
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        generatedTopic = {
          track: selectedCard.trackName,
          difficulty: selectedDifficulty,
          topic: data.topic,
          isBehavioral: data.isBehavioral || false
        };
      } else {
        const errorData = await res.json().catch(() => ({}));
        toast.error(errorData.error || "AI Forge is busy.");
      }
    } catch (err) {
      toast.error("Network lag detected. Using local fallback.");
    }

    setIsGeneratingTopic(false);
    if (generatedTopic) {
      setCurrentTopic(generatedTopic);
    } else {
      const result = getRandomTopic(selectedCard.trackName, selectedDifficulty);
      if (!result) return;
      setCurrentTopic(result);
    }
    setPhase("thinking");
  };

  const handleStartRecording = useCallback(async () => {
    console.log("[App] handleStartRecording initiated");
    // Safety timeout: if getUserMedia hangs (waiting for permission), don't lock the UI
    const permissionTimeout = setTimeout(() => {
      toast.error("Microphone permission timed out. Please check your browser's address bar.");
    }, 8000);

    try {
      await startRecording();
      clearTimeout(permissionTimeout);
      console.log("[App] Recording started, successfully set state");
      setPhase("recording");
    } catch (err) {
      clearTimeout(permissionTimeout);
      console.error("[App] Failed to start recording:", err);
      toast.error("Microphone access is required.");
    }
  }, [startRecording]);

  const handleFinishSpeaking = () => {
    stopRecording();
  };

  useEffect(() => {
    // Reactive Transition: Selection -> Review
    if (phase === "recording" && status === "ready" && audioUrl) {
      setPhase("review");
    }
    // Error toast if recording fails
    if (status === 'idle' && phase === 'recording' && !audioBlob) {
      toast.error("Recording failed. Please check your mic and try again.");
    }
  }, [phase, status, audioUrl, audioBlob]);

  const handleReset = () => {
    clearAudio();
    setPhase("selection");
    setSelectedArena(null);
    setSelectedDifficulty(null);
    setCurrentTopic(null);
    setAnalysisResult(null);
    setShowDashboard(false);
  };

  const handleSubmitForAnalysis = async () => {
    if (!audioBlob) return;
    setIsAnalyzing(true);
    try {
      const extension = audioBlob.type.split('/')[1]?.split(';')[0] || 'webm';
      const formData = new FormData();
      // Fields first, file last
      formData.append('track', currentTopic.track);
      formData.append('difficulty', currentTopic.difficulty);
      formData.append('topic', currentTopic.topic);
      formData.append('isBehavioral', currentTopic.isBehavioral || false);
      formData.append('audio', audioBlob, `recording.${extension}`);

      const response = await fetch(`${API_URL}/api/upload`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Analysis request failed');
      }

      const data = await response.json();
      setAnalysisResult(data.analysis);
      setPhase("analysis");
      toast.success("Analysis complete!");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (!isAuthenticated) return <AuthView />;

  return (
    <div className="lg:h-screen lg:overflow-hidden bg-zinc-950 text-white flex flex-col selection:bg-violet-500/30">
      {/* Top Progress Bar */}
      <div 
        className="fixed top-0 left-0 h-0.5 bg-gradient-to-r from-violet-600 via-emerald-500 to-sky-500 z-50 transition-all duration-1000 ease-out" 
        style={{ width: isAnalyzing ? `${analysisProgress}%` : "100%", opacity: isAnalyzing ? 1 : 0 }}
      />

      {/* Header */}
      <header className="border-b border-zinc-800/50 px-4 lg:px-6 py-3 flex items-center justify-between bg-zinc-950/50 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-3 lg:gap-6">
          <div className="flex items-center gap-2 cursor-pointer flex-shrink-0" onClick={handleReset}>
            <div className="w-8 h-8 bg-zinc-900 border border-zinc-800 rounded-lg flex items-center justify-center glow-primary">
              <Mic className="w-4 h-4 text-violet-400" />
            </div>
            <span className="text-lg font-black tracking-tighter">SpeakForge</span>
          </div>

          {isSessionActive && (
            <>
              <div className="h-4 w-[1px] bg-zinc-800 mx-1 hidden sm:block" />
                <button
                  onClick={handleReset}
                  className="group flex items-center justify-center gap-2 ml-4 lg:ml-0 w-10 h-10 lg:w-auto lg:h-auto text-zinc-500 hover:text-zinc-200 transition-colors text-[11px] font-medium uppercase tracking-[0.1em] cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4 lg:w-3.5 lg:h-3.5 transition-transform group-hover:-translate-x-0.5" />
                  <span className="hidden sm:inline">Exit Session</span>
                </button>
              </>
            )}
          </div>
            
            <div className="flex items-center gap-3">
              {!isSessionActive ? (
                <>
                  <HeaderButton 
                    onClick={() => setShowDashboard(!showDashboard)}
                    icon={BarChart3}
                    label="Analytics"
                    variant="primary"
                  />
                  
                  <HeaderButton 
                    onClick={logout}
                    icon={LogOut}
                    label="Logout"
                    variant="secondary"
                  />
                </>
              ) : (
                <div className="flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-lg border border-violet-500/20 bg-violet-500/5 text-violet-400 text-[10px] font-bold uppercase tracking-widest animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.5)]" />
                  <span className="hidden sm:inline">Session Active</span>
                </div>
              )}
            </div>
        </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col px-4 lg:px-8 py-6 mt-4 lg:mt-0 lg:pt-6 lg:pb-12 overflow-y-auto lg:overflow-hidden">
        <div className="max-w-7xl w-full mx-auto flex-1 flex flex-col min-h-0">
          {showDashboard ? (
            <Dashboard onBack={() => setShowDashboard(false)} />
          ) : (
            <>
              {/* PHASE: SELECTION */}
              {phase === "selection" && (
                <>
                  <section className="text-center space-y-3 mb-6">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-[10px] font-bold text-violet-400 uppercase tracking-widest mb-4">
                      <Sparkles className="w-3 h-3" />
                      AI Coaching Engine
                    </div>
                    <h1 className="text-2xl sm:text-3xl lg:text-3xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-zinc-500 leading-tight">
                      Master Impromptu Speaking
                    </h1>
                    <div className="flex flex-wrap justify-center gap-3">
                      {[
                        { icon: Rocket, label: "PICK CHALLENGE", color: "text-emerald-400" },
                        { icon: Mic, label: "PRECISION DELIVERY", color: "text-violet-400" },
                        { icon: CheckCircle2, label: "AI COACHING", color: "text-sky-400" }
                      ].map((step, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-zinc-900/20 border border-zinc-800/30 px-2 py-0.5 rounded-full">
                          <step.icon className={`w-2.5 h-2.5 ${step.color}`} />
                          <span className="text-[7px] font-black text-zinc-400 uppercase tracking-widest">{step.label}</span>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="flex flex-col lg:flex-row gap-8 lg:gap-10 flex-1 min-h-0 items-start lg:items-center justify-center pt-2 pb-24 lg:pb-0">
                    {/* Left: Arena Podium */}
                    <div className="flex flex-col min-h-0 max-w-4xl flex-1 w-full">
                      <h2 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2 mb-4 self-start">
                        <Rocket className="w-3 h-3" /> 1. Select Arena
                      </h2>
                      <div className="flex flex-wrap gap-4 lg:overflow-y-auto lg:pr-4 pt-2 pb-8 justify-center items-start">
                        {arenaCards.map((card) => (
                          <motion.div 
                            layout
                            key={card.id} 
                            className="w-full sm:w-[calc(50%-8px)] lg:w-[calc(33.33%-12px)] min-w-full sm:min-w-[260px] p-1"
                          >
                            <ArenaCard
                              {...card}
                              isSelected={selectedArena === card.id}
                              onClick={() => handleArenaSelect(card.id)}
                            />
                          </motion.div>
                        ))}
                      </div>
                    </div>

                    {/* Right: Session Configuration */}
                    <div className="lg:w-80 w-full flex flex-col gap-6 lg:pt-10">
                      <div className="bg-zinc-900/40 backdrop-blur-xl border border-zinc-800/50 rounded-3xl p-6 space-y-6">
                        <div className="space-y-4">
                          <h2 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2 mb-4">
                            <Flame className="w-3 h-3" /> 2. Intensity
                          </h2>
                          <div className="grid grid-cols-3 gap-2">
                            {difficulties.map((diff) => (
                              <button
                                key={diff.key}
                                onClick={() => handleDifficultySelect(diff.key)}
                                className={`flex flex-col items-center justify-center py-3 rounded-xl border transition-all duration-300 active-scale ${
                                  selectedDifficulty === diff.key
                                    ? `${diff.color} ${diff.border} ${diff.activeBg} shadow-lg shadow-black/20`
                                    : `border-zinc-800/80 text-zinc-600 ${diff.bgHover}`
                                }`}
                              >
                                <span className="text-xl mb-1">{diff.emoji}</span>
                                <span className="text-[9px] font-black uppercase tracking-widest">{diff.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Desktop Action Button */}
                        <div className="hidden lg:block">
                          <button
                            onClick={handleGenerate}
                            disabled={!canGenerate || isGeneratingTopic}
                            className={`w-full group flex items-center justify-center gap-3 py-5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all duration-500 shadow-xl ${
                              canGenerate && !isGeneratingTopic
                                ? "bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:scale-102 hover:shadow-violet-500/20 cursor-pointer active:scale-98 animate-pulse shadow-violet-500/10"
                                : "bg-zinc-900 border border-zinc-800 text-zinc-700 cursor-not-allowed"
                            }`}
                          >
                            {isGeneratingTopic ? (
                              <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                              <>
                                <span>Forge Challenge</span>
                                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Mobile Sticky Action Bar */}
                    <div className="lg:hidden fixed bottom-0 left-0 right-0 p-4 bg-zinc-950/80 backdrop-blur-xl border-t border-zinc-800/50 z-50">
                      <button
                        onClick={handleGenerate}
                        disabled={!canGenerate || isGeneratingTopic}
                        className={`w-full group flex items-center justify-center gap-3 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all duration-500 shadow-xl ${
                          canGenerate && !isGeneratingTopic
                            ? "bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white active:scale-95 shadow-violet-500/20"
                            : "bg-zinc-900 border border-zinc-800 text-zinc-700 cursor-not-allowed"
                        }`}
                      >
                        {isGeneratingTopic ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <>
                            <span>Forge Challenge</span>
                            <ChevronRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </div>
                  </section>
                </>
              )}

              {/* PHASE: THINKING */}
              {phase === "thinking" && currentTopic && (
                <div className="flex-1 flex flex-col items-center justify-center animate-fade-in py-10">
                  <CountdownTimer
                    duration={PREP_DURATION}
                    topic={currentTopic.topic}
                    sourceTrack={currentTopic.track}
                    difficulty={currentTopic.difficulty}
                    onComplete={handleStartRecording}
                    onSkip={handleStartRecording}
                  />
                </div>
              )}

              {/* PHASE: RECORDING */}
              {phase === "recording" && (
                <div className="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto w-full animate-scale-in py-4">
                  <div className="w-full space-y-6 text-center">
                    <div className="space-y-4">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[10px] font-black uppercase tracking-widest animate-pulse">
                        <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        Recording Live
                      </div>
                      <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-white leading-tight px-4">
                        {currentTopic?.topic}
                      </h2>
                    </div>

                    <div className="space-y-2">
                      <div className={`font-mono text-sm transition-colors duration-300 ${recordingTime >= 54 ? "text-amber-500" : "text-zinc-500"}`}>
                        {formatTime(recordingTime)}
                      </div>
                      <AudioVisualizer stream={stream} isRecording={isRecording} />
                    </div>

                    <div className="flex flex-col items-center gap-4 pt-2">
                      <button
                        onClick={handleFinishSpeaking}
                        className="relative w-20 h-20 bg-rose-500 rounded-full flex items-center justify-center shadow-2xl shadow-rose-500/40 hover:scale-110 active:scale-90 transition-all cursor-pointer group"
                      >
                        <div className="absolute inset-0 bg-rose-500 rounded-full animate-ping opacity-20" />
                        <Square className="w-6 h-6 text-white fill-current" />
                      </button>
                      <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] animate-pulse">Click to finish speaking</p>
                    </div>
                  </div>
                </div>
              )}

              {/* PHASE: REVIEW */}
              {phase === "review" && (
                <div className="flex-1 flex flex-col items-center justify-center max-w-4xl mx-auto w-full animate-fade-in-up space-y-12 py-10">
                  <div className="text-center space-y-4">
                    <h2 className="text-lg font-black text-zinc-500 uppercase tracking-[0.3em]">Review Your Session</h2>
                    <p className="text-xl sm:text-2xl font-bold text-zinc-100 max-w-2xl mx-auto leading-relaxed">
                      "{currentTopic?.topic}"
                    </p>
                  </div>

                  <div className="w-full max-w-2xl space-y-10 relative">
                    {/* UI Lock Shield */}
                    {isAnalyzing && (
                      <div className="absolute inset-x-[-2rem] inset-y-[-2rem] bg-zinc-950/10 backdrop-blur-sm z-20 rounded-3xl animate-fade-in" />
                    )}

                    <div className="flex items-center justify-center">
                      {status === 'ready' && audioUrl ? (
                        <AudioPlayer src={audioUrl} />
                      ) : (
                        <div className="flex flex-center flex-col items-center gap-4 text-zinc-500 py-12 bg-zinc-900/20 rounded-3xl border border-zinc-800/50 w-full max-w-md">
                          <div className="relative">
                            <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
                            <div className="absolute inset-0 bg-violet-500 blur-xl opacity-20 animate-pulse" />
                          </div>
                          <span className="text-xs font-black uppercase tracking-[0.2em] animate-pulse">
                            Encoding High-Fidelity Audio...
                          </span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                      {isAnalyzing ? (
                        <div className="w-full h-14 rounded-full bg-white/5 border border-white/10 text-white/50 font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-3 animate-pulse cursor-not-allowed">
                          <Loader2 className="w-5 h-5 animate-spin text-violet-400" />
                          <span>{loadingTexts[loadingTextIndex]}</span>
                        </div>
                      ) : (
                        <>
                          <button 
                            onClick={handleReset} 
                            className="w-full sm:w-auto h-14 px-8 rounded-full border border-zinc-700 text-zinc-400 font-bold text-[11px] uppercase tracking-widest hover:bg-zinc-800 hover:text-white transition-all cursor-pointer"
                          >
                            Discard
                          </button>
                          <button 
                            onClick={handleSubmitForAnalysis} 
                            className="w-full sm:flex-1 h-14 px-10 rounded-full bg-white text-black font-black text-[11px] uppercase tracking-widest hover:scale-105 hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] transition-all cursor-pointer flex items-center justify-center gap-2"
                          >
                            Get AI Feedback <Sparkles className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {isAnalyzing && (
                    <div className="w-full space-y-6 animate-pulse">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {[1,2,3,4].map(i => <Skeleton key={i} className="h-20" />)}
                      </div>
                      <Skeleton className="h-64 w-full" />
                    </div>
                  )}
                </div>
              )}

              {/* PHASE: ANALYSIS */}
              {phase === "analysis" && analysisResult && (
                <div className="animate-fade-in-up space-y-10 pb-20">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                      { label: "Confidence", val: analysisResult.confidenceScore, color: "text-violet-400" },
                      { label: "Clarity", val: analysisResult.clarityScore, color: "text-emerald-400" },
                      { label: "Structure", val: analysisResult.structureScore, color: "text-amber-400" },
                      { label: "Fillers", val: analysisResult.fillerWordsCount, color: "text-rose-400" }
                    ].map(stat => (
                      <div key={stat.label} className="bg-zinc-900/50 border border-zinc-800/50 p-6 rounded-3xl text-center">
                        <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block mb-2">{stat.label}</span>
                        <div className={`text-3xl font-black ${stat.color}`}>{stat.val}{stat.label !== 'Fillers' && <span className="text-xs opacity-30">/10</span>}</div>
                      </div>
                    ))}
                  </div>

                  <div className="grid lg:grid-cols-5 gap-10">
                    <div className="lg:col-span-3 space-y-8">
                      <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-3xl p-8 space-y-8">
                        <div className="space-y-4">
                          <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-violet-400" /> Coaching Insight
                          </h3>
                          <p className="text-zinc-300 leading-relaxed italic text-sm">"{analysisResult.overallFeedback}"</p>
                        </div>
                        
                        <div className="grid sm:grid-cols-2 gap-8 pt-4 border-t border-zinc-800/50">
                          {analysisResult.strengths && analysisResult.strengths.length > 0 && (
                            <div className="space-y-4">
                              <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Strengths</h4>
                              <ul className="space-y-2">
                                {analysisResult.strengths.map((s, i) => (
                                  <li key={i} className="text-xs text-zinc-400 flex items-start gap-2">
                                    <div className="w-1 h-1 rounded-full bg-emerald-500 mt-1.5 shrink-0" /> {s}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {analysisResult.weaknesses && analysisResult.weaknesses.length > 0 && (
                            <div className="space-y-4">
                              <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Growth Areas</h4>
                              <ul className="space-y-2">
                                {analysisResult.weaknesses.map((w, i) => (
                                  <li key={i} className="text-xs text-zinc-400 flex items-start gap-2">
                                    <div className="w-1 h-1 rounded-full bg-amber-500 mt-1.5 shrink-0" /> {w}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="lg:col-span-2 space-y-6">
                      <div className="bg-gradient-to-br from-violet-600/10 to-transparent border border-violet-500/20 rounded-3xl p-8 space-y-6 sticky top-32">
                        <div className="space-y-2">
                          <span className="text-[10px] font-black text-violet-400 uppercase tracking-widest">Model Response</span>
                          <h3 className="text-xl font-bold">You could say something like this...</h3>
                        </div>
                        <p className="text-zinc-200 text-sm leading-relaxed italic opacity-80">"{analysisResult.idealAnswer}"</p>
                        <button onClick={handleReset} className="w-full py-4 rounded-2xl bg-zinc-100 text-zinc-950 font-black text-xs uppercase tracking-widest hover:bg-white transition-all cursor-pointer">
                          Start New Session
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function ArenaCard({ icon: Icon, title, description, color, shadowColor, ringColor, isSelected, onClick }) {
  const glowColor = color.replace('bg-', 'from-').replace('-500', '-500/20');
  
  // Sharp 'Electrified' Selection Styles
  const selectionStyles = {
    'bg-emerald-500': 'border-emerald-500/50 ring-2 ring-emerald-500/50 shadow-lg shadow-emerald-500/20 bg-emerald-500/5',
    'bg-pink-500': 'border-pink-500/50 ring-2 ring-pink-500/50 shadow-lg shadow-pink-500/20 bg-pink-500/5',
    'bg-rose-500': 'border-rose-500/50 ring-2 ring-rose-500/50 shadow-lg shadow-rose-500/20 bg-rose-500/5',
    'bg-orange-500': 'border-orange-500/50 ring-2 ring-orange-500/50 shadow-lg shadow-orange-500/20 bg-orange-500/5',
    'bg-violet-500': 'border-violet-500/50 ring-2 ring-violet-500/50 shadow-lg shadow-violet-500/20 bg-violet-500/5',
  };

  const activeStyles = selectionStyles[color] || 'border-zinc-400/50 ring-2 ring-zinc-400/50 shadow-lg shadow-zinc-400/20 bg-zinc-400/5';
  const iconColorClass = color.replace('bg-', 'text-').replace('-500', '-400');

  return (
    <button
      onClick={onClick}
      className={`w-full group relative text-left backdrop-blur-xl border transition-all duration-500 cursor-pointer rounded-2xl p-6 ${
        isSelected
          ? `bg-zinc-800/80 ${activeStyles} -translate-y-1 scale-102 z-10`
          : "bg-zinc-900/40 border-zinc-800/50 hover:border-zinc-700 hover:bg-zinc-800/30 shadow-xl shadow-black/20"
      }`}
    >
      <div className="flex flex-col gap-5">
        <div className="relative">
          {/* Track Icon Aura - Compressed for Sharpness */}
          <div className={`absolute inset-0 bg-gradient-to-br ${glowColor} to-transparent blur-xl rounded-full transition-opacity duration-500 ${
            isSelected ? "opacity-60" : "opacity-30 group-hover:opacity-50"
          }`} />
          
          <div className={`relative w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg group-hover:scale-110 transition-all duration-500 ${
            isSelected ? `${color} ring-2 ring-white/20` : `${color} bg-opacity-10`
          }`}>
            <Icon className={`w-6 h-6 transition-colors duration-500 ${
              isSelected ? "text-white" : iconColorClass
            }`} />
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3 className={`text-sm font-bold truncate tracking-tight transition-colors duration-500 ${isSelected ? "text-white" : "text-zinc-100"}`}>{title}</h3>
            <ChevronRight className={`w-4 h-4 flex-shrink-0 transition-all duration-500 ${isSelected ? "text-white translate-x-1" : "text-zinc-600 group-hover:text-zinc-400 group-hover:translate-x-1"}`} />
          </div>
          <p className={`text-[10px] leading-relaxed line-clamp-2 font-medium transition-colors duration-500 ${isSelected ? "text-white/90" : "text-zinc-500 opacity-70"}`}>{description}</p>
        </div>
      </div>
    </button>
  );
}
