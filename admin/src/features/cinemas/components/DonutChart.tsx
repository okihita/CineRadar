'use client';

import { useMemo } from 'react';
import { describeDonutArc } from '@/lib/mapUtils';

export interface DonutItem {
    name: string;
    count: number;
    color?: string;
}

interface DonutChartProps {
    data: DonutItem[];
    total: number;
    size?: number;
    defaultColors?: string[];
}

/**
 * Generic High-Density Donut Chart
 */
export function DonutChart({ data, total, size = 160, defaultColors = [] }: DonutChartProps) {
    const cx = size / 2;
    const cy = size / 2;
    const outerR = (size / 2) - 15;
    const innerR = outerR * 0.6;

    const segments = useMemo(() => {
        return data.reduce<Array<{ item: DonutItem; ratio: number; path: string; color: string }>>((acc, item, i) => {
            const currentAngle = acc.reduce((sum, seg) => sum + seg.ratio * 360, 0);
            const ratio = item.count / (total || 1);
            const angle = ratio * 360;
            const path = describeDonutArc(cx, cy, outerR, innerR, currentAngle, currentAngle + angle);
            
            // Priority: Item Color > Default Colors Array > Gray
            const color = item.color || defaultColors[i % defaultColors.length] || '#e5e7eb';
            
            acc.push({ item, ratio, path, color });
            return acc;
        }, []);
    }, [data, total, cx, cy, outerR, innerR, defaultColors]);

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
