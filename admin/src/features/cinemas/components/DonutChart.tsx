/**
 * Donut Chart component for region breakdown visualization
 * Extracted from cinemas/page.tsx
 */
'use client';

import { useMemo } from 'react';
import { REGION_COLORS } from '@/lib/constants';
import { describeDonutArc } from '@/lib/mapUtils';
import type { RegionBreakdown } from '../types';

interface DonutChartProps {
    data: RegionBreakdown[];
    total: number;
    size?: number;
}

export function DonutChart({ data, total, size = 160 }: DonutChartProps) {
    const cx = size / 2;
    const cy = size / 2;
    const outerR = (size / 2) - 15;
    const innerR = outerR * 0.6;

    // Pre-calculate all segment data to avoid mutating during render
    const segments = useMemo(() => {
        return data.reduce<Array<{ item: RegionBreakdown; ratio: number; path: string; color: string }>>((acc, item, i) => {
            const currentAngle = acc.reduce((sum, seg) => sum + seg.ratio * 360, 0);
            const ratio = item.count / (total || 1);
            const angle = ratio * 360;
            const path = describeDonutArc(cx, cy, outerR, innerR, currentAngle, currentAngle + angle);
            acc.push({ item, ratio, path, color: REGION_COLORS[i % REGION_COLORS.length] });
            return acc;
        }, []);
    }, [data, total, cx, cy, outerR, innerR]);

    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {segments.map(({ item, ratio, path, color }) => (
                <g key={item.name}>
                    <path
                        d={path}
                        fill={color}
                        className="cursor-help transition-opacity hover:opacity-80"
                    >
                        <title>
                            {item.name}: {item.count} ({Math.round(ratio * 100)}%)
                        </title>
                    </path>
                </g>
            ))}
            <text
                x={cx}
                y={cy + 6}
                textAnchor="middle"
                className="fill-foreground text-lg font-bold"
            >
                {total}
            </text>
        </svg>
    );
}
