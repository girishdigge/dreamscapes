'use client';

import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export default class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('🚨 ErrorBoundary caught an error:', error);
    console.error('🚨 Error info:', errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className='w-full h-full flex items-center justify-center bg-red-900/20 border border-red-500 rounded-lg'>
            <div className='text-center text-white p-6'>
              <div className='text-4xl mb-4'>💥</div>
              <h2 className='text-xl font-semibold mb-2'>
                Something went wrong
              </h2>
              <p className='text-red-300 mb-4'>
                {this.state.error?.message || 'An unexpected error occurred'}
              </p>
              <button
                onClick={() =>
                  this.setState({ hasError: false, error: undefined })
                }
                className='bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg transition-colors'
              >
                Try Again
              </button>
              {process.env.NODE_ENV === 'development' && (
                <details className='mt-4 text-left'>
                  <summary className='cursor-pointer text-red-400'>
                    Error Details
                  </summary>
                  <pre className='mt-2 text-xs bg-black/50 p-2 rounded overflow-auto'>
                    {this.state.error?.stack}
                  </pre>
                </details>
              )}
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
