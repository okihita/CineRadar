'use client';

import React from 'react';

interface ErrorBoundaryProps {
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error?: Error;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('Error caught by boundary:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return this.props.fallback || (
                <div className="min-h-screen flex items-center justify-center bg-background">
                    <div className="text-center p-8">
                        <h2 className="text-xl font-semibold text-destructive mb-2">Something went wrong</h2>
                        <p className="text-muted-foreground mb-4">{this.state.error?.message}</p>
                        <button
                            onClick={() => this.setState({ hasError: false })}
                            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                        >
                            Try again
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
