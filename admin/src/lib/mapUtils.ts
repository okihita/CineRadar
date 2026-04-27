/**
 * Map utility functions extracted from indonesia-map.tsx
 * Used for SVG generation, coordinate conversion, and formatting
 */

import React from 'react';
import { CHAIN_COLORS } from './constants';

/**
 * Describe a donut arc path for SVG
 * Used for region breakdown pie charts
 */
export function describeDonutArc(
    cx: number,
    cy: number,
    outerR: number,
    innerR: number,
    startAngle: number,
    endAngle: number
): string {
    const toRad = (deg: number) => ((deg - 90) * Math.PI) / 180;
    
    // Outer arc points
    const x1 = cx + outerR * Math.cos(toRad(startAngle));
    const y1 = cy + outerR * Math.sin(toRad(startAngle));
    const x2 = cx + outerR * Math.cos(toRad(endAngle));
    const y2 = cy + outerR * Math.sin(toRad(endAngle));
    
    // Inner arc points
    const x3 = cx + innerR * Math.cos(toRad(endAngle));
    const y3 = cy + innerR * Math.sin(toRad(endAngle));
    const x4 = cx + innerR * Math.cos(toRad(startAngle));
    const y4 = cy + innerR * Math.sin(toRad(startAngle));
    
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    
    // Path: Move to outer start, Arc to outer end, Line to inner end, Arc back to inner start, Close
    return `M ${x1} ${y1} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerR} ${innerR} 0 ${largeArc} 0 ${x4} ${y4} Z`;
}

/**
 * Describe a simple arc path for SVG
 */
export function describeArc(
    x: number,
    y: number,
    radius: number,
    startAngle: number,
    endAngle: number
): string {
    const start = polarToCartesian(x, y, radius, endAngle);
    const end = polarToCartesian(x, y, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

/**
 * Convert polar coordinates to Cartesian
 */
export function polarToCartesian(
    cx: number,
    cy: number,
    r: number,
    angle: number
): { x: number; y: number } {
    const rad = ((angle - 90) * Math.PI) / 180;
    return {
        x: cx + r * Math.cos(rad),
        y: cy + r * Math.sin(rad),
    };
}

/**
 * Create pie chart SVG for cluster markers (donut style)
 */
export function createPieChartSvg(
    xxi: number,
    cgv: number,
    cine: number,
    flix: number,
    total: number,
    size: number
): string {
    const cx = size / 2;
    const cy = size / 2;
    // Reduce radius by 1px (half of 2px stroke) to prevent clipping at viewBox edges
    const radius = (size - 2) / 2;
    // outerR should be slightly smaller than the circle's inner edge for a clean look
    const outerR = radius - 1;
    const innerR = outerR * 0.5;

    const segments: { count: number; color: string }[] = [
        { count: xxi, color: CHAIN_COLORS.XXI },
        { count: cgv, color: CHAIN_COLORS.CGV },
        { count: cine, color: CHAIN_COLORS.Cinépolis },
        { count: flix, color: CHAIN_COLORS.FLIX },
    ].filter((s) => s.count > 0);

    if (segments.length === 0) {
        return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${cx}" cy="${cy}" r="${outerR}" fill="#666"/>
    </svg>`;
    }

    let paths = '';
    let currentAngle = 0;

    for (const segment of segments) {
        const angle = (segment.count / total) * 360;
        if (angle > 0) {
            // Handle near-full circles to avoid SVG arc glitching at exactly 360
            const effectiveAngle = angle >= 360 ? 359.99 : angle;
            const path = describeDonutArc(cx, cy, outerR, innerR, currentAngle, currentAngle + effectiveAngle);
            paths += `<path d="${path}" fill="${segment.color}"/>`;
            currentAngle += angle;
        }
    }

    // Center count and background setup
    const fontSize = size * 0.3;
    
    return `
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
            <circle cx="${cx}" cy="${cy}" r="${radius}" fill="white" stroke="#e5e7eb" stroke-width="2"/>
            ${paths}
            <text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="${fontSize}" font-weight="bold" fill="#374151">${total}</text>
        </svg>
    `.trim();
}

/**
 * Highlight search matches in text
 */
export function highlightText(text: string, searchTerm: string): React.ReactNode {
    if (!searchTerm.trim()) return text;

    const regex = new RegExp(
        `(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`,
        'gi'
    );
    const parts = text.split(regex);

    return parts.map((part, i) =>
        regex.test(part)
            ? React.createElement(
                'mark',
                { key: i, className: 'bg-yellow-200 dark:bg-yellow-800 rounded px-0.5' },
                part
            )
            : part
    );
}
