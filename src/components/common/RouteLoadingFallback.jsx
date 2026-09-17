import React from 'react';
import LoadingSpinner from './LoadingSpinner';

/**
 * Lightweight, accessible loading fallback for lazy-loaded routes and portal workspaces.
 * Maintains layout stability without adding extra runtime overhead.
 */
export const RouteLoadingFallback = ({ 
  text = 'Loading MedEx workspace...', 
  minHeight = 'min-h-[400px]',
  size = 'lg' 
}) => {
  return (
    <div 
      className={`w-full flex-1 flex items-center justify-center p-6 ${minHeight}`} 
      role="status" 
      aria-live="polite"
      aria-label={text}
    >
      <LoadingSpinner text={text} size={size} />
    </div>
  );
};

export default RouteLoadingFallback;
