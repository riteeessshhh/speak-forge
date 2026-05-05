/**
 * Dashboard.jsx — Analytics Progress View
 * 
 * DESIGN: Zinc/Slate palette, Skeletons for loading, Responsive Grid.
 */

import { useState, useEffect } from "react";
import { BarChart3, TrendingUp, TrendingDown, Minus, ArrowLeft, Loader2, Sparkles, Mic, History } from "lucide-react";
import Skeleton, { SkeletonText, SkeletonCircle } from "./Skeleton";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts";

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

  const sessions = data?.sessions || [];
  const totalSessions = parseInt(data?.summary?.total_sessions || 0);

  // ─── 1. MOMENTUM ENGINE (Recency-Weighted Metrics) ───
  const calculateRecentMetrics = (sessionList, windowSize = 10) => {
    const getAvg = (list, key) => {
      const validScores = list
        .map(s => parseFloat(s[key]))
        .filter(val => !isNaN(val) && val > 0);
      if (validScores.length === 0) return 0;
      return validScores.reduce((a, b) => a + b, 0) / validScores.length;
    };

    const last10 = sessionList.slice(0, windowSize);
    const prev10 = sessionList.slice(windowSize, windowSize * 2);

    const metrics = ["confidence_score", "clarity_score", "structure_score", "filler_word_count"];
    const results = {};

    metrics.forEach(m => {
      const currentAvg = getAvg(last10, m);
      const previousAvg = getAvg(prev10, m);
      const delta = currentAvg - previousAvg;
      
      // LOGIC FLIP: For fillers, a negative delta (fewer fillers) is an improvement (up)
      let status = "stable";
      if (m === "filler_word_count") {
        status = delta < -0.1 ? "up" : delta > 0.1 ? "down" : "stable";
      } else {
        status = delta > 0.1 ? "up" : delta < -0.1 ? "down" : "stable";
      }

      results[m] = {
        value: currentAvg.toFixed(1),
        delta: delta.toFixed(1),
        status: status
      };
    });

    return results;
  };

  const recentMetrics = calculateRecentMetrics(sessions);
  
  // ─── 2. INTELLIGENCE ENGINE (Focus Area & Dates) ───
  const last10 = sessions.slice(0, 10);
  
  // Find Dominant Track
  const trackCounts = last10.reduce((acc, s) => {
    acc[s.track_name] = (acc[acc.track_name] || 0) + 1;
    return acc;
  }, {});
  const focusArea = Object.entries(trackCounts).sort((a,b) => b[1] - a[1])[0]?.[0] || "—";

  // Prep chart data with smart date labels
  const dateCounts = {};
  const chartData = [...last10].reverse().map((s) => {
    const dateStr = s.created_at ? new Date(s.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—';
    dateCounts[dateStr] = (dateCounts[dateStr] || 0) + 1;
    const label = dateCounts[dateStr] > 1 ? `${dateStr} (${dateCounts[dateStr]})` : dateStr;
    
    return {
      name: label,
      Clarity: s.clarity_score && s.clarity_score > 0 ? parseFloat(s.clarity_score) : null,
      Confidence: s.confidence_score && s.confidence_score > 0 ? parseFloat(s.confidence_score) : null,
      topic: s.topic_text,
      date: dateStr
    };
  });

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-zinc-950/90 backdrop-blur-xl border border-zinc-800 p-3 rounded-xl shadow-2xl space-y-1.5 animate-in fade-in zoom-in duration-200">
          <div className="flex items-center justify-between gap-4 border-b border-zinc-800 pb-1.5 mb-1.5">
            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{data.date}</span>
            <span className="text-[10px] font-black text-violet-400 uppercase tracking-widest">Session {data.name}</span>
          </div>
          <p className="text-[11px] text-zinc-300 font-medium italic max-w-[180px] line-clamp-1">"{data.topic}"</p>
          <div className="flex gap-3 pt-1">
            {payload.map((entry, index) => (
              <div key={index} className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-xs font-bold text-white tabular-nums">{entry.value}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  const summaryCards = [
    { 
      label: "Lifetime Sessions", 
      value: totalSessions, 
      subtitle: "Total practice volume",
      color: "text-violet-400", 
      icon: Mic 
    },
    { 
      label: "Confidence", 
      value: recentMetrics.confidence_score.value, 
      suffix: "/10", 
      color: "text-emerald-400", 
      icon: TrendingUp,
      trend: recentMetrics.confidence_score
    },
    { 
      label: "Clarity", 
      value: recentMetrics.clarity_score.value, 
      suffix: "/10", 
      color: "text-sky-400", 
      icon: Sparkles,
      trend: recentMetrics.clarity_score
    },
    { 
      label: "Structure", 
      value: recentMetrics.structure_score.value, 
      suffix: "/10", 
      color: "text-amber-400", 
      icon: BarChart3,
      trend: recentMetrics.structure_score
    },
    { 
      label: "Focus Area", 
      value: focusArea, 
      subtitle: "Most active track",
      color: "text-rose-400", 
      icon: History,
    },
  ];

  const getScoreColor = (score) => {
    if (!score || score === "—") return "text-zinc-500";
    const val = parseFloat(score);
    if (val < 3.0) return "text-rose-500 font-black";
    return "";
  };

  const formatScore = (score) => {
    if (score === null || score === undefined || score === 0) return "SKIPPED";
    return score;
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 animate-fade-in-up pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">
            Performance Analytics
          </h2>
          <p className="text-sm text-zinc-400 mt-1">Insights and trends calculated from your 10 most recent analyzed sessions.</p>
        </div>
        <button
          onClick={onBack}
          className="group flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 text-sm font-medium hover:text-white hover:border-zinc-700 transition-all cursor-pointer active:scale-95"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Arena
        </button>
      </div>

      {totalSessions > 0 ? (
        <div className="space-y-10">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
            {summaryCards.map((card) => (
              <div
                key={card.label}
                className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-4 sm:p-5 flex flex-col items-center justify-center text-center hover:border-zinc-700 transition-standard group relative"
              >
                <div className={`p-2 rounded-xl bg-zinc-800/50 mb-3 group-hover:scale-110 transition-transform ${card.color}`}>
                  <card.icon className="w-4 h-4" />
                </div>
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">{card.label}</span>
                <div className="flex flex-col items-center">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xl font-black tabular-nums ${card.color}`}>
                      {card.value === "0.0" ? "—" : card.value}
                      {card.suffix && card.value !== "0.0" && <span className="text-xs text-zinc-600 font-bold tabular-nums">{card.suffix}</span>}
                    </span>
                    {card.trend && card.value !== "0.0" && (
                      <span 
                        title="Compared to your previous 10-session average"
                        className={`text-[10px] font-bold cursor-help ${card.trend.status === 'up' ? 'text-emerald-500' : card.trend.status === 'down' ? 'text-rose-500' : 'text-zinc-600'}`}
                      >
                        {card.trend.status === 'up' ? '▲' : card.trend.status === 'down' ? '▼' : '•'}
                      </span>
                    )}
                  </div>
                  {card.subtitle && (
                    <span className="text-[9px] text-zinc-600 font-medium uppercase tracking-tighter mt-0.5">{card.subtitle}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Trajectory Chart */}
          <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-3xl p-6 sm:p-8 space-y-6 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-widest">Growth Trajectory</h3>
                <p className="text-xs text-zinc-500">Visualizing Clarity and Confidence across your latest sessions</p>
              </div>
              <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider">
                <div className="flex items-center gap-1.5 text-sky-400">
                  <div className="w-2 h-2 rounded-full bg-sky-400" /> Clarity
                </div>
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" /> Confidence
                </div>
              </div>
            </div>
            
            <div className="h-64 w-full mt-4 relative">
              {sessions.length < 2 && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-zinc-950/20 backdrop-blur-[2px] rounded-2xl border border-dashed border-zinc-800">
                  <BarChart3 className="w-8 h-8 text-zinc-700 mb-3" />
                  <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest text-center px-4">Complete more sessions to see your growth trajectory</p>
                </div>
              )}
              
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorClarity" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorConfidence" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    stroke="#52525b" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false}
                    dy={10}
                    interval={0}
                  />
                  <YAxis 
                    stroke="#52525b" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false}
                    domain={[0, 10]}
                    dx={-10}
                  />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="Clarity" stroke="#38bdf8" strokeWidth={2.5} fillOpacity={1} fill="url(#colorClarity)" animationDuration={1500} connectNulls={true} />
                  <Area type="monotone" dataKey="Confidence" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorConfidence)" animationDuration={1500} connectNulls={true} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Sessions List */}
          <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-3xl overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-800/50 flex items-center gap-3">
              <History className="w-4 h-4 text-zinc-500" />
              <span className="text-sm font-bold text-zinc-300 uppercase tracking-widest">Recent Activity</span>
              <div className="ml-auto flex items-center gap-2 text-xs text-zinc-500">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                Latest {Math.min(sessions.length, 10)} Sessions
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
                          <span className={`font-bold text-xs ${getScoreColor(s.clarity_score)} ${!s.clarity_score ? 'text-zinc-600 italic' : 'text-sky-400'}`}>
                            {formatScore(s.clarity_score)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900/50 border border-zinc-800/50 group-hover:border-amber-500/30 transition-colors">
                          <span className={`font-bold text-xs ${getScoreColor(s.structure_score)} ${!s.structure_score ? 'text-zinc-600 italic' : 'text-amber-400'}`}>
                            {formatScore(s.structure_score)}
                          </span>
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
