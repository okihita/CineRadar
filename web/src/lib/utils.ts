import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function formatRupiah(value: number): string {
    if (value >= 1_000_000_000) return `Rp${(value / 1_000_000_000).toFixed(1)}B`;
    if (value >= 1_000_000) return `Rp${(value / 1_000_000).toFixed(0)}M`;
    if (value >= 1_000) return `Rp${(value / 1_000).toFixed(0)}K`; // Matching Admin's uppercase K
    return `Rp${value}`;
}
