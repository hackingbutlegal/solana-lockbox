/**
 * Toast Notification Component
 *
 * Provides non-intrusive notifications for success, error, info, and warning messages
 */

'use client';

import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import './Toast.css';

export type ToastType = 'success' | 'error' | 'info' | 'warning' | 'loading';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  action?: ToastAction;
  persistent?: boolean;
  showProgress?: boolean;
}

export interface ToastOptions {
  duration?: number;
  action?: ToastAction;
  persistent?: boolean;
  showProgress?: boolean;
}

interface ToastContextType {
  showToast: (message: string, type: ToastType, options?: ToastOptions) => string;
  showSuccess: (message: string, options?: ToastOptions) => string;
  showError: (message: string, options?: ToastOptions) => string;
  showInfo: (message: string, options?: ToastOptions) => string;
  showWarning: (message: string, options?: ToastOptions) => string;
  showLoading: (message: string, options?: ToastOptions) => string;
  dismissToast: (id: string) => void;
  updateToast: (id: string, message: string, type?: ToastType, options?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType, options: ToastOptions = {}): string => {
    const id = Math.random().toString(36).substring(2, 9);
    const {
      duration = 4000,
      action,
      persistent = false,
      showProgress = true,
    } = options;

    const newToast: Toast = {
      id,
      message,
      type,
      duration: persistent ? 0 : duration,
      action,
      persistent,
      showProgress,
    };

    setToasts(prev => [...prev, newToast]);

    // Auto-remove toast after duration (if not persistent)
    if (!persistent && duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
      }, duration);
    }

    return id;
  }, []);

  const showSuccess = useCallback((message: string, options?: ToastOptions): string => {
    return showToast(message, 'success', options);
  }, [showToast]);

  const showError = useCallback((message: string, options?: ToastOptions): string => {
    return showToast(message, 'error', { duration: 6000, ...options });
  }, [showToast]);

  const showInfo = useCallback((message: string, options?: ToastOptions): string => {
    return showToast(message, 'info', options);
  }, [showToast]);

  const showWarning = useCallback((message: string, options?: ToastOptions): string => {
    return showToast(message, 'warning', { duration: 5000, ...options });
  }, [showToast]);

  const showLoading = useCallback((message: string, options?: ToastOptions): string => {
    return showToast(message, 'loading', { persistent: true, showProgress: false, ...options });
  }, [showToast]);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const updateToast = useCallback((id: string, message: string, type?: ToastType, options: ToastOptions = {}) => {
    setToasts(prev => prev.map(toast => {
      if (toast.id === id) {
        return {
          ...toast,
          message,
          type: type || toast.type,
          ...options,
        };
      }
      return toast;
    }));
  }, []);

  return (
    <ToastContext.Provider value={{
      showToast,
      showSuccess,
      showError,
      showInfo,
      showWarning,
      showLoading,
      dismissToast,
      updateToast,
    }}>
      {children}
      <div className="toast-container">
        {toasts.map(toast => (
          <ToastNotification
            key={toast.id}
            toast={toast}
            onClose={() => dismissToast(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

interface ToastNotificationProps {
  toast: Toast;
  onClose: () => void;
}

const ToastNotification: React.FC<ToastNotificationProps> = ({ toast, onClose }) => {
  const [isExiting, setIsExiting] = useState(false);
  const [progress, setProgress] = useState(100);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onClose, 300); // Wait for exit animation
  };

  const handleActionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (toast.action) {
      toast.action.onClick();
      handleClose();
    }
  };

  // Animate progress bar
  useEffect(() => {
    if (!toast.showProgress || !toast.duration || toast.duration === 0 || toast.persistent) {
      return;
    }

    const duration = toast.duration; // Store in variable for type narrowing
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);

      if (remaining === 0) {
        clearInterval(interval);
      }
    }, 16); // ~60fps

    return () => clearInterval(interval);
  }, [toast.duration, toast.showProgress, toast.persistent]);

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      case 'info':
        return 'ℹ';
      case 'loading':
        return (
          <span className="toast-spinner" aria-label="Loading">
            ⟳
          </span>
        );
      default:
        return '';
    }
  };

  return (
    <div
      className={`toast toast-${toast.type} ${isExiting ? 'toast-exit' : ''} ${toast.persistent ? 'toast-persistent' : ''}`}
      role="alert"
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
    >
      <div className="toast-content">
        <div className="toast-icon">{getIcon()}</div>
        <div className="toast-body">
          <div className="toast-message">{toast.message}</div>
          {toast.action && (
            <button
              className="toast-action"
              onClick={handleActionClick}
              aria-label={toast.action.label}
            >
              {toast.action.label}
            </button>
          )}
        </div>
        <button
          className="toast-close"
          onClick={handleClose}
          aria-label="Close notification"
        >
          ×
        </button>
      </div>
      {toast.showProgress && toast.duration && toast.duration > 0 && !toast.persistent && (
        <div className="toast-progress-bar">
          <div
            className="toast-progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
};
