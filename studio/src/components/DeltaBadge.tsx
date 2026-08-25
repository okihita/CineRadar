'use client';

import { TrendingUp, TrendingDown } from 'lucide-react';

interface DeltaBadgeProps {
    value: string;
}

/**
 * Badge showing positive/negative percentage change
 */
export function DeltaBadge({ value }: DeltaBadgeProps) {
    const isPositive = value.startsWith('+') || (!value.startsWith('-') && parseFloat(value) > 0);
    const isNegative = value.startsWith('-') || parseFloat(value) < 0;

    return (
        <span className={`inline-flex items-center gap-1 text-sm font-medium ${isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-muted-foreground'
            }`}>
            {isPositive ? <TrendingUp className="w-4 h-4" /> : isNegative ? <TrendingDown className="w-4 h-4" /> : null}
            {isPositive && !value.startsWith('+') ? '+' : ''}{value}%
        </span>
    );
}
