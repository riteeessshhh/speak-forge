/**
 * AuthView.jsx — Login / Signup UI
 * 
 * DESIGN: Zinc/Slate palette, Glow effects, Hover scaling.
 */

import { useState } from "react";
import { useAuth } from "../contexts/UserContext";
import { Mic, Sparkles, ArrowRight, Loader2, Rocket, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function AuthView() {
  const { login, signup } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await signup(email, password);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col selection:bg-violet-500/30">
      {/* Top accent bar */}
      <div className="fixed top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-violet-600 via-emerald-500 to-sky-500 z-50" />

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md animate-fade-in-up">
          {/* Logo */}
          <div className="text-center mb-6 space-y-2">
            <div className="inline-flex items-center gap-3">
              <div className="w-12 h-12 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center glow-primary">
                <Mic className="w-6 h-6 text-violet-400" />
              </div>
              <span className="text-3xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-zinc-400">
                SpeakForge
              </span>
            </div>
            <p className="text-zinc-500 text-sm font-medium tracking-wide">
              Precision coaching for high-stakes interviews
            </p>
          </div>

          {/* Auth Card */}
          <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-3xl p-6 sm:p-10 shadow-2xl backdrop-blur-xl hover:border-zinc-700/50 transition-standard">
            {/* Toggle */}
            <div className="flex items-center bg-zinc-950/80 rounded-2xl p-1.5 mb-8 border border-zinc-800/50">
              <button
                type="button"
                onClick={() => { 
                  setIsLogin(true); 
                  setError(null); 
                  setEmail(""); 
                  setPassword(""); 
                  setShowPassword(false);
                }}
                className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-widest rounded-xl transition-standard cursor-pointer ${
                  isLogin
                    ? "bg-zinc-800 text-white shadow-lg shadow-black/20"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                Log In
              </button>
              <button
                type="button"
                onClick={() => { 
                  setIsLogin(false); 
                  setError(null); 
                  setEmail(""); 
                  setPassword(""); 
                  setShowPassword(false);
                }}
                className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-widest rounded-xl transition-standard cursor-pointer ${
                  !isLogin
                    ? "bg-zinc-800 text-white shadow-lg shadow-black/20"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                Sign Up
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="auth-email" className="block text-[10px] text-zinc-500 uppercase tracking-widest font-black ml-1">
                  Email Address
                </label>
                <input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="w-full bg-zinc-950/50 border border-zinc-800/80 rounded-2xl px-5 py-3.5 text-sm text-white placeholder-zinc-700 outline-none focus:bg-zinc-900/80 focus:border-violet-500/50 focus:ring-4 focus:ring-violet-500/5 transition-all duration-300"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="auth-password" className="block text-[10px] text-zinc-500 uppercase tracking-widest font-black ml-1">
                  Secure Password
                </label>
                <div className="relative group">
                  <input
                    id="auth-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete={isLogin ? "current-password" : "new-password"}
                    placeholder={isLogin ? "••••••••" : "Min. 6 characters"}
                    minLength={6}
                    className="w-full bg-zinc-950/50 border border-zinc-800/80 rounded-2xl px-5 py-3.5 pr-12 text-sm text-white placeholder-zinc-700 outline-none focus:bg-zinc-900/80 focus:border-violet-500/50 focus:ring-4 focus:ring-violet-500/5 transition-all duration-300"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors p-1"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl px-4 py-3 text-xs text-rose-400 font-medium animate-fade-in-up">
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full group flex items-center justify-center gap-3 px-6 py-4 rounded-2xl font-bold text-sm tracking-wide transition-all duration-300 cursor-pointer ${
                  isSubmitting
                    ? "bg-zinc-800 text-zinc-600 cursor-not-allowed"
                    : isLogin
                      ? "bg-zinc-100 text-zinc-950 hover:bg-white hover:scale-102 hover:shadow-2xl hover:shadow-sky-500/20 active:scale-98 shadow-xl shadow-sky-500/10"
                      : "bg-zinc-100 text-zinc-950 hover:bg-white hover:scale-102 hover:shadow-2xl hover:shadow-violet-500/20 active:scale-98 shadow-xl shadow-violet-500/10"
                }`}
              >
                <AnimatePresence mode="wait">
                  {isSubmitting ? (
                    <motion.div
                      key="submitting"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="flex items-center gap-3"
                    >
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>{isLogin ? "Authenticating..." : "Forging Identity..."}</span>
                    </motion.div>
                  ) : (
                    <motion.div
                      key={isLogin ? "login" : "signup"}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="flex items-center gap-3"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>{isLogin ? "Sign In to Forge" : "Forge New Account"}</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>
            </form>
          </div>

          {/* Social Proof / Footer */}
          <div className="mt-12 flex justify-center">
            <div className="w-4/5 grid grid-cols-2 gap-4">
              <div className="bg-zinc-900/30 border border-zinc-800/40 p-3 rounded-2xl flex items-center justify-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-tight">Free Coaching</span>
              </div>
              <div className="bg-zinc-900/30 border border-zinc-800/40 p-3 rounded-2xl flex items-center justify-center gap-2">
                <Rocket className="w-3.5 h-3.5 text-sky-500" />
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-tight">Instant Feedback</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
