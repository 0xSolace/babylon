'use client';

/**
 * PostHog Error Boundary
 * Catches and tracks React errors
 */

import { logger } from '@/lib/logger';
import { posthog } from '@/lib/posthog/client';
import React, { Component, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

export class PostHogErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Track error with PostHog
    if (posthog) {
      posthog.capture('$exception', {
        $exception_type: error.name || 'Error',
        $exception_message: error.message,
        $exception_stack: error.stack,
        componentStack: errorInfo.componentStack,
        errorBoundary: true,
        timestamp: new Date().toISOString(),
      });
    }

    // Also log using logger
    logger.error(
      'Error caught by PostHogErrorBoundary',
      { error, errorInfo },
      'PostHogErrorBoundary'
    );
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="text-center">
              <h2 className="mb-2 font-bold text-2xl">Something went wrong</h2>
              <p className="mb-4 text-muted-foreground">
                An error occurred. Please refresh the page.
              </p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
              >
                Refresh Page
              </button>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
