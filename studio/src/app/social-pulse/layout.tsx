import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: "Social Pulse | CineRadar Admin",
    description: "Cross-platform sentiment analysis and buzz tracking for Indonesian cinema.",
    openGraph: {
        title: "Social Pulse Dashboard",
        description: "Analyze market buzz vs. actual sales performance.",
        images: ['/opengraph-image'],
    },
};

export default function SocialPulseLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
