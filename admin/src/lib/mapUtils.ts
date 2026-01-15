/**
 * Map utility functions extracted from indonesia-map.tsx
 * Used for SVG generation, coordinate conversion, and formatting
 */

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
    const outerStart = {
        x: cx + outerR * Math.cos(toRad(startAngle)),
        y: cy + outerR * Math.sin(toRad(startAngle)),
    };
    const outerEnd = {
        x: cx + outerR * Math.cos(toRad(endAngle)),
        y: cy + outerR * Math.sin(toRad(endAngle)),
    };
    const innerStart = {
        x: cx + innerR * Math.cos(toRad(endAngle)),
        y: cy + innerR * Math.sin(toRad(endAngle)),
    };
    const innerEnd = {
        x: cx + innerR * Math.cos(toRad(startAngle)),
        y: cy + innerR * Math.sin(toRad(startAngle)),
    };
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${outerStart.x} ${outerStart.y} A ${outerR} ${outerR} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y} L ${innerStart.x} ${innerStart.y} A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerEnd.x} ${innerEnd.y} Z`;
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
    total: number,
    size: number
): string {
    const cx = size / 2;
    const cy = size / 2;
    const outerR = size / 2 - 2;
    const innerR = outerR * 0.5;

    const segments: { count: number; color: string }[] = [
        { count: xxi, color: '#CFAB7A' },
        { count: cgv, color: '#E03C31' },
        { count: cine, color: '#002069' },
    ].filter((s) => s.count > 0);

    if (segments.length === 0) {
        return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${cx}" cy="${cy}" r="${outerR}" fill="#666"/>
    </svg>`;
    }

    let paths = '';
    let currentAngle = 0;

    for (const segment of segments) {
        const angle = (segment.count / total) * 360;
        if (angle > 0) {
            const path = describeDonutArc(cx, cy, outerR, innerR, currentAngle, currentAngle + angle);
            paths += `<path d="${path}" fill="${segment.color}"/>`;
            currentAngle += angle;
        }
    }

    // Center count
    const fontSize = size * 0.28;
    paths += `<text x="${cx}" y="${cy + fontSize * 0.35}" text-anchor="middle" font-size="${fontSize}" font-weight="bold" fill="currentColor">${total}</text>`;

    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">${paths}</svg>`;
}

/**
 * Format timestamp as relative time
 */
export function formatLastSeen(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
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

    // Import React for JSX
    const React = require('react');

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
