'use client';

import React, { useEffect, useRef } from 'react';

/**
 * Loading Screen Component
 *
 * CRITICAL FIX: Create and manage loader entirely client-side to prevent
 * React hydration mismatch errors.
 *
 * The loader is created via JavaScript before React hydrates, then removed
 * after hydration completes. This prevents insertBefore/removeChild errors
 * during navigation because React never tries to manage this element.
 */

export function LoadingScreen() {
  const hasInitialized = useRef(false);

  useEffect(() => {
    // Only run once
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    // Create loader element if it doesn't exist
    let loader = document.getElementById('static-loader');
    if (!loader) {
      loader = document.createElement('div');
      loader.id = 'static-loader';
      loader.innerHTML = `
        <div class="loader-content">
          <div class="loader-icon">🔐</div>
          <h1 class="loader-title">Solana Lockbox</h1>
          <p class="loader-tagline">Blockchain Password Manager</p>
        </div>
      `;
      document.body.insertBefore(loader, document.body.firstChild);
    }

    // Wait for app to fully load, then fade out and remove
    setTimeout(() => {
      const loaderElement = document.getElementById('static-loader');
      if (loaderElement) {
        loaderElement.classList.add('fade-out');
        setTimeout(() => {
          const finalCheck = document.getElementById('static-loader');
          if (finalCheck && finalCheck.parentNode) {
            finalCheck.parentNode.removeChild(finalCheck);
          }
        }, 600);
      }
    }, 1000);
  }, []);

  return null;
}
