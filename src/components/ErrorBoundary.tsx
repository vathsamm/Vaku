import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home, RotateCcw, Copy, Check } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    copied: false
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('💥 Uncaught runtime error captured by ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });

    try {
      if (typeof fetch === 'function') {
        fetch('/api/log_client_error', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'react_error_boundary',
            message: error?.message || String(error),
            stack: error?.stack || null,
            componentStack: errorInfo?.componentStack || null,
            url: window.location.href
          })
        }).catch(() => {});
      }
    } catch (_) {}
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetEditor = () => {
    try {
      localStorage.removeItem('ai_studio_video_editor_open');
      localStorage.removeItem('ai_studio_video_editor_master_fid');
      localStorage.removeItem('ai_studio_video_editor_project_id');
      sessionStorage.removeItem('dismissed_render_jobs');
      const url = new URL(window.location.href);
      url.searchParams.delete('editor_bucket');
      url.searchParams.delete('editor_fid');
      url.searchParams.delete('project');
      window.location.href = url.pathname + (url.searchParams.get('workspace') ? `?workspace=${url.searchParams.get('workspace')}` : '');
    } catch {
      window.location.href = '/';
    }
  };

  private handleResetAll = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (_) {}
    window.location.href = '/';
  };

  private handleCopyError = () => {
    const errText = `Error: ${this.state.error?.message || 'Unknown'}\n\nStack:\n${this.state.error?.stack || ''}\n\nComponent Stack:\n${this.state.errorInfo?.componentStack || ''}`;
    navigator.clipboard.writeText(errText).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    }).catch(() => {});
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full bg-gray-950 text-white flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
          <div className="bg-gray-900/90 border border-gray-800 rounded-2xl max-w-xl w-full p-6 sm:p-8 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-200 space-y-6">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                <AlertCircle size={26} />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  Application Encountered an Issue
                </h1>
                <p className="text-xs sm:text-sm text-gray-400 mt-0.5">
                  A component error occurred. Your work is safely saved in the cloud.
                </p>
              </div>
            </div>

            {/* Error Message Box */}
            <div className="bg-gray-950 rounded-xl border border-gray-800/80 p-3.5 space-y-1.5 overflow-hidden">
              <span className="text-[10px] font-mono uppercase tracking-wider text-rose-400 font-bold block">
                Error Details
              </span>
              <p className="font-mono text-xs text-rose-200 break-words leading-relaxed select-all">
                {this.state.error?.message || 'An unexpected rendering error occurred.'}
              </p>
            </div>

            {/* Recovery Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full sm:flex-1 py-2.5 px-4 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-purple-950/50 cursor-pointer active:scale-95"
              >
                <RefreshCw size={14} />
                <span>Reload Page</span>
              </button>

              <button
                type="button"
                onClick={this.handleResetEditor}
                className="w-full sm:flex-1 py-2.5 px-4 bg-gray-800 hover:bg-gray-700 text-gray-200 hover:text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 border border-gray-700 cursor-pointer active:scale-95"
              >
                <Home size={14} className="text-blue-400" />
                <span>Go to Dashboard</span>
              </button>

              <button
                type="button"
                onClick={this.handleCopyError}
                className="py-2.5 px-3 bg-gray-850 hover:bg-gray-800 text-gray-400 hover:text-gray-200 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 border border-gray-800 cursor-pointer shrink-0"
                title="Copy Error Details"
              >
                {this.state.copied ? (
                  <>
                    <Check size={13} className="text-emerald-400" />
                    <span className="text-emerald-400 text-[11px]">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy size={13} />
                    <span className="text-[11px]">Copy Log</span>
                  </>
                )}
              </button>
            </div>

            {/* Advanced Clear Option */}
            <div className="pt-2 border-t border-gray-850 flex items-center justify-between text-[11px] text-gray-500">
              <span>Persistent problem?</span>
              <button
                type="button"
                onClick={this.handleResetAll}
                className="text-rose-400/80 hover:text-rose-300 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw size={11} />
                <span>Reset Local Cache</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
