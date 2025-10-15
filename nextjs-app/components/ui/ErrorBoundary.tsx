/**
 * Error Boundary Component
 *
 * Catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI instead of crashing.
 *
 * Usage:
 * <ErrorBoundary fallback={<ErrorFallback />}>
 *   <YourComponent />
 * </ErrorBoundary>
 */

'use client';

import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to console
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Update state with error details
    this.setState({
      errorInfo,
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // In production, you would send this to an error reporting service
    // e.g., Sentry.captureException(error, { contexts: { react: errorInfo } });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <DefaultErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onReset={this.handleReset}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * Default Error Fallback Component
 */
interface FallbackProps {
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  onReset: () => void;
}

function DefaultErrorFallback({ error, errorInfo, onReset }: FallbackProps) {
  const isDevelopment = process.env.NODE_ENV === 'development';

  return (
    <div className="error-fallback">
      <div className="error-fallback-content">
        <div className="error-icon">⚠️</div>
        <h1>Something went wrong</h1>
        <p className="error-message">
          An unexpected error occurred. Please try refreshing the page.
        </p>

        {error && (
          <div className="error-details">
            <strong>Error:</strong> {error.message}
          </div>
        )}

        {isDevelopment && errorInfo && (
          <details className="error-stack">
            <summary>Stack Trace (Development Only)</summary>
            <pre>{errorInfo.componentStack}</pre>
          </details>
        )}

        <div className="error-actions">
          <button onClick={onReset} className="btn-retry">
            Try Again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="btn-reload"
          >
            Reload Page
          </button>
        </div>
      </div>

      <style jsx>{`
        .error-fallback {
          min-height: 100vh;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 2rem;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }

        .error-fallback-content {
          background: white;
          border-radius: 16px;
          padding: 3rem;
          max-width: 600px;
          width: 100%;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
          text-align: center;
        }

        .error-icon {
          font-size: 4rem;
          margin-bottom: 1rem;
        }

        h1 {
          margin: 0 0 1rem 0;
          color: #2c3e50;
          font-size: 2rem;
        }

        .error-message {
          color: #7f8c8d;
          font-size: 1.1rem;
          margin-bottom: 1.5rem;
        }

        .error-details {
          background: #fee;
          border: 1px solid #fcc;
          border-radius: 8px;
          padding: 1rem;
          margin-bottom: 1.5rem;
          text-align: left;
          color: #c33;
        }

        .error-details strong {
          display: block;
          margin-bottom: 0.5rem;
        }

        .error-stack {
          background: #f8f9fa;
          border: 1px solid #e1e8ed;
          border-radius: 8px;
          padding: 1rem;
          margin-bottom: 1.5rem;
          text-align: left;
        }

        .error-stack summary {
          cursor: pointer;
          font-weight: 600;
          color: #2c3e50;
          margin-bottom: 0.5rem;
        }

        .error-stack pre {
          margin: 1rem 0 0 0;
          padding: 1rem;
          background: #2c3e50;
          color: #ecf0f1;
          border-radius: 4px;
          overflow-x: auto;
          font-size: 0.85rem;
          line-height: 1.4;
        }

        .error-actions {
          display: flex;
          gap: 1rem;
          justify-content: center;
        }

        .btn-retry,
        .btn-reload {
          padding: 0.875rem 1.5rem;
          border: none;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-retry {
          background: #667eea;
          color: white;
        }

        .btn-retry:hover {
          background: #5568d3;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }

        .btn-reload {
          background: #95a5a6;
          color: white;
        }

        .btn-reload:hover {
          background: #7f8c8d;
          transform: translateY(-2px);
        }

        @media (max-width: 768px) {
          .error-fallback {
            padding: 1rem;
          }

          .error-fallback-content {
            padding: 2rem 1.5rem;
          }

          h1 {
            font-size: 1.5rem;
          }

          .error-message {
            font-size: 1rem;
          }

          .error-actions {
            flex-direction: column;
          }

          .btn-retry,
          .btn-reload {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}

/**
 * Specialized Error Boundary for context/provider errors
 */
export class ContextErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Context ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);
  }

  handleReset = () => {
    // Clear session storage for context reinitialization
    sessionStorage.clear();
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="context-error-fallback">
          <div className="context-error-content">
            <div className="error-icon">⚠️</div>
            <h1>Context Initialization Failed</h1>
            <p className="error-message">
              The application context failed to initialize. This may be due to:
            </p>
            <ul className="error-reasons">
              <li>Wallet connection issues</li>
              <li>RPC endpoint unavailable</li>
              <li>Program deployment issues</li>
              <li>Browser storage restrictions</li>
            </ul>

            {this.state.error && (
              <div className="error-details">
                <strong>Technical Details:</strong>
                <code>{this.state.error.message}</code>
              </div>
            )}

            <div className="error-actions">
              <button onClick={this.handleReset} className="btn-reset">
                Clear Session & Reload
              </button>
            </div>
          </div>

          <style jsx>{`
            .context-error-fallback {
              min-height: 100vh;
              display: flex;
              justify-content: center;
              align-items: center;
              padding: 2rem;
              background: #f5f7fa;
            }

            .context-error-content {
              background: white;
              border-radius: 16px;
              padding: 3rem;
              max-width: 600px;
              width: 100%;
              box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
            }

            .error-icon {
              font-size: 3rem;
              text-align: center;
              margin-bottom: 1rem;
            }

            h1 {
              margin: 0 0 1rem 0;
              color: #e74c3c;
              font-size: 1.75rem;
              text-align: center;
            }

            .error-message {
              color: #7f8c8d;
              text-align: center;
              margin-bottom: 1rem;
            }

            .error-reasons {
              list-style-position: inside;
              margin: 1rem 0 1.5rem 0;
              padding: 0;
              color: #2c3e50;
            }

            .error-reasons li {
              padding: 0.5rem 0;
            }

            .error-details {
              background: #f8f9fa;
              border: 1px solid #e1e8ed;
              border-radius: 8px;
              padding: 1rem;
              margin-bottom: 1.5rem;
            }

            .error-details strong {
              display: block;
              margin-bottom: 0.5rem;
              color: #2c3e50;
            }

            .error-details code {
              display: block;
              padding: 0.5rem;
              background: white;
              border: 1px solid #e1e8ed;
              border-radius: 4px;
              font-family: 'Courier New', monospace;
              font-size: 0.85rem;
              color: #c33;
              word-break: break-word;
            }

            .error-actions {
              display: flex;
              justify-content: center;
            }

            .btn-reset {
              background: #e74c3c;
              color: white;
              border: none;
              border-radius: 8px;
              padding: 0.875rem 1.5rem;
              font-size: 1rem;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.2s;
            }

            .btn-reset:hover {
              background: #c0392b;
              transform: translateY(-2px);
              box-shadow: 0 4px 12px rgba(231, 76, 60, 0.4);
            }

            @media (max-width: 768px) {
              .context-error-fallback {
                padding: 1rem;
              }

              .context-error-content {
                padding: 2rem 1.5rem;
              }

              h1 {
                font-size: 1.5rem;
              }

              .btn-reset {
                width: 100%;
              }
            }
          `}</style>
        </div>
      );
    }

    return this.props.children;
  }
}
