// services/frontend/next-app/app/components/PostProcessingErrorBoundary.tsx
'use client';

import { Component, ReactNode, ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary for Post-Processing Effects
 *
 * Catches errors in post-processing effects and provides fallback rendering
 * without effects. Logs errors for debugging purposes.
 *
 * Requirements: 6.9 - Graceful degradation for unsupported features
 */
export default class PostProcessingErrorBoundary extends Component<
  Props,
  State
> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details for debugging
    console.error('PostProcessing Error:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
    });

    // Log to external error tracking service if available
    if (typeof window !== 'undefined' && (window as any).errorTracker) {
      (window as any).errorTracker.logError({
        type: 'PostProcessingError',
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
      });
    }
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided, otherwise return null (no post-processing)
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback: render without post-processing effects
      console.warn(
        'Post-processing disabled due to error. Rendering without effects.'
      );
      return null;
    }

    return this.props.children;
  }
}
