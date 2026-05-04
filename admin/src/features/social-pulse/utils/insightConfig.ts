import { Zap, AlertCircle, CheckCircle2, TrendingDown, type LucideIcon } from 'lucide-react';
import { MovieBuzz } from '../types';

export interface InsightConfig {
    label: string;
    icon: LucideIcon;
    color: string;
    bg: string;
    border: string;
    desc: string;
}

export function getInsightConfig(insight: MovieBuzz['insight']): InsightConfig {
    switch (insight) {
        case 'pent-up':
            return {
                label: 'Pent-up Demand',
                icon: Zap,
                color: 'text-blue-500',
                bg: 'bg-blue-500/10',
                border: 'border-blue-500/20',
                desc: 'Social interest > Ticket sales. Expect a spike.'
            };
        case 'over-hyped':
            return {
                label: 'Marketing Only',
                icon: AlertCircle,
                color: 'text-amber-500',
                bg: 'bg-amber-500/10',
                border: 'border-amber-500/20',
                desc: 'High buzz but low conversion to sales.'
            };
        case 'fading':
            return {
                label: 'Fading Interest',
                icon: TrendingDown,
                color: 'text-red-500',
                bg: 'bg-red-500/10',
                border: 'border-red-500/20',
                desc: 'Buzz and sales are dropping together.'
            };
        default:
            return {
                label: 'Synced',
                icon: CheckCircle2,
                color: 'text-green-500',
                bg: 'bg-green-500/10',
                border: 'border-green-500/20',
                desc: 'Social buzz matches box office performance.'
            };
    }
}
