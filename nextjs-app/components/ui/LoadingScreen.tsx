'use client';

import React, { useEffect, useRef } from 'react';

/**
 * Loading Screen Component
 *
 * This component fades out the static HTML loading screen.
 * The actual loader HTML is injected in layout.tsx for immediate display.
 *
 * BUGFIX: Use ref to ensure removal only happens once and doesn't interfere
 * with React's DOM updates during navigation.
 */

export function LoadingScreen() {
  const hasRemovedLoader = useRef(false);

  useEffect(() => {
    // Only run once on initial mount
    if (hasRemovedLoader.current) return;

    // Wait for React to fully hydrate before touching the DOM
    const timer = setTimeout(() => {
      const loader = document.getElementById('static-loader');
      if (loader && !hasRemovedLoader.current) {
        hasRemovedLoader.current = true;
        loader.classList.add('fade-out');

        // Use a longer delay to ensure React has finished hydration
        setTimeout(() => {
          // Double-check the loader still exists before removing
          const loaderCheck = document.getElementById('static-loader');
          if (loaderCheck && loaderCheck.parentNode) {
            loaderCheck.remove();
          }
        }, 800);
      }
    }, 1500); // Increased from 1000ms to 1500ms for safer hydration

    return () => clearTimeout(timer);
  }, []); // Empty deps - only run on mount

  // This component doesn't render anything - it just controls the static loader
  return null;
}
