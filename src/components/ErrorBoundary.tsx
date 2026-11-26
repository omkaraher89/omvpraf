import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'An unexpected application error occurred.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Application ErrorBoundary caught error:', error, info);
  }

  handleReload = (): void => {
    this.setState({ hasError: false, message: '' });
    window.location.reload();
  };

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="w-screen h-screen flex items-center justify-center p-6 bg-[#090a0f] text-[#eef1f7]">
        <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#121622]/95 p-6 shadow-2xl space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#f23645]/15 border border-[#f23645]/40 flex items-center justify-center text-[#f23645] shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-[15px] font-semibold tracking-tight">Workspace Recovery</h1>
              <p className="text-[12px] text-[#9aa1b2]">
                Something went wrong while rendering the workspace.
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-black/40 border border-white/10 p-3 text-[11.5px] font-mono text-[#d0d5e2] break-words">
            {this.state.message}
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, message: '' })}
              className="px-3.5 py-2 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-[12px] font-medium transition-colors"
            >
              Try Dismissing
            </button>
            <button
              type="button"
              onClick={this.handleReload}
              className="px-4 py-2 rounded-lg bg-[#2962ff] hover:bg-[#1e53e5] text-white text-[12px] font-semibold flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reload Workspace</span>
            </button>
          </div>
        </div>
      </div>
    );
  }
}
