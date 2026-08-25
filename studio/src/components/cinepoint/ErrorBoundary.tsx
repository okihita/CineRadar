'use client';

import { Component, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Catches rendering errors (especially recharts exceptions from bad data)
 * and displays a friendly fallback instead of a white screen.
 */
export class CinePointErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <Card className="border-amber-500/20">
          <CardContent className="py-8 flex flex-col items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-amber-500" />
            <p className="text-sm font-bold text-muted-foreground">Something went wrong rendering this section</p>
            <p className="text-sm text-muted-foreground/50 max-w-md text-center">{this.state.error?.message}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="text-sm font-bold text-primary hover:underline"
            >
              Try again
            </button>
          </CardContent>
        </Card>
      );
    }
    return this.props.children;
  }
}
