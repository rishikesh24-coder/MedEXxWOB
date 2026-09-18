import React from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { usePortalNavigationHistory } from '../../hooks/usePortalNavigationHistory';

/**
 * Global In-App Back and Forward navigation controls for Hospital and Admin portals.
 * Synchronized with browser history and React Router v6.
 */
export const PortalHistoryNavigation = ({ className = '', portal = 'hospital' }) => {
  const { canGoBack, canGoForward, goBack, goForward } = usePortalNavigationHistory();

  return (
    <nav
      aria-label="History navigation"
      className={`inline-flex items-center gap-1 p-0.5 rounded-xl bg-slate-100/90 border border-slate-200/80 shadow-2xs backdrop-blur-xs select-none ${className}`}
    >
      {/* Back Button */}
      <button
        type="button"
        id={`${portal}-nav-back`}
        onClick={goBack}
        disabled={!canGoBack}
        aria-label="Go back to previous page"
        aria-disabled={!canGoBack}
        title={canGoBack ? 'Go back to previous page' : 'No previous page in history'}
        className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 ${
          canGoBack
            ? 'bg-white text-slate-700 border border-slate-200/90 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 shadow-xs active:scale-95 cursor-pointer'
            : 'bg-transparent text-slate-300 border border-transparent opacity-40 cursor-not-allowed pointer-events-none'
        }`}
      >
        <ArrowLeft className={`w-3.5 h-3.5 shrink-0 ${canGoBack ? 'text-slate-600' : 'text-slate-300'}`} />
        <span className="hidden sm:inline">Back</span>
      </button>

      {/* Forward Button */}
      <button
        type="button"
        id={`${portal}-nav-forward`}
        onClick={goForward}
        disabled={!canGoForward}
        aria-label="Go forward to next page"
        aria-disabled={!canGoForward}
        title={canGoForward ? 'Go forward to next page' : 'No forward page in history'}
        className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 ${
          canGoForward
            ? 'bg-white text-slate-700 border border-slate-200/90 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 shadow-xs active:scale-95 cursor-pointer'
            : 'bg-transparent text-slate-300 border border-transparent opacity-40 cursor-not-allowed pointer-events-none'
        }`}
      >
        <span className="hidden sm:inline">Forward</span>
        <ArrowRight className={`w-3.5 h-3.5 shrink-0 ${canGoForward ? 'text-slate-600' : 'text-slate-300'}`} />
      </button>
    </nav>
  );
};

export default PortalHistoryNavigation;
