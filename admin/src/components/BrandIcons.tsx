'use client';

import { siYoutube } from 'simple-icons/icons';

/**
 * Simple brand icons powered by `simple-icons`.
 * 
 * Each icon renders the official SVG path data from simple-icons,
 * sized and colored via Tailwind className.
 */

function BrandIcon({ svg, title, className }: { svg: string; title: string; className?: string }) {
    // simple-icons SVGs are full <svg> elements — extract just the path
    const pathMatch = svg.match(/<path[^>]*d="([^"]*)"[^>]*\/>/);
    if (!pathMatch) return null;

    return (
        <svg role="img" viewBox="0 0 24 24" className={className} fill="currentColor">
            <title>{title}</title>
            <path d={pathMatch[1]} />
        </svg>
    );
}

export function YouTubeIcon({ className }: { className?: string }) {
    return <BrandIcon svg={siYoutube.svg} title={siYoutube.title} className={className} />;
}
