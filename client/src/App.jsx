/**
 * App.jsx — Production-Ready SpeakForge
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { 
  Building2, Cpu, Flame, Rocket, Shuffle, Sparkles, Mic, 
  ChevronRight, RotateCcw, Square, BarChart3, LogOut, 
  Loader2, Play, CheckCircle2, History, X, ArrowLeft,
  Gauge, Timer, PauseCircle, Eye, Video, VideoOff,
  TrendingUp, TrendingDown, Minus, ShieldAlert, Award, Brain,
  Bot, Users, Copy, Check
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Toaster, toast } from "react-hot-toast";
import { getRandomTopic, getTopicCount } from "./data/topics";
import CountdownTimer from "./components/CountdownTimer";
import { useAudioRecorder } from "./hooks/useAudioRecorder";
import { useVisionPresence } from "./hooks/useVisionPresence";
import { UserProvider, useAuth } from "./contexts/UserContext";
import AuthView from "./components/AuthView";
import Dashboard from "./components/Dashboard";
import AudioVisualizer from "./components/AudioVisualizer";
import AudioPlayer from "./components/AudioPlayer";
import CameraPreview from "./components/CameraPreview";
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
  const [copiedExemplar, setCopiedExemplar] = useState(false);
  const isSessionActive = ["thinking", "recording", "review"].includes(phase);

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
  const { status, isRecording, audioUrl, audioBlob, stream, startRecording, stopRecording, clearAudio } = useAudioRecorder();
  const vision = useVisionPresence();

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
      vision.startTracking();
      clearTimeout(permissionTimeout);
      console.log("[App] Recording started, successfully set state");
      setPhase("recording");
    } catch (err) {
      clearTimeout(permissionTimeout);
      console.error("[App] Failed to start recording:", err);
      toast.error("Microphone access is required.");
    }
  }, [startRecording, vision]);

  const handleFinishSpeaking = () => {
    stopRecording();
    vision.stopTracking();
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
    vision.stopCamera();
    setPhase("selection");
    setSelectedArena(null);
    setSelectedDifficulty(null);
    setCurrentTopic(null);
    setAnalysisResult(null);
    setShowDashboard(false);
  };

  const handleCopyExemplar = () => {
    if (!analysisResult?.idealAnswer) return;
    navigator.clipboard?.writeText(analysisResult.idealAnswer);
    setCopiedExemplar(true);
    toast.success("Model response copied to clipboard!");
    setTimeout(() => setCopiedExemplar(false), 2000);
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
      if (vision.visualSummary) {
        formData.append('visualMetrics', JSON.stringify(vision.visualSummary));
      }
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
      setAnalysisResult({ 
        ...data.analysis, 
        deliveryMetrics: data.deliveryMetrics || data.analysis?.deliveryMetrics,
        visualMetrics: data.visualMetrics || data.analysis?.visualMetrics,
        habitTrends: data.habitTrends || data.analysis?.habitTrends,
        councilReports: data.analysis?.councilReports,
      });
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
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col selection:bg-violet-500/30">
      {/* Top Progress Bar */}
      <div 
        className="fixed top-0 left-0 h-0.5 bg-gradient-to-r from-violet-600 via-emerald-500 to-sky-500 z-50 transition-all duration-1000 ease-out" 
        style={{ width: isAnalyzing ? `${analysisProgress}%` : "100%", opacity: isAnalyzing ? 1 : 0 }}
      />

      {/* Header */}
      <header className="border-b border-zinc-800/50 px-4 sm:px-6 py-3 flex items-center justify-between bg-zinc-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-3 sm:gap-6">
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
                className="group flex items-center justify-center gap-2 ml-2 sm:ml-0 text-zinc-500 hover:text-zinc-200 transition-colors text-[11px] font-medium uppercase tracking-[0.1em] cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
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
      <main className="flex-1 flex flex-col px-4 sm:px-6 lg:px-8 py-5 sm:py-7 overflow-y-auto">
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
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4 w-full pt-1 pb-6">
                        {arenaCards.map((card) => (
                          <motion.div 
                            layout
                            key={card.id} 
                            className="w-full"
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

                        {/* Camera Presence Setting */}
                        <div className="pt-2 border-t border-zinc-800/40">
                          <CameraPreview
                            videoRef={vision.videoRef}
                            isCameraActive={vision.isCameraActive}
                            isModelLoading={vision.isModelLoading}
                            faceDetected={vision.faceDetected}
                            liveEyeContact={vision.liveEyeContact}
                            toggleCamera={vision.toggleCamera}
                          />
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

                    {/* Live Camera HUD if Camera is Active */}
                    {vision.isCameraActive && (
                      <div className="max-w-xs mx-auto w-full pt-1">
                        <CameraPreview
                          videoRef={vision.videoRef}
                          isCameraActive={vision.isCameraActive}
                          isModelLoading={vision.isModelLoading}
                          faceDetected={vision.faceDetected}
                          liveEyeContact={vision.liveEyeContact}
                          toggleCamera={vision.toggleCamera}
                        />
                      </div>
                    )}

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
                <div className="animate-fade-in-up space-y-6 pb-16 w-full max-w-7xl mx-auto">
                  {/* ── Top Bar: Multi-Agent Council Status & Quick Actions ── */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-zinc-900/40 border border-zinc-800/50 rounded-2xl">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-[10px] font-black uppercase tracking-widest">
                        <Bot className="w-3.5 h-3.5" />
                        Multi-Agent Council
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[10px] font-medium text-zinc-400">
                        <span className="flex items-center gap-1 text-emerald-400 font-semibold">✓ Content</span>
                        <span className="text-zinc-600">•</span>
                        <span className="flex items-center gap-1 text-cyan-400 font-semibold">✓ Presence</span>
                        <span className="text-zinc-600">•</span>
                        <span className="flex items-center gap-1 text-amber-400 font-semibold">✓ Memory</span>
                        <span className="text-zinc-600">•</span>
                        <span className="flex items-center gap-1 text-violet-400 font-semibold">✓ Lead Coach</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 self-end sm:self-auto">
                      <button
                        onClick={handleReset}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-zinc-950 font-black text-xs uppercase tracking-wider hover:bg-zinc-200 transition-all cursor-pointer shadow-lg shadow-white/5"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>New Session</span>
                      </button>
                    </div>
                  </div>

                  {/* ── Metric Ribbon (All Vital Scores in One Compact Row) ── */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
                    {/* Confidence */}
                    <div className="bg-zinc-900/50 border border-zinc-800/60 p-3 sm:p-3.5 rounded-2xl text-center">
                      <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block mb-1">Confidence</span>
                      <div className="text-2xl font-black text-violet-400">
                        {analysisResult.confidenceScore}<span className="text-xs opacity-40 font-normal">/10</span>
                      </div>
                    </div>

                    {/* Clarity */}
                    <div className="bg-zinc-900/50 border border-zinc-800/60 p-3 sm:p-3.5 rounded-2xl text-center">
                      <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block mb-1">Clarity</span>
                      <div className="text-2xl font-black text-emerald-400">
                        {analysisResult.clarityScore}<span className="text-xs opacity-40 font-normal">/10</span>
                      </div>
                    </div>

                    {/* Structure */}
                    <div className="bg-zinc-900/50 border border-zinc-800/60 p-3 sm:p-3.5 rounded-2xl text-center">
                      <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block mb-1">Structure</span>
                      <div className="text-2xl font-black text-amber-400">
                        {analysisResult.structureScore}<span className="text-xs opacity-40 font-normal">/10</span>
                      </div>
                    </div>

                    {/* Fillers */}
                    <div className="bg-zinc-900/50 border border-zinc-800/60 p-3 sm:p-3.5 rounded-2xl text-center">
                      <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block mb-1">Fillers</span>
                      <div className="text-2xl font-black text-rose-400">
                        {analysisResult.fillerWordsCount}
                      </div>
                    </div>

                    {/* Speaking Pace (WPM) */}
                    <div className="bg-zinc-900/50 border border-zinc-800/60 p-3 sm:p-3.5 rounded-2xl text-center">
                      <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block mb-1">Pacing</span>
                      <div className="text-2xl font-black text-cyan-400">
                        {analysisResult.deliveryMetrics?.wpm || "—"}<span className="text-xs font-normal text-zinc-500 ml-1">WPM</span>
                      </div>
                    </div>

                    {/* Presence or Rhythm */}
                    <div className="bg-zinc-900/50 border border-zinc-800/60 p-3 sm:p-3.5 rounded-2xl text-center">
                      <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block mb-1">
                        {analysisResult.visualMetrics?.enabled ? "Visual Score" : "Rhythm"}
                      </span>
                      <div className="text-2xl font-black text-indigo-400">
                        {analysisResult.visualMetrics?.enabled 
                          ? (analysisResult.visualMetrics.presenceScore || "—") 
                          : (analysisResult.deliveryMetrics?.pacingScore || "—")}
                        <span className="text-xs opacity-40 font-normal">/10</span>
                      </div>
                    </div>
                  </div>

                  {/* ── Main Responsive Split Layout ── */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    
                    {/* ── Left Column (7 cols): Primary Coaching & Model Answer ── */}
                    <div className="lg:col-span-7 space-y-6">
                      
                      {/* Coaching Insight Card */}
                      <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-3xl p-5 sm:p-6 space-y-4">
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                              <Sparkles className="w-4 h-4 text-violet-400" /> Executive Coaching Insight
                            </h3>
                            {analysisResult.starMethodUsed !== null && (
                              <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                                analysisResult.starMethodUsed 
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                                  : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                              }`}>
                                {analysisResult.starMethodUsed ? "✓ STAR Method Identified" : "⚠ STAR Incomplete"}
                              </span>
                            )}
                          </div>
                          <p className="text-zinc-200 leading-relaxed text-sm italic sm:text-[14.5px] font-medium bg-zinc-950/40 p-4 rounded-2xl border border-zinc-800/30">
                            "{analysisResult.overallFeedback}"
                          </p>
                        </div>

                        {/* Strengths & Growth Areas in Clean 2-Col Grid */}
                        <div className="grid sm:grid-cols-2 gap-3.5 pt-3 border-t border-zinc-800/50">
                          {analysisResult.strengths && analysisResult.strengths.length > 0 && (
                            <div className="space-y-2.5 bg-zinc-950/30 p-3.5 rounded-2xl border border-emerald-500/10">
                              <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Strengths
                              </h4>
                              <ul className="space-y-1.5">
                                {analysisResult.strengths.map((s, i) => (
                                  <li key={i} className="text-xs text-zinc-300 flex items-start gap-2 leading-snug">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1 shrink-0" />
                                    <span>{s}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {analysisResult.weaknesses && analysisResult.weaknesses.length > 0 && (
                            <div className="space-y-2.5 bg-zinc-950/30 p-3.5 rounded-2xl border border-amber-500/10">
                              <h4 className="text-[10px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                                <ShieldAlert className="w-3.5 h-3.5" /> Growth Areas
                              </h4>
                              <ul className="space-y-1.5">
                                {analysisResult.weaknesses.map((w, i) => (
                                  <li key={i} className="text-xs text-zinc-300 flex items-start gap-2 leading-snug">
                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1 shrink-0" />
                                    <span>{w}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Model Exemplar Response Card */}
                      <div className="bg-gradient-to-br from-violet-600/10 via-zinc-900/40 to-transparent border border-violet-500/20 rounded-3xl p-5 sm:p-6 space-y-3.5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="space-y-0.5">
                            <span className="text-[10px] font-black text-violet-400 uppercase tracking-widest block">
                              Model Exemplar Response
                            </span>
                            <h4 className="text-sm sm:text-base font-bold text-white">
                              How a Principal / Executive would deliver this:
                            </h4>
                          </div>
                          <button
                            onClick={handleCopyExemplar}
                            className="text-[11px] font-bold text-zinc-300 hover:text-white px-3 py-1.5 rounded-xl bg-zinc-800/80 border border-zinc-700/60 hover:bg-zinc-700 transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                            title="Copy to clipboard"
                          >
                            {copiedExemplar ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="text-emerald-400">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                        <p className="text-zinc-200 text-xs sm:text-sm leading-relaxed italic opacity-90 bg-zinc-950/50 p-4 rounded-2xl border border-violet-500/10">
                          "{analysisResult.idealAnswer}"
                        </p>
                      </div>

                    </div>

                    {/* ── Right Column (5 cols): AI Telemetry (Habit RAG + Acoustics + Body Language) ── */}
                    <div className="lg:col-span-5 space-y-4">
                      
                      {/* Habit Evolution & Blind Spots Card (RAG Memory) */}
                      {analysisResult.habitTrends && (
                        <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-3xl p-4 sm:p-5 space-y-3.5">
                          <div className="flex items-center justify-between border-b border-zinc-800/50 pb-2.5">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                                <Brain className="w-4 h-4" />
                              </div>
                              <div>
                                <h4 className="text-xs font-black text-zinc-300 uppercase tracking-wider">
                                  Habit Evolution
                                </h4>
                                <span className="text-[9px] font-bold text-zinc-500 uppercase">RAG Vector Memory</span>
                              </div>
                            </div>

                            <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-xl flex items-center gap-1 border ${
                              analysisResult.habitTrends.trend === 'improving'
                                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-400'
                                : analysisResult.habitTrends.trend === 'regressing'
                                ? 'bg-rose-950/60 border-rose-500/40 text-rose-400'
                                : analysisResult.habitTrends.trend === 'steady'
                                ? 'bg-cyan-950/60 border-cyan-500/40 text-cyan-400'
                                : 'bg-zinc-900 border-zinc-700 text-zinc-400'
                            }`}>
                              {analysisResult.habitTrends.trend === 'improving' && <TrendingUp className="w-3 h-3" />}
                              {analysisResult.habitTrends.trend === 'regressing' && <TrendingDown className="w-3 h-3" />}
                              {analysisResult.habitTrends.trend === 'steady' && <Minus className="w-3 h-3" />}
                              {analysisResult.habitTrends.trend === 'baseline' && <History className="w-3 h-3" />}
                              {analysisResult.habitTrends.trend.toUpperCase()}
                            </span>
                          </div>

                          <p className="text-xs text-zinc-300 leading-relaxed italic bg-zinc-950/40 p-3 rounded-xl border border-zinc-800/30">
                            "{analysisResult.habitTrends.comparisonSummary}"
                          </p>

                          {/* Recurring Habits / Milestones */}
                          {(analysisResult.habitTrends.recurringHabits?.length > 0 || analysisResult.habitTrends.milestonesAchieved?.length > 0) && (
                            <div className="grid grid-cols-1 gap-2 pt-1">
                              {analysisResult.habitTrends.recurringHabits && analysisResult.habitTrends.recurringHabits.length > 0 && (
                                <div className="bg-rose-950/20 border border-rose-500/20 p-2.5 rounded-xl space-y-1">
                                  <span className="text-[9px] font-black text-rose-400 uppercase tracking-wider flex items-center gap-1">
                                    <ShieldAlert className="w-3 h-3" /> Recurring Blind Spots
                                  </span>
                                  <ul className="space-y-1">
                                    {analysisResult.habitTrends.recurringHabits.map((h, i) => (
                                      <li key={i} className="text-[11px] text-zinc-300 flex items-start gap-1.5 leading-tight">
                                        <span className="text-rose-400">•</span> {h}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {analysisResult.habitTrends.milestonesAchieved && analysisResult.habitTrends.milestonesAchieved.length > 0 && (
                                <div className="bg-emerald-950/20 border border-emerald-500/20 p-2.5 rounded-xl space-y-1">
                                  <span className="text-[9px] font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                                    <Award className="w-3 h-3" /> Milestones Unlocked
                                  </span>
                                  <ul className="space-y-1">
                                    {analysisResult.habitTrends.milestonesAchieved.map((m, i) => (
                                      <li key={i} className="text-[11px] text-emerald-300 flex items-start gap-1.5 leading-tight">
                                        <span className="text-emerald-400">✓</span> {m}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Speech Delivery & Rhythm Card (Acoustic AI) */}
                      {analysisResult.deliveryMetrics && (
                        <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-3xl p-4 sm:p-5 space-y-3.5">
                          <div className="flex items-center justify-between border-b border-zinc-800/50 pb-2.5">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                                <Gauge className="w-4 h-4" />
                              </div>
                              <div>
                                <h4 className="text-xs font-black text-zinc-300 uppercase tracking-wider">
                                  Delivery & Rhythm
                                </h4>
                                <span className="text-[9px] font-bold text-zinc-500 uppercase">Whisper Prosody</span>
                              </div>
                            </div>
                            <span className="text-[11px] font-black text-cyan-400 bg-cyan-950/60 border border-cyan-800/50 px-2.5 py-0.5 rounded-xl">
                              Score: {analysisResult.deliveryMetrics.pacingScore}/10
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-center">
                            <div className="bg-zinc-950/50 p-2 rounded-xl border border-zinc-800/40">
                              <span className="text-[9px] font-black text-zinc-500 uppercase block">Freezes (≥2s)</span>
                              <span className="text-base font-black text-zinc-100">{analysisResult.deliveryMetrics.awkwardPausesCount}</span>
                              <p className="text-[10px] text-zinc-400 truncate">
                                {analysisResult.deliveryMetrics.awkwardPausesCount === 0 ? "✓ Fluid flow" : `Longest: ${analysisResult.deliveryMetrics.longestPauseSec}s`}
                              </p>
                            </div>

                            <div className="bg-zinc-950/50 p-2 rounded-xl border border-zinc-800/40">
                              <span className="text-[9px] font-black text-zinc-500 uppercase block">Talk vs Pause</span>
                              <span className="text-base font-black text-zinc-100">
                                {100 - analysisResult.deliveryMetrics.silencePercentage}%
                              </span>
                              <p className="text-[10px] text-zinc-400 truncate">
                                {analysisResult.deliveryMetrics.silencePercentage}% dead air
                              </p>
                            </div>
                          </div>

                          {/* Speaking vs Silence Visual Bar */}
                          <div className="space-y-1.5 pt-1">
                            <div className="h-1.5 w-full bg-zinc-800/80 rounded-full overflow-hidden flex">
                              <div 
                                className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full"
                                style={{ width: `${Math.max(5, 100 - analysisResult.deliveryMetrics.silencePercentage)}%` }}
                              />
                              <div 
                                className="h-full bg-zinc-700/80"
                                style={{ width: `${analysisResult.deliveryMetrics.silencePercentage}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-[9px] font-semibold text-zinc-500">
                              <span className="text-emerald-400">{100 - analysisResult.deliveryMetrics.silencePercentage}% active talk</span>
                              <span>{analysisResult.deliveryMetrics.totalSilenceSec}s paused</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Visual Presence Card (MediaPipe Vision - only when active) */}
                      {analysisResult.visualMetrics && analysisResult.visualMetrics.enabled && (
                        <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-3xl p-4 sm:p-5 space-y-3.5">
                          <div className="flex items-center justify-between border-b border-zinc-800/50 pb-2.5">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                                <Eye className="w-4 h-4" />
                              </div>
                              <div>
                                <h4 className="text-xs font-black text-zinc-300 uppercase tracking-wider">
                                  Visual Presence
                                </h4>
                                <span className="text-[9px] font-bold text-zinc-500 uppercase">MediaPipe Vision</span>
                              </div>
                            </div>
                            <span className="text-[11px] font-black text-indigo-400 bg-indigo-950/60 border border-indigo-800/50 px-2.5 py-0.5 rounded-xl">
                              Score: {analysisResult.visualMetrics.presenceScore}/10
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-center">
                            <div className="bg-zinc-950/50 p-2 rounded-xl border border-zinc-800/40">
                              <span className="text-[9px] font-black text-zinc-500 uppercase block">Eye Contact</span>
                              <span className="text-base font-black text-zinc-100">{analysisResult.visualMetrics.eyeContactPercent}%</span>
                              <p className={`text-[10px] font-semibold ${analysisResult.visualMetrics.eyeContactPercent >= 70 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                {analysisResult.visualMetrics.eyeContactRating}
                              </p>
                            </div>

                            <div className="bg-zinc-950/50 p-2 rounded-xl border border-zinc-800/40">
                              <span className="text-[9px] font-black text-zinc-500 uppercase block">Posture</span>
                              <span className="text-xs font-bold text-zinc-200 block truncate mt-0.5">{analysisResult.visualMetrics.posture}</span>
                              <p className="text-[10px] text-zinc-500">Alignment</p>
                            </div>

                            <div className="bg-zinc-950/50 p-2 rounded-xl border border-zinc-800/40">
                              <span className="text-[9px] font-black text-zinc-500 uppercase block">Composure</span>
                              <span className="text-xs font-bold text-zinc-200 block truncate mt-0.5">{analysisResult.visualMetrics.headStability}</span>
                              <p className="text-[10px] text-zinc-500">
                                {analysisResult.visualMetrics.fidgetAlerts === 0 ? "✓ Stillness" : `${analysisResult.visualMetrics.fidgetAlerts} shifts`}
                              </p>
                            </div>

                            <div className="bg-zinc-950/50 p-2 rounded-xl border border-zinc-800/40">
                              <span className="text-[9px] font-black text-zinc-500 uppercase block">Expression</span>
                              <span className="text-xs font-bold text-zinc-200 block truncate mt-0.5">{analysisResult.visualMetrics.expressiveness}</span>
                              <p className="text-[10px] text-zinc-500">
                                {analysisResult.visualMetrics.smilesDetected > 0 ? `${analysisResult.visualMetrics.smilesDetected} smiles` : "Composed"}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                    </div>
                  </div>

                  {/* ── Bottom Action Bar ── */}
                  <div className="flex items-center justify-center pt-2">
                    <button
                      onClick={handleReset}
                      className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white font-bold text-xs uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-2 hover:bg-zinc-800 shadow-xl"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Start Another Challenge</span>
                    </button>
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
