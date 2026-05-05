/**
 * Skeleton.jsx — Reusable loading state component.
 */

export default function Skeleton({ className }) {
  return (
    <div className={`animate-shimmer rounded-lg bg-zinc-900 ${className}`} />
  );
}

export function SkeletonCircle({ size = "w-10 h-10" }) {
  return (
    <div className={`animate-shimmer rounded-full bg-zinc-900 ${size}`} />
  );
}

export function SkeletonText({ className = "w-full h-4" }) {
  return (
    <div className={`animate-shimmer rounded-md bg-zinc-900 ${className}`} />
  );
}
