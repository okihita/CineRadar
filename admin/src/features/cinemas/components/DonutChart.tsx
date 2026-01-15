/**
 * Donut Chart component for region breakdown visualization
 * Extracted from cinemas/page.tsx
 */
'use client';

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

    let currentAngle = 0;

    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {data.map((item, i) => {
                const ratio = item.count / (total || 1);
                const angle = ratio * 360;
                const path = describeDonutArc(cx, cy, outerR, innerR, currentAngle, currentAngle + angle);
                currentAngle += angle;

                return (
                    <g key={item.name}>
                        <path
                            d={path}
                            fill={REGION_COLORS[i % REGION_COLORS.length]}
                            className="cursor-help transition-opacity hover:opacity-80"
                        >
                            <title>
                                {item.name}: {item.count} ({Math.round(ratio * 100)}%)
                            </title>
                        </path>
                    </g>
                );
            })}
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
