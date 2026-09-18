import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation, useNavigationType } from 'react-router-dom';

const SESSION_MAX_IDX_KEY = 'medex_portal_history_max_idx';

/**
 * Custom hook providing reliable in-app Back and Forward navigation controls
 * synchronized with browser history and React Router v6.
 */
export const usePortalNavigationHistory = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const navType = useNavigationType();

  // Helper to read current React Router history index
  const getCurrentIndex = useCallback(() => {
    if (typeof window === 'undefined') return 0;
    const idx = window.history?.state?.idx;
    return typeof idx === 'number' ? idx : 0;
  }, []);

  // Helper to check if the current page load is a reload
  const getIsPageReload = () => {
    if (typeof window === 'undefined') return false;
    try {
      const navEntries = window.performance?.getEntriesByType?.('navigation');
      if (navEntries && navEntries.length > 0) {
        return navEntries[0].type === 'reload';
      }
      return window.performance?.navigation?.type === 1;
    } catch {
      return false;
    }
  };

  // Initialize history index and max reachable index
  const [historyIdx, setHistoryIdx] = useState(() => getCurrentIndex());
  const [maxIdx, setMaxIdx] = useState(() => {
    if (typeof window === 'undefined') return 0;
    const current = getCurrentIndex();
    const isReload = getIsPageReload();

    if (isReload) {
      const stored = sessionStorage.getItem(SESSION_MAX_IDX_KEY);
      if (stored !== null) {
        const parsed = parseInt(stored, 10);
        if (!isNaN(parsed) && parsed >= current) {
          return parsed;
        }
      }
    } else if (current === 0) {
      // Fresh navigation to initial entry - reset stored max index
      try {
        sessionStorage.removeItem(SESSION_MAX_IDX_KEY);
      } catch {}
      return 0;
    }

    return current;
  });

  const prevLocationKeyRef = useRef(location.key);

  // Synchronize on route changes and navigation actions
  useEffect(() => {
    const current = getCurrentIndex();
    setHistoryIdx(current);

    if (navType === 'PUSH') {
      // PUSH truncates forward browser history; current becomes new ceiling
      setMaxIdx(current);
      try {
        sessionStorage.setItem(SESSION_MAX_IDX_KEY, String(current));
      } catch {}
    } else if (navType === 'POP') {
      // User navigated back or forward (via in-app button or browser button)
      setMaxIdx((prevMax) => {
        const newMax = Math.max(prevMax, current);
        try {
          sessionStorage.setItem(SESSION_MAX_IDX_KEY, String(newMax));
        } catch {}
        return newMax;
      });
    } else if (navType === 'REPLACE') {
      // REPLACE keeps index the same
      setMaxIdx((prevMax) => {
        const newMax = Math.max(prevMax, current);
        try {
          sessionStorage.setItem(SESSION_MAX_IDX_KEY, String(newMax));
        } catch {}
        return newMax;
      });
    }

    prevLocationKeyRef.current = location.key;
  }, [location, navType, getCurrentIndex]);

  // Synchronize with native popstate events (e.g. browser Back / Forward buttons)
  useEffect(() => {
    const handlePopState = () => {
      const current = getCurrentIndex();
      setHistoryIdx(current);
      setMaxIdx((prevMax) => {
        const newMax = Math.max(prevMax, current);
        try {
          sessionStorage.setItem(SESSION_MAX_IDX_KEY, String(newMax));
        } catch {}
        return newMax;
      });
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [getCurrentIndex]);

  const canGoBack = historyIdx > 0;
  const canGoForward = historyIdx < maxIdx;

  const goBack = useCallback(() => {
    if (canGoBack) {
      navigate(-1);
    }
  }, [canGoBack, navigate]);

  const goForward = useCallback(() => {
    if (canGoForward) {
      navigate(1);
    }
  }, [canGoForward, navigate]);

  return {
    historyIdx,
    maxIdx,
    canGoBack,
    canGoForward,
    goBack,
    goForward,
  };
};

export default usePortalNavigationHistory;
