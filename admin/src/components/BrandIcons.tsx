'use client';

import { siYoutube, siX, siInstagram, siTiktok } from 'simple-icons/icons';

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

export function XIcon({ className }: { className?: string }) {
    return <BrandIcon svg={siX.svg} title={siX.title} className={className} />;
}

export function InstagramIcon({ className }: { className?: string }) {
    return <BrandIcon svg={siInstagram.svg} title={siInstagram.title} className={className} />;
}

export function TikTokIcon({ className }: { className?: string }) {
    return <BrandIcon svg={siTiktok.svg} title={siTiktok.title} className={className} />;
}

/** Get the right icon component for a platform */
export function PlatformIcon({ platform, className }: { platform: string; className?: string }) {
    switch (platform) {
        case 'youtube':
            return <YouTubeIcon className={className} />;
        case 'twitter':
            return <XIcon className={className} />;
        case 'instagram':
            return <InstagramIcon className={className} />;
        case 'tiktok':
            return <TikTokIcon className={className} />;
        default:
            return <YouTubeIcon className={className} />;
    }
}
