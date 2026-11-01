import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', fontFamily: 'sans-serif', color: '#333' }}>
          <h1 style={{ color: '#d32f2f' }}>Something went wrong.</h1>
          <p>The application crashed during rendering.</p>
          <pre style={{ background: '#f5f5f5', padding: '1rem', overflowX: 'auto' }}>
            {this.state.error?.message}
          </pre>
          <p style={{ fontSize: '0.8rem', marginTop: '1rem', color: '#666' }}>
            Check the browser console for more details.
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}
