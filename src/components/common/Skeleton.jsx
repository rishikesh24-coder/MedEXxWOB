import React from 'react';

/**
 * Lightweight Skeleton Loading Components
 * Designed with subtle shimmer animation and respecting prefers-reduced-motion.
 */
export const Skeleton = ({ className = '', ...props }) => {
  return (
    <div
      className={`animate-pulse rounded-xl bg-slate-200/80 motion-reduce:animate-none ${className}`}
      {...props}
    />
  );
};

export const MetricCardSkeleton = () => (
  <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-3">
    <div className="flex justify-between items-start">
      <Skeleton className="h-3 w-28" />
      <Skeleton className="h-8 w-8 rounded-lg" />
    </div>
    <Skeleton className="h-7 w-36" />
    <Skeleton className="h-8 w-full rounded-xl" />
  </div>
);

export const CardSkeleton = ({ count = 3 }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {Array.from({ length: count }).map((_, idx) => (
      <div key={idx} className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex justify-between items-start">
          <div className="space-y-1.5 flex-1">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
        </div>
        <div className="flex justify-between items-center pt-2">
          <Skeleton className="h-6 w-24 rounded-lg" />
          <Skeleton className="h-8 w-28 rounded-xl" />
        </div>
      </div>
    ))}
  </div>
);

export const TableSkeleton = ({ rows = 5, columns = 5 }) => (
  <div className="w-full bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden p-4 space-y-3">
    <div className="flex justify-between items-center pb-2 border-b border-slate-100">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-7 w-28 rounded-xl" />
    </div>
    <div className="space-y-3 pt-2">
      {Array.from({ length: rows }).map((_, rIdx) => (
        <div key={rIdx} className="flex items-center gap-4 py-2 border-b border-slate-50 last:border-0">
          {Array.from({ length: columns }).map((_, cIdx) => (
            <Skeleton key={cIdx} className={`h-4 ${cIdx === 0 ? 'w-1/4' : 'flex-1'}`} />
          ))}
        </div>
      ))}
    </div>
  </div>
);

export default Skeleton;
