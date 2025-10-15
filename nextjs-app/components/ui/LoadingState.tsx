/**
 * Loading State Component
 *
 * Provides consistent loading indicators across the application
 * with different sizes and styles for various contexts.
 */

'use client';

import React from 'react';

export type LoadingSize = 'sm' | 'md' | 'lg';
export type LoadingVariant = 'spinner' | 'dots' | 'pulse' | 'skeleton';

interface LoadingStateProps {
  /** Size of the loading indicator */
  size?: LoadingSize;
  /** Visual variant */
  variant?: LoadingVariant;
  /** Optional loading message */
  message?: string;
  /** Center the loader */
  centered?: boolean;
  /** Full screen overlay */
  fullScreen?: boolean;
  /** Custom className */
  className?: string;
}

export function LoadingState({
  size = 'md',
  variant = 'spinner',
  message,
  centered = false,
  fullScreen = false,
  className = '',
}: LoadingStateProps) {
  const loader = (
    <div className={`loading-state ${size} ${centered ? 'centered' : ''} ${className}`}>
      {variant === 'spinner' && <SpinnerLoader size={size} />}
      {variant === 'dots' && <DotsLoader size={size} />}
      {variant === 'pulse' && <PulseLoader size={size} />}
      {variant === 'skeleton' && <SkeletonLoader />}
      {message && <p className="loading-message">{message}</p>}

      <style jsx>{`
        .loading-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
        }

        .loading-state.centered {
          justify-content: center;
          min-height: 200px;
        }

        .loading-message {
          color: #7f8c8d;
          font-size: 0.9rem;
          text-align: center;
          margin: 0;
        }

        .loading-state.sm .loading-message {
          font-size: 0.8rem;
        }

        .loading-state.lg .loading-message {
          font-size: 1rem;
        }
      `}</style>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="loading-fullscreen">
        {loader}
        <style jsx>{`
          .loading-fullscreen {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(4px);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 9999;
          }
        `}</style>
      </div>
    );
  }

  return loader;
}

/**
 * Spinner Loader
 */
function SpinnerLoader({ size }: { size: LoadingSize }) {
  const sizeMap = {
    sm: 24,
    md: 40,
    lg: 60,
  };

  const dimension = sizeMap[size];

  return (
    <>
      <div className="spinner" />
      <style jsx>{`
        .spinner {
          width: ${dimension}px;
          height: ${dimension}px;
          border: ${size === 'sm' ? 3 : 4}px solid rgba(102, 126, 234, 0.1);
          border-top-color: #667eea;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </>
  );
}

/**
 * Dots Loader
 */
function DotsLoader({ size }: { size: LoadingSize }) {
  const sizeMap = {
    sm: 8,
    md: 12,
    lg: 16,
  };

  const dotSize = sizeMap[size];

  return (
    <>
      <div className="dots-loader">
        <div className="dot" />
        <div className="dot" />
        <div className="dot" />
      </div>
      <style jsx>{`
        .dots-loader {
          display: flex;
          gap: ${dotSize / 2}px;
        }

        .dot {
          width: ${dotSize}px;
          height: ${dotSize}px;
          border-radius: 50%;
          background: #667eea;
          animation: dots-bounce 1.4s infinite ease-in-out both;
        }

        .dot:nth-child(1) {
          animation-delay: -0.32s;
        }

        .dot:nth-child(2) {
          animation-delay: -0.16s;
        }

        @keyframes dots-bounce {
          0%,
          80%,
          100% {
            transform: scale(0);
            opacity: 0.5;
          }
          40% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </>
  );
}

/**
 * Pulse Loader
 */
function PulseLoader({ size }: { size: LoadingSize }) {
  const sizeMap = {
    sm: 40,
    md: 60,
    lg: 80,
  };

  const dimension = sizeMap[size];

  return (
    <>
      <div className="pulse-loader">
        <div className="pulse-ring" />
        <div className="pulse-ring" />
        <div className="pulse-core" />
      </div>
      <style jsx>{`
        .pulse-loader {
          position: relative;
          width: ${dimension}px;
          height: ${dimension}px;
        }

        .pulse-ring {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          border: 3px solid #667eea;
          border-radius: 50%;
          opacity: 0;
          animation: pulse-ring 2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
        }

        .pulse-ring:nth-child(2) {
          animation-delay: 1s;
        }

        .pulse-core {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 40%;
          height: 40%;
          background: #667eea;
          border-radius: 50%;
          animation: pulse-core 2s ease-in-out infinite;
        }

        @keyframes pulse-ring {
          0% {
            transform: scale(0.33);
            opacity: 1;
          }
          80%,
          100% {
            transform: scale(1);
            opacity: 0;
          }
        }

        @keyframes pulse-core {
          0%,
          100% {
            opacity: 0.8;
            transform: translate(-50%, -50%) scale(1);
          }
          50% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1.2);
          }
        }
      `}</style>
    </>
  );
}

/**
 * Skeleton Loader (for content placeholders)
 */
function SkeletonLoader() {
  return (
    <>
      <div className="skeleton-loader">
        <div className="skeleton-line" />
        <div className="skeleton-line short" />
        <div className="skeleton-line" />
      </div>
      <style jsx>{`
        .skeleton-loader {
          width: 100%;
          max-width: 400px;
        }

        .skeleton-line {
          height: 16px;
          background: linear-gradient(
            90deg,
            #f0f0f0 25%,
            #e0e0e0 50%,
            #f0f0f0 75%
          );
          background-size: 200% 100%;
          border-radius: 4px;
          margin-bottom: 12px;
          animation: skeleton-shimmer 1.5s infinite;
        }

        .skeleton-line.short {
          width: 60%;
        }

        .skeleton-line:last-child {
          margin-bottom: 0;
        }

        @keyframes skeleton-shimmer {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }
      `}</style>
    </>
  );
}

/**
 * Inline Loading Spinner (for buttons, etc.)
 */
export function InlineLoader({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const dimension = size === 'sm' ? 16 : 20;

  return (
    <>
      <span className="inline-loader" />
      <style jsx>{`
        .inline-loader {
          display: inline-block;
          width: ${dimension}px;
          height: ${dimension}px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: currentColor;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </>
  );
}

/**
 * Button Loading State
 */
interface ButtonLoadingProps {
  loading: boolean;
  children: React.ReactNode;
  loadingText?: string;
}

export function ButtonLoading({
  loading,
  children,
  loadingText = 'Loading...',
}: ButtonLoadingProps) {
  if (!loading) {
    return <>{children}</>;
  }

  return (
    <>
      <span className="button-loading">
        <InlineLoader size="sm" />
        <span>{loadingText}</span>
      </span>
      <style jsx>{`
        .button-loading {
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
      `}</style>
    </>
  );
}
