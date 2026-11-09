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
    trackName: "HR & Behavioral",
    icon: Building2,
    title: "HR & Behavioral",
    description: "HR screening, STAR behavioral scenarios, workplace conflict, and leadership questions.",
    color: "bg-emerald-500",
    shadowColor: "shadow-emerald-500/10",
    ringColor: "ring-emerald-500/50",
  },
  {
    id: "tech",
    trackName: "Core Tech & CS",
    icon: Cpu,
    title: "Core Tech & CS",
    description: "OOP, DBMS, OS, Computer Networks, DSA concepts, and Fresher System Design.",
    color: "bg-blue-500",
    shadowColor: "shadow-blue-500/10",
    ringColor: "ring-blue-500/50",
  },
  {
    id: "storytelling",
    trackName: "Storytelling & Social",
    icon: Sparkles,
    title: "Storytelling & Social",
    description: "Master captivating storytelling, small talk, social charisma, and conversational hooks.",
    color: "bg-amber-500",
    shadowColor: "shadow-amber-500/10",
    ringColor: "ring-amber-500/50",
  },
  {
    id: "drill",
    trackName: "Never-Go-Blank Drill",
    icon: Flame,
    title: "Never-Go-Blank Drill",
    description: "60-second spontaneous association drills on everyday concepts to eliminate freezing.",
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

  const [jobProgressStep, setJobProgressStep] = useState('transcribing');
  const [activeJobSessionId, setActiveJobSessionId] = useState(null);
  const pollTimerRef = useRef(null);
  const phaseRef = useRef(phase);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

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

  const startJobPolling = useCallback((sessionId, topicText) => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);

    pollTimerRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/api/upload/status/${sessionId}`, {
          credentials: 'include',
        });
        if (!res.ok) return;

        const data = await res.json();
        if (data.progressStep) {
          setJobProgressStep(data.progressStep);
        }

        if (data.status === 'completed' && data.analysisJson) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
          setIsAnalyzing(false);
          setActiveJobSessionId(null);

          const fullResult = {
            ...data.analysisJson,
            deliveryMetrics: data.analysisJson.deliveryMetrics,
            visualMetrics: data.analysisJson.visualMetrics,
            habitTrends: data.analysisJson.habitTrends,
            vocabularyUpgrades: data.analysisJson.vocabularyUpgrades,
          };
          setAnalysisResult(fullResult);

          if (phaseRef.current === 'review') {
            setPhase('analysis');
            toast.success('Analysis complete!');
          } else {
            toast((t) => (
              <div className="flex items-center gap-3 py-1">
                <Sparkles className="w-5 h-5 text-emerald-400 shrink-0" />
                <div className="text-left text-xs">
                  <p className="font-bold text-white">Analysis Ready!</p>
                  <p className="text-zinc-400 text-[11px] truncate max-w-[180px]">{topicText || data.topic}</p>
                </div>
                <button
                  onClick={() => {
                    toast.dismiss(t.id);
                    setAnalysisResult(fullResult);
                    setPhase('analysis');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-bold text-[11px] cursor-pointer shrink-0 ml-2"
                >
                  View
                </button>
              </div>
            ), { duration: 8000 });
          }
        } else if (data.status === 'failed') {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
          setIsAnalyzing(false);
          setActiveJobSessionId(null);
          toast.error(`Analysis failed: ${data.errorMessage || 'Please try again.'}`);
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 1500);
  }, [API_URL]);

  const handleSubmitForAnalysis = async () => {
    if (!audioBlob) return;
    setIsAnalyzing(true);
    setJobProgressStep('transcribing');
    try {
      const extension = audioBlob.type.split('/')[1]?.split(';')[0] || 'webm';
      const formData = new FormData();
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
      setActiveJobSessionId(data.sessionId);
      startJobPolling(data.sessionId, currentTopic.topic);
    } catch (err) {
      toast.error(err.message);
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
                            stream={vision.cameraStream}
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
                          stream={vision.cameraStream}
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
                        <div className="w-full h-14 rounded-full bg-violet-500/10 border border-violet-500/30 text-violet-300 font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-3 animate-pulse cursor-not-allowed">
                          <Loader2 className="w-5 h-5 animate-spin text-violet-400" />
                          <span>Processing in Background Queue...</span>
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
                    <div className="w-full bg-zinc-900/60 border border-violet-500/20 rounded-3xl p-6 sm:p-8 space-y-6 animate-fade-in-up">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-5">
                        <div className="space-y-1">
                          <span className="text-[10px] font-black text-violet-400 uppercase tracking-widest flex items-center gap-1.5">
                            <Bot className="w-3.5 h-3.5" /> BullMQ / Redis Queue Active
                          </span>
                          <h3 className="text-base sm:text-lg font-bold text-white">Analyzing Your Speech</h3>
                          <p className="text-xs text-zinc-400">Audio uploaded. You can wait here or practice your next prompt immediately.</p>
                        </div>
                        <button
                          onClick={() => {
                            setPhase("selection");
                            clearAudio();
                            setSelectedArena(null);
                            setSelectedDifficulty(null);
                            toast("Analysis running in background. You will be notified when ready!", { icon: "🔔" });
                          }}
                          className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white text-xs font-bold transition-all cursor-pointer border border-zinc-700/60 flex items-center justify-center gap-2 shrink-0 shadow-lg"
                        >
                          <span>Practice Next Prompt</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* 3-Step Live Progress Stepper */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {/* Step 1 */}
                        <div className={`p-4 rounded-2xl border transition-all ${
                          jobProgressStep === 'transcribing'
                            ? 'bg-violet-500/10 border-violet-500/40 text-violet-300'
                            : 'bg-zinc-950/40 border-zinc-800 text-zinc-400'
                        }`}>
                          <div className="flex items-center gap-2 mb-1.5">
                            <div className={`w-2 h-2 rounded-full ${jobProgressStep === 'transcribing' ? 'bg-violet-400 animate-ping' : 'bg-emerald-400'}`} />
                            <span className="text-[10px] font-black uppercase tracking-wider">Step 1</span>
                          </div>
                          <p className="text-xs font-bold text-white">Acoustic Transcription</p>
                          <p className="text-[11px] text-zinc-500 mt-0.5">Whisper Cadence & Freezes</p>
                        </div>

                        {/* Step 2 */}
                        <div className={`p-4 rounded-2xl border transition-all ${
                          jobProgressStep === 'evaluating'
                            ? 'bg-violet-500/10 border-violet-500/40 text-violet-300'
                            : (jobProgressStep === 'storing' || jobProgressStep === 'ready')
                            ? 'bg-zinc-950/40 border-zinc-800 text-zinc-400'
                            : 'bg-zinc-950/20 border-zinc-900 text-zinc-600'
                        }`}>
                          <div className="flex items-center gap-2 mb-1.5">
                            <div className={`w-2 h-2 rounded-full ${jobProgressStep === 'evaluating' ? 'bg-violet-400 animate-ping' : (jobProgressStep === 'storing' || jobProgressStep === 'ready') ? 'bg-emerald-400' : 'bg-zinc-700'}`} />
                            <span className="text-[10px] font-black uppercase tracking-wider">Step 2</span>
                          </div>
                          <p className="text-xs font-bold text-white">Multi-Agent Council</p>
                          <p className="text-[11px] text-zinc-500 mt-0.5">Content, Delivery & Memory</p>
                        </div>

                        {/* Step 3 */}
                        <div className={`p-4 rounded-2xl border transition-all ${
                          jobProgressStep === 'storing'
                            ? 'bg-violet-500/10 border-violet-500/40 text-violet-300'
                            : jobProgressStep === 'ready'
                            ? 'bg-zinc-950/40 border-zinc-800 text-zinc-400'
                            : 'bg-zinc-950/20 border-zinc-900 text-zinc-600'
                        }`}>
                          <div className="flex items-center gap-2 mb-1.5">
                            <div className={`w-2 h-2 rounded-full ${jobProgressStep === 'storing' ? 'bg-violet-400 animate-ping' : jobProgressStep === 'ready' ? 'bg-emerald-400' : 'bg-zinc-700'}`} />
                            <span className="text-[10px] font-black uppercase tracking-wider">Step 3</span>
                          </div>
                          <p className="text-xs font-bold text-white">Synthesizing & Memory</p>
                          <p className="text-[11px] text-zinc-500 mt-0.5">RAG Vector & Exemplar</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* PHASE: ANALYSIS (Optimized Executive Layout — Only What's Important) */}
              {phase === "analysis" && analysisResult && (
                <div className="animate-fade-in-up space-y-5 pb-16 w-full max-w-5xl mx-auto">
                  
                  {/* ── Top Bar: Topic, Core Scorecard & Quick Action ── */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-black text-violet-400 uppercase tracking-widest bg-violet-500/10 border border-violet-500/20 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                          <Bot className="w-3 h-3" /> Council Verified
                        </span>
                        {analysisResult.starMethodUsed !== null && (
                          <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                            analysisResult.starMethodUsed 
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                              : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                          }`}>
                            {analysisResult.starMethodUsed ? "✓ STAR Structure" : "⚠ STAR Missing"}
                          </span>
                        )}
                        {analysisResult.habitTrends?.trend && (
                          <span className="text-[10px] font-bold text-zinc-400 bg-zinc-800/80 border border-zinc-700/50 px-2 py-0.5 rounded-full">
                            Trend: {analysisResult.habitTrends.trend.toUpperCase()}
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm sm:text-base font-bold text-white truncate max-w-xl">
                        {currentTopic?.topic}
                      </h3>
                    </div>

                    <button
                      onClick={handleReset}
                      className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white text-zinc-950 font-black text-xs uppercase tracking-wider hover:bg-zinc-200 transition-all cursor-pointer shadow-lg shrink-0"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>New Session</span>
                    </button>
                  </div>

                  {/* ── Compact Executive Metric Strip (4 Core Stats) ── */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="bg-zinc-900/40 border border-zinc-800/60 p-3 rounded-2xl text-center">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Clarity</span>
                      <div className="text-2xl font-black text-emerald-400">
                        {analysisResult.clarityScore}<span className="text-xs opacity-40 font-normal">/10</span>
                      </div>
                    </div>

                    <div className="bg-zinc-900/40 border border-zinc-800/60 p-3 rounded-2xl text-center">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Confidence</span>
                      <div className="text-2xl font-black text-violet-400">
                        {analysisResult.confidenceScore}<span className="text-xs opacity-40 font-normal">/10</span>
                      </div>
                    </div>

                    <div className="bg-zinc-900/40 border border-zinc-800/60 p-3 rounded-2xl text-center">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Structure</span>
                      <div className="text-2xl font-black text-amber-400">
                        {analysisResult.structureScore}<span className="text-xs opacity-40 font-normal">/10</span>
                      </div>
                    </div>

                    <div className="bg-zinc-900/40 border border-zinc-800/60 p-3 rounded-2xl text-center">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Pace & Fillers</span>
                      <div className="text-xl sm:text-2xl font-black text-cyan-400 truncate">
                        {analysisResult.deliveryMetrics?.wpm || "130"} <span className="text-xs font-normal text-zinc-400">WPM</span>
                        <span className="text-xs font-bold text-rose-400 ml-1.5">({analysisResult.fillerWordsCount} fillers)</span>
                      </div>
                    </div>
                  </div>

                  {/* ── 1. Executive Coaching Insight & Strengths / Growth ── */}
                  <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-3xl p-5 sm:p-6 space-y-4">
                    <div className="space-y-2.5">
                      <h4 className="text-xs font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-violet-400" /> Executive Coaching Insight
                      </h4>
                      <p className="text-zinc-200 leading-relaxed text-sm sm:text-[14.5px] font-medium bg-zinc-950/40 p-4 rounded-2xl border border-zinc-800/40">
                        "{analysisResult.overallFeedback}"
                      </p>
                    </div>

                    {/* Strengths & Growth Areas in Clean 2-Col Grid */}
                    <div className="grid sm:grid-cols-2 gap-3 pt-2 border-t border-zinc-800/40">
                      {analysisResult.strengths && analysisResult.strengths.length > 0 && (
                        <div className="space-y-2 bg-zinc-950/30 p-3.5 rounded-2xl border border-emerald-500/10">
                          <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                            <CheckCircle2 className="w-3 h-3" /> Key Strengths
                          </span>
                          <ul className="space-y-1.5">
                            {analysisResult.strengths.slice(0, 3).map((s, i) => (
                              <li key={i} className="text-xs text-zinc-300 flex items-start gap-2 leading-snug">
                                <span className="text-emerald-400 font-bold">•</span>
                                <span>{s}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {analysisResult.weaknesses && analysisResult.weaknesses.length > 0 && (
                        <div className="space-y-2 bg-zinc-950/30 p-3.5 rounded-2xl border border-amber-500/10">
                          <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                            <ShieldAlert className="w-3 h-3" /> Growth Areas
                          </span>
                          <ul className="space-y-1.5">
                            {analysisResult.weaknesses.slice(0, 3).map((w, i) => (
                              <li key={i} className="text-xs text-zinc-300 flex items-start gap-2 leading-snug">
                                <span className="text-amber-400 font-bold">•</span>
                                <span>{w}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── 2. Model Exemplar Answer (What an Executive Would Say) ── */}
                  <div className="bg-gradient-to-br from-violet-600/10 via-zinc-900/40 to-transparent border border-violet-500/20 rounded-3xl p-5 sm:p-6 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-black text-violet-400 uppercase tracking-widest block">
                          Model Exemplar Answer
                        </span>
                        <h4 className="text-sm font-bold text-white">
                          How an articulate speaker would frame this:
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
                    <p className="text-zinc-200 text-xs sm:text-sm leading-relaxed italic opacity-95 bg-zinc-950/60 p-4 rounded-2xl border border-violet-500/10">
                      "{analysisResult.idealAnswer}"
                    </p>
                  </div>

                  {/* ── 3. Vocabulary & Articulation Polish (When available) ── */}
                  {analysisResult.vocabularyUpgrades && analysisResult.vocabularyUpgrades.length > 0 && (
                    <div className="bg-zinc-900/40 border border-emerald-500/20 rounded-3xl p-5 sm:p-6 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                            <Sparkles className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest block">
                              Articulation Polish
                            </span>
                            <h4 className="text-sm font-bold text-white">
                              High-Impact Phrasing Upgrades
                            </h4>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold text-zinc-400 bg-zinc-800/80 border border-zinc-700/50 px-2.5 py-0.5 rounded-lg">
                          {analysisResult.vocabularyUpgrades.length} Upgrades
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                        {analysisResult.vocabularyUpgrades.map((item, idx) => (
                          <div 
                            key={idx}
                            className="p-3 rounded-2xl bg-zinc-950/60 border border-zinc-800/80 hover:border-emerald-500/30 transition-all space-y-1"
                          >
                            <div className="flex flex-wrap items-center gap-1.5 text-xs">
                              <span className="line-through text-zinc-500 text-[11px] px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800">
                                "{item.original}"
                              </span>
                              <span className="text-zinc-600 font-bold text-xs">→</span>
                              <span className="text-emerald-400 font-bold text-xs px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30">
                                "{item.better}"
                              </span>
                            </div>
                            <p className="text-[11px] text-zinc-400 leading-snug">
                              {item.reason}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── 4. Compact Speech Mechanics & Habit Strip (Telemetry) ── */}
                  <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-zinc-400">
                    <div className="flex flex-wrap items-center gap-4">
                      {analysisResult.deliveryMetrics && (
                        <div className="flex items-center gap-2">
                          <Gauge className="w-4 h-4 text-cyan-400 shrink-0" />
                          <span>
                            <strong className="text-zinc-200">{analysisResult.deliveryMetrics.wpm} WPM</strong>
                            {analysisResult.deliveryMetrics.awkwardPausesCount > 0 
                              ? ` • ${analysisResult.deliveryMetrics.awkwardPausesCount} awkward pauses` 
                              : ` • Zero freezes`}
                          </span>
                        </div>
                      )}

                      {analysisResult.visualMetrics?.enabled && (
                        <div className="flex items-center gap-2">
                          <Eye className="w-4 h-4 text-indigo-400 shrink-0" />
                          <span>
                            <strong className="text-zinc-200">{analysisResult.visualMetrics.eyeContactPercent}% Eye Contact</strong>
                            {` • ${analysisResult.visualMetrics.posture}`}
                          </span>
                        </div>
                      )}
                    </div>

                    {analysisResult.habitTrends?.comparisonSummary && (
                      <span className="text-[11px] text-zinc-500 italic max-w-sm truncate" title={analysisResult.habitTrends.comparisonSummary}>
                        RAG: "{analysisResult.habitTrends.comparisonSummary}"
                      </span>
                    )}
                  </div>

                  {/* ── Bottom Action Button ── */}
                  <div className="flex items-center justify-center pt-2">
                    <button
                      onClick={handleReset}
                      className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-white text-zinc-950 hover:bg-zinc-200 font-black text-xs uppercase tracking-widest transition-all cursor-pointer shadow-xl flex items-center justify-center gap-2"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Start Another Session</span>
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
    'bg-blue-500': 'border-blue-500/50 ring-2 ring-blue-500/50 shadow-lg shadow-blue-500/20 bg-blue-500/5',
    'bg-amber-500': 'border-amber-500/50 ring-2 ring-amber-500/50 shadow-lg shadow-amber-500/20 bg-amber-500/5',
    'bg-violet-500': 'border-violet-500/50 ring-2 ring-violet-500/50 shadow-lg shadow-violet-500/20 bg-violet-500/5',
    'bg-pink-500': 'border-pink-500/50 ring-2 ring-pink-500/50 shadow-lg shadow-pink-500/20 bg-pink-500/5',
    'bg-rose-500': 'border-rose-500/50 ring-2 ring-rose-500/50 shadow-lg shadow-rose-500/20 bg-rose-500/5',
    'bg-orange-500': 'border-orange-500/50 ring-2 ring-orange-500/50 shadow-lg shadow-orange-500/20 bg-orange-500/5',
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
