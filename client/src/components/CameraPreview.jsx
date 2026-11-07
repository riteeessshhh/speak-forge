/**
 * components/CameraPreview.jsx — Live Webcam & Presence HUD
 * 
 * Displays in-browser camera feed with live eye contact and face detection HUD.
 */

import { Video, VideoOff, Eye, UserCheck, Loader2 } from 'lucide-react';

export default function CameraPreview({
  videoRef,
  isCameraActive,
  isModelLoading,
  faceDetected,
  liveEyeContact,
  toggleCamera,
}) {
  return (
    <div className="space-y-3">
      {/* Top Bar / Toggle */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
          <Video className="w-3.5 h-3.5 text-cyan-400" />
          Visual Presence HUD
        </span>
        <button
          type="button"
          onClick={toggleCamera}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            isCameraActive
              ? "bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20"
              : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
          }`}
        >
          {isCameraActive ? (
            <>
              <Video className="w-3.5 h-3.5 text-cyan-400" />
              <span>Camera: ON</span>
            </>
          ) : (
            <>
              <VideoOff className="w-3.5 h-3.5 text-zinc-500" />
              <span>Camera: OFF</span>
            </>
          )}
        </button>
      </div>

      {/* Video Container (when camera active) */}
      {isCameraActive ? (
        <div className="relative w-full aspect-video bg-zinc-950 rounded-2xl border border-zinc-800 overflow-hidden shadow-xl">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover transform -scale-x-100"
          />

          {/* Overlay Grid lines (Target guide) */}
          <div className="absolute inset-0 pointer-events-none border border-cyan-500/10 rounded-2xl flex items-center justify-center">
            <div className="w-36 h-48 border border-dashed border-cyan-400/20 rounded-full" />
          </div>

          {/* Live HUD Badges */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
            {/* Face Presence Badge */}
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg backdrop-blur-md text-[10px] font-bold border transition-all ${
              faceDetected
                ? "bg-emerald-950/70 border-emerald-500/40 text-emerald-300"
                : "bg-zinc-900/80 border-zinc-700/60 text-zinc-400"
            }`}>
              <UserCheck className="w-3 h-3" />
              <span>{faceDetected ? "Face Tracked" : "No Face Detected"}</span>
            </div>

            {/* Eye Contact Badge */}
            {faceDetected && (
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg backdrop-blur-md text-[10px] font-bold border transition-all ${
                liveEyeContact
                  ? "bg-cyan-950/70 border-cyan-500/40 text-cyan-300"
                  : "bg-amber-950/70 border-amber-500/40 text-amber-300"
              }`}>
                <Eye className="w-3 h-3" />
                <span>{liveEyeContact ? "Eye Contact: Good" : "Looking Away"}</span>
              </div>
            )}
          </div>

          {/* Model Loading State */}
          {isModelLoading && (
            <div className="absolute bottom-3 left-3 right-3 bg-zinc-950/80 backdrop-blur-md border border-zinc-800 rounded-xl px-3 py-1.5 flex items-center gap-2 text-[11px] text-zinc-400 pointer-events-none">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
              <span>Initializing MediaPipe Computer Vision...</span>
            </div>
          )}
        </div>
      ) : (
        /* Inactive Placeholder */
        <div 
          onClick={toggleCamera}
          className="w-full py-6 px-4 bg-zinc-900/20 border border-dashed border-zinc-800/80 rounded-2xl text-center cursor-pointer hover:border-zinc-700 hover:bg-zinc-900/40 transition-all group"
        >
          <div className="w-9 h-9 mx-auto rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 group-hover:text-cyan-400 group-hover:border-cyan-500/30 transition-all mb-2">
            <Video className="w-4 h-4" />
          </div>
          <p className="text-xs font-semibold text-zinc-300">Enable Camera for Body Language & Eye Contact</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">Runs 100% in your browser. Video is never uploaded or saved.</p>
        </div>
      )}
    </div>
  );
}

