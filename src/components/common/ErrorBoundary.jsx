import React, { Component } from 'react';
import { ShieldAlert, RefreshCw, Home, HelpCircle } from 'lucide-react';

/**
 * Reusable Production-Grade React Error Boundary
 * MedEx Healthcare Logistics
 * 
 * Prevents the application from crashing to a blank white screen.
 * Displays a professional healthcare UI recovery card, provides a retry/reset action,
 * and avoids leaking technical stack traces to users.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorId: null,
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error,
      errorId: 'ERR-' + Date.now().toString(36).toUpperCase(),
    };
  }

  componentDidCatch(error, errorInfo) {
    // Ensure actual error and stack trace are prominently visible in console for developers
    console.error('[MedEx Error Boundary caught render exception]:', error);
    if (errorInfo?.componentStack) {
      console.error('[MedEx Component Stack]:', errorInfo.componentStack);
    }
    if (import.meta.env?.DEV) {
      console.warn('[MedEx Error Boundary Debug Info]:', {
        name: error?.name,
        message: error?.message,
        stack: error?.stack,
        componentStack: errorInfo?.componentStack,
      });
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorId: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[50vh] flex items-center justify-center p-4 sm:p-6 my-auto">
          <div className="max-w-md w-full bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-xl shadow-slate-200/50 text-center space-y-5">
            {/* Shield Icon */}
            <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shadow-sm">
              <ShieldAlert className="w-7 h-7" />
            </div>

            {/* Error Content */}
            <div className="space-y-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-100 text-amber-800 border border-amber-200 inline-block">
                FAULT ISOLATION SENTINEL
              </span>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                Temporary Rendering Issue
              </h2>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                The interface encountered an unexpected condition while rendering this section.
                Your session and data remain safe and uncorrupted.
              </p>
            </div>

            {/* Error Reference Badge */}
            {this.state.errorId && (
              <div className="py-2 px-3 bg-slate-50 rounded-xl border border-slate-100 text-[11px] font-mono text-slate-600 flex items-center justify-between">
                <span>Incident Reference:</span>
                <span className="font-bold text-slate-800">{this.state.errorId}</span>
              </div>
            )}

            {/* Developer Diagnostics (Visible only in Development) */}
            {import.meta.env?.DEV && this.state.error && (
              <details className="text-left bg-rose-50/60 border border-rose-200 rounded-xl p-3 text-xs text-rose-900 overflow-hidden">
                <summary className="font-mono font-bold cursor-pointer text-[11px] text-rose-700 hover:text-rose-900">
                  Developer Exception Diagnostics
                </summary>
                <div className="mt-2 space-y-1 font-mono text-[10px] break-all max-h-36 overflow-auto">
                  <p className="font-bold">{this.state.error.name}: {this.state.error.message}</p>
                  {this.state.error.stack && (
                    <pre className="text-[9px] text-rose-800/80 whitespace-pre-wrap mt-1">
                      {this.state.error.stack.split('\n').slice(0, 5).join('\n')}
                    </pre>
                  )}
                </div>
              </details>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold shadow-md shadow-primary-600/20 transition-all cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Component</span>
              </button>

              <button
                type="button"
                onClick={this.handleReload}
                className="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all cursor-pointer"
              >
                <span>Reload Page</span>
              </button>
            </div>

            {/* Secondary Home link */}
            <div>
              <button
                type="button"
                onClick={this.handleGoHome}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-slate-600 transition-colors"
              >
                <Home className="w-3 h-3" />
                <span>Return to Platform Home</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
