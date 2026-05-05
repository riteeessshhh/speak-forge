/**
 * App.jsx — Production-Ready SpeakForge
 */

import { useState, useCallback, useEffect } from "react";
import { 
  Building2, Cpu, Flame, Rocket, Shuffle, Sparkles, Mic, 
  ChevronRight, RotateCcw, Square, BarChart3, LogOut, 
  Loader2, Play, CheckCircle2, History 
} from "lucide-react";
import { Toaster, toast } from "react-hot-toast";
import { getRandomTopic, getTopicCount } from "./data/topics";
import CountdownTimer from "./components/CountdownTimer";
import { useAudioRecorder } from "./hooks/useAudioRecorder";
import { UserProvider, useAuth } from "./contexts/UserContext";
import AuthView from "./components/AuthView";
import Dashboard from "./components/Dashboard";
import AudioVisualizer from "./components/AudioVisualizer";
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

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
  const { status, isRecording, audioUrl, audioBlob, stream, startRecording, stopRecording, clearAudio } = useAudioRecorder();

  const canGenerate = selectedArena !== null && selectedDifficulty !== null;
  const selectedCard = arenaCards.find((c) => c.id === selectedArena);

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
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col selection:bg-violet-500/30">
      <div className="fixed top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-violet-600 via-emerald-500 to-sky-500 z-50" />

      {/* Header */}
      <header className="border-b border-zinc-800/50 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-[1200px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-center glow-primary">
              <Mic className="w-5 h-5 text-violet-400" />
            </div>
            <span className="text-xl font-black tracking-tighter">SpeakForge</span>
          </div>
          
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowDashboard(!showDashboard)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-standard cursor-pointer ${
                showDashboard
                  ? "bg-violet-500/10 text-violet-400 border border-violet-500/20"
                  : "text-zinc-400 hover:text-white border border-transparent"
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </button>
            <div className="h-4 w-px bg-zinc-800 hidden sm:block" />
            <button onClick={logout} className="p-2 text-zinc-500 hover:text-rose-400 transition-standard cursor-pointer">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col px-6 py-10 lg:py-16 overflow-y-auto">
        <div className="max-w-[1200px] w-full mx-auto flex-1 flex flex-col">
          {showDashboard ? (
            <Dashboard onBack={() => setShowDashboard(false)} />
          ) : (
            <>
              {/* PHASE: SELECTION */}
              {phase === "selection" && (
                <div className="animate-fade-in-up space-y-12">
                  <div className="text-center space-y-4 max-w-2xl mx-auto">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-[10px] font-black uppercase tracking-widest">
                      <Sparkles className="w-3 h-3" />
                      AI Coaching Engine
                    </div>
                    <h1 className="text-4xl sm:text-6xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-zinc-500 leading-[1.1]">
                      Master Impromptu <br /> Speaking
                    </h1>
                    <div className="flex flex-wrap justify-center gap-4 pt-4">
                      {[
                        { icon: Rocket, label: "Pick a Challenge", color: "text-emerald-400" },
                        { icon: Mic, label: "Speak for 60s", color: "text-violet-400" },
                        { icon: CheckCircle2, label: "Get AI Coaching", color: "text-sky-400" }
                      ].map((step, idx) => (
                        <div key={idx} className="flex items-center gap-3 bg-zinc-900/50 border border-zinc-800/50 px-4 py-2 rounded-2xl">
                          <step.icon className={`w-4 h-4 ${step.color}`} />
                          <span className="text-xs font-bold text-zinc-400 uppercase tracking-tight">{step.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col lg:flex-row gap-10">
                    <div className="lg:w-3/5 space-y-6">
                      <h2 className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2">
                        <Rocket className="w-4 h-4" /> 1. Select Arena
                      </h2>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {arenaCards.map((card) => (
                          <ArenaCard
                            key={card.id}
                            {...card}
                            topics={getTopicCount(card.trackName)}
                            isSelected={selectedArena === card.id}
                            onClick={() => handleArenaSelect(card.id)}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="lg:w-2/5 flex flex-col gap-10">
                      <div className="space-y-6">
                        <h2 className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2">
                          <Flame className="w-4 h-4" /> 2. Intensity
                        </h2>
                        <div className="grid grid-cols-3 gap-3">
                          {difficulties.map((diff) => (
                            <button
                              key={diff.key}
                              onClick={() => handleDifficultySelect(diff.key)}
                              className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-standard active-scale hover-glow-primary ${
                                selectedDifficulty === diff.key
                                  ? `${diff.color} border-current bg-zinc-800/40 shadow-lg`
                                  : `border-zinc-800 text-zinc-600 ${diff.bgHover} ${diff.borderHover}`
                              }`}
                            >
                              <span className="text-2xl mb-2">{diff.emoji}</span>
                              <span className="text-[10px] font-black uppercase tracking-widest">{diff.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <button
                        onClick={handleGenerate}
                        disabled={!canGenerate || isGeneratingTopic}
                        className={`w-full group flex items-center justify-center gap-3 py-5 rounded-3xl font-black text-sm uppercase tracking-widest transition-all duration-300 ${
                          canGenerate && !isGeneratingTopic
                            ? "bg-white text-zinc-950 hover:scale-102 hover:shadow-2xl hover:shadow-white/10 cursor-pointer active:scale-98"
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
                <div className="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto w-full animate-scale-in">
                  <div className="w-full space-y-10 text-center">
                    <div className="space-y-6">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[10px] font-black uppercase tracking-widest animate-pulse">
                        <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        Recording Live
                      </div>
                      <h2 className="text-2xl sm:text-4xl font-black text-white leading-tight">
                        {currentTopic?.topic}
                      </h2>
                    </div>

                    <AudioVisualizer stream={stream} isRecording={isRecording} />

                    <div className="flex flex-col items-center gap-8 pt-4">
                      <button
                        onClick={handleFinishSpeaking}
                        className="relative w-24 h-24 bg-rose-500 rounded-full flex items-center justify-center shadow-2xl shadow-rose-500/40 hover:scale-110 active:scale-90 transition-all cursor-pointer group"
                      >
                        <div className="absolute inset-0 bg-rose-500 rounded-full animate-ping opacity-20" />
                        <Square className="w-8 h-8 text-white fill-current" />
                      </button>
                      <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em]">Click to finish speaking</p>
                    </div>
                  </div>
                </div>
              )}

              {/* PHASE: REVIEW */}
              {phase === "review" && (
                <div className="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto w-full animate-fade-in-up space-y-12">
                  <div className="text-center space-y-4">
                    <h2 className="text-sm font-black text-zinc-500 uppercase tracking-[0.2em]">Review Your Session</h2>
                    <p className="text-xl font-bold text-zinc-200">"{currentTopic?.topic}"</p>
                  </div>

                  <div className="w-full bg-zinc-900/50 border border-zinc-800/50 p-8 rounded-3xl space-y-6">
                    <div className="flex items-center justify-center p-4">
                      {status === 'ready' && audioUrl ? (
                        <audio src={audioUrl} controls className="w-full max-w-md opacity-90 accent-violet-500" />
                      ) : (
                        <div className="flex flex-center flex-col items-center gap-4 text-zinc-500 py-8">
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
                    
                    <div className="flex gap-4 pt-4">
                      <button onClick={handleReset} className="flex-1 py-4 rounded-2xl bg-zinc-800 text-zinc-400 font-bold text-sm hover:text-white transition-standard cursor-pointer">
                        Discard
                      </button>
                      <button 
                        onClick={handleSubmitForAnalysis} 
                        disabled={isAnalyzing}
                        className="flex-[2] py-4 rounded-2xl bg-white text-zinc-950 font-black text-sm uppercase tracking-widest hover:scale-102 transition-all cursor-pointer flex items-center justify-center gap-2"
                      >
                        {isAnalyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Get AI Feedback <Sparkles className="w-4 h-4" /></>}
                      </button>
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
                          <div className="space-y-4">
                            <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Strengths</h4>
                            <ul className="space-y-2">
                              {analysisResult.strengths?.map((s, i) => (
                                <li key={i} className="text-xs text-zinc-400 flex items-start gap-2">
                                  <div className="w-1 h-1 rounded-full bg-emerald-500 mt-1.5 shrink-0" /> {s}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div className="space-y-4">
                            <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Growth Areas</h4>
                            <ul className="space-y-2">
                              {analysisResult.weaknesses?.map((w, i) => (
                                <li key={i} className="text-xs text-zinc-400 flex items-start gap-2">
                                  <div className="w-1 h-1 rounded-full bg-amber-500 mt-1.5 shrink-0" /> {w}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="lg:col-span-2 space-y-6">
                      <div className="bg-gradient-to-br from-violet-600/10 to-transparent border border-violet-500/20 rounded-3xl p-8 space-y-6 sticky top-32">
                        <div className="space-y-2">
                          <span className="text-[10px] font-black text-violet-400 uppercase tracking-widest">AI Refactor</span>
                          <h3 className="text-xl font-bold">10% Better Version</h3>
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

      <footer className="border-t border-zinc-800/50 py-4 text-center">
        <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">Engine v2.0 • Build 2026.05</p>
      </footer>
    </div>
  );
}

function ArenaCard({ icon: Icon, title, description, topics, color, isSelected, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`group relative text-left bg-zinc-900/40 border transition-standard cursor-pointer rounded-2xl p-5 ${
        isSelected
          ? "border-zinc-500 bg-zinc-800/40 ring-4 ring-zinc-500/5 glow-primary"
          : "border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-800/30"
      }`}
    >
      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 ${color} rounded-2xl flex items-center justify-center flex-shrink-0 shadow-xl group-hover:scale-110 transition-transform`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3 className="text-sm font-bold text-zinc-100 truncate">{title}</h3>
            <ChevronRight className={`w-4 h-4 flex-shrink-0 transition-all ${isSelected ? "text-zinc-400" : "text-zinc-600 group-hover:text-zinc-400 group-hover:translate-x-1"}`} />
          </div>
          <p className="text-zinc-500 text-[10px] leading-relaxed line-clamp-2 font-medium">{description}</p>
          <div className="mt-3">
            <div className="inline-flex px-2 py-0.5 rounded-lg bg-zinc-950 text-[10px] font-black text-zinc-600 uppercase tracking-tight border border-zinc-800/50">
              {topics} Questions
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}
