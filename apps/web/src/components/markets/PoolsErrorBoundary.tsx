'use client';

import { logger } from '@babylon/shared';
import { AlertTriangle } from 'lucide-react';
import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class PoolsErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, _errorInfo: React.ErrorInfo) {
    // Error is already captured in state via getDerivedStateFromError
    // Log error for debugging
    if (process.env.NODE_ENV === 'development') {
      logger.error(
        'Pools Error Boundary caught error:',
        error,
        'PoolsErrorBoundary'
      );
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </div>
          <h3 className="mb-2 font-bold text-lg">Error Loading Pools</h3>
          <p className="mb-4 text-muted-foreground text-sm">
            {this.state.error?.message ||
              'Something went wrong loading the pools'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="rounded bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary/90"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
