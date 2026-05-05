/**
 * Skeleton.jsx — Reusable loading state component.
 */

export default function Skeleton({ className = "" }) {
  return (
    <div 
      className={`relative overflow-hidden bg-zinc-900/50 rounded-2xl animate-pulse ${className}`}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent -translate-x-full animate-shimmer" />
    </div>
  );
}

export function SkeletonText({ className = "" }) {
  return (
    <div 
      className={`relative overflow-hidden h-4 bg-zinc-900/50 rounded animate-pulse ${className}`}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent -translate-x-full animate-shimmer" />
    </div>
  );
}

export function SkeletonCircle({ className = "" }) {
  return (
    <div 
      className={`relative overflow-hidden rounded-full bg-zinc-900/50 animate-pulse ${className}`}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent -translate-x-full animate-shimmer" />
    </div>
  );
}
