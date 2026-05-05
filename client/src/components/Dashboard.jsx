/**
 * Dashboard.jsx — Analytics Progress View
 * 
 * DESIGN: Zinc/Slate palette, Skeletons for loading, Responsive Grid.
 */

import { useState, useEffect } from "react";
import { BarChart3, TrendingUp, TrendingDown, Minus, ArrowLeft, Loader2, Sparkles, Mic, History } from "lucide-react";
import Skeleton, { SkeletonText, SkeletonCircle } from "./Skeleton";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function Dashboard({ onBack }) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/analytics/summary`, {
          credentials: 'include',
        });
        if (!res.ok) throw new Error('Failed to fetch analytics');
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  if (isLoading) {
    return (
      <div className="w-full max-w-4xl mx-auto space-y-8 animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-24 rounded-xl" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
        <Skeleton className="h-96 w-full rounded-3xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="inline-flex p-3 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-500">
            <Mic className="w-6 h-6" />
          </div>
          <p className="text-sm text-zinc-400 max-w-xs mx-auto">{error}</p>
          <button onClick={onBack} className="text-sm text-zinc-500 hover:text-white transition-colors cursor-pointer flex items-center gap-2 mx-auto">
            <ArrowLeft className="w-4 h-4" /> Back to Arena
          </button>
        </div>
      </div>
    );
  }

  const summary = data?.summary;
  const sessions = data?.sessions || [];
  const totalSessions = parseInt(summary?.total_sessions || 0);

  const summaryCards = [
    { label: "Sessions", value: totalSessions, color: "text-violet-400", icon: Mic },
    { label: "Confidence", value: summary?.avg_confidence || "—", suffix: "/10", color: "text-emerald-400", icon: TrendingUp },
    { label: "Clarity", value: summary?.avg_clarity || "—", suffix: "/10", color: "text-sky-400", icon: Sparkles },
    { label: "Structure", value: summary?.avg_structure || "—", suffix: "/10", color: "text-amber-400", icon: BarChart3 },
    { label: "Fillers", value: summary?.avg_fillers || "—", color: "text-rose-400", icon: TrendingDown },
  ];

  const getTrendIcon = (current, avg) => {
    if (!current || !avg) return <Minus className="w-3 h-3 text-zinc-500" />;
    const c = parseFloat(current);
    const a = parseFloat(avg);
    if (c > a) return <TrendingUp className="w-3 h-3 text-emerald-400" />;
    if (c < a) return <TrendingDown className="w-3 h-3 text-rose-400" />;
    return <Minus className="w-3 h-3 text-zinc-500" />;
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 animate-fade-in-up pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">
            Performance Analytics
          </h2>
          <p className="text-sm text-zinc-400 mt-1">Insights and trends from your practice sessions</p>
        </div>
        <button
          onClick={onBack}
          className="group flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 text-sm font-medium hover:text-white hover:border-zinc-700 transition-standard cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Arena
        </button>
      </div>

      {totalSessions > 0 ? (
        <div className="space-y-8">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
            {summaryCards.map((card) => (
              <div
                key={card.label}
                className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-4 sm:p-5 flex flex-col items-center justify-center text-center hover:border-zinc-700 transition-standard group"
              >
                <div className={`p-2 rounded-xl bg-zinc-800/50 mb-3 group-hover:scale-110 transition-transform ${card.color}`}>
                  <card.icon className="w-4 h-4" />
                </div>
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">{card.label}</span>
                <span className={`text-xl font-black ${card.color}`}>
                  {card.value}
                  {card.suffix && <span className="text-xs text-zinc-600 font-bold">{card.suffix}</span>}
                </span>
              </div>
            ))}
          </div>

          {/* Sessions List */}
          <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-3xl overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-800/50 flex items-center gap-3">
              <History className="w-4 h-4 text-zinc-500" />
              <span className="text-sm font-bold text-zinc-300 uppercase tracking-widest">Recent Activity</span>
              <div className="ml-auto flex items-center gap-2 text-xs text-zinc-500">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Latest 10 Sessions
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-zinc-900/50 border-b border-zinc-800/50">
                    <th className="px-6 py-4 text-[10px] text-zinc-500 font-black uppercase tracking-widest">Session Topic</th>
                    <th className="px-4 py-4 text-center text-[10px] text-zinc-500 font-black uppercase tracking-widest">Track</th>
                    <th className="px-4 py-4 text-center text-[10px] text-zinc-500 font-black uppercase tracking-widest">Clarity</th>
                    <th className="px-4 py-4 text-center text-[10px] text-zinc-500 font-black uppercase tracking-widest">Structure</th>
                    <th className="px-4 py-4 text-center text-[10px] text-zinc-500 font-black uppercase tracking-widest">Fillers</th>
                    <th className="px-6 py-4 text-right text-[10px] text-zinc-500 font-black uppercase tracking-widest">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/30">
                  {sessions.map((s, i) => (
                    <tr key={s.session_id || i} className="group hover:bg-zinc-800/20 transition-colors">
                      <td className="px-6 py-4">
                        <div className="text-sm text-zinc-200 font-medium line-clamp-1 max-w-[240px] group-hover:text-white transition-colors" title={s.topic_text}>
                          {s.topic_text}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="inline-flex px-2 py-0.5 rounded-full bg-zinc-800 text-[10px] font-bold text-zinc-400 group-hover:bg-zinc-700 transition-colors">
                          {s.track_name}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900/50 border border-zinc-800/50 group-hover:border-sky-500/30 transition-colors">
                          <span className="text-sky-400 font-bold text-xs">{s.clarity_score ?? "—"}</span>
                          {getTrendIcon(s.clarity_score, summary?.avg_clarity)}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900/50 border border-zinc-800/50 group-hover:border-amber-500/30 transition-colors">
                          <span className="text-amber-400 font-bold text-xs">{s.structure_score ?? "—"}</span>
                          {getTrendIcon(s.structure_score, summary?.avg_structure)}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="text-rose-400 font-black text-xs tabular-nums">{s.filler_word_count ?? "—"}</span>
                      </td>
                      <td className="px-6 py-4 text-right text-xs text-zinc-500 tabular-nums">
                        {s.created_at ? new Date(s.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-3xl p-16 text-center animate-scale-in">
          <div className="w-16 h-16 rounded-3xl bg-zinc-800/50 flex items-center justify-center mx-auto mb-6 text-zinc-500 border border-zinc-700/30">
            <Mic className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">No session data found</h3>
          <p className="text-zinc-500 text-sm max-w-xs mx-auto mb-8">Your speaking analytics will appear here after your first practice session.</p>
          <button
            onClick={onBack}
            className="px-8 py-3 rounded-2xl bg-zinc-100 text-zinc-950 font-bold text-sm hover:bg-white hover:scale-105 active:scale-95 transition-all shadow-xl shadow-white/5 cursor-pointer"
          >
            Start Your First Practice
          </button>
        </div>
      )}
    </div>
  );
}
