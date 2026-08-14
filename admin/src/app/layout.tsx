import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DarkModeProvider } from "@/hooks";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/components/AuthProvider";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CineRadar Admin | Intelligence Dashboard",
  description: "Manage and monitor Indonesian cinema theatre data with CineRadar's admin dashboard.",
  icons: {
    icon: "/icon.svg",
  },
  openGraph: {
    title: "CineRadar Admin",
    description: "Forensic Market Intelligence Dashboard",
    images: ['/opengraph-image'],
  },
  twitter: {
    card: 'summary_large_image',
    title: "CineRadar Admin",
    images: ['/opengraph-image'],
  }
};

// Blocking script to prevent flash of wrong theme and suppress internal performance measurement bugs
const initScript = `
(function() {
    // 1. Dark Mode initialization
    const STORAGE_KEY = 'cineradar-dark-mode';
    const stored = localStorage.getItem(STORAGE_KEY);
    let dark;
    if (stored !== null) {
        dark = stored === 'true';
    } else {
        dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    document.documentElement.classList.toggle('dark', dark);

    // 2. Suppress Next.js 16/Turbopack "negative time stamp" measurement error
    if (typeof window !== 'undefined' && window.performance && window.performance.measure) {
        const originalMeasure = window.performance.measure;
        window.performance.measure = function(name, start, end) {
            try {
                return originalMeasure.call(window.performance, name, start, end);
            } catch (e) {
                // Silently catch the "negative time stamp" error to prevent console spam/crashes
                if (e instanceof Error && e.message.includes('negative time stamp')) {
                    return;
                }
                throw e;
            }
        };
    }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: initScript }} />
      </head>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <AuthProvider>
          <DarkModeProvider>
            <TooltipProvider>
              <DashboardLayout>
                {children}
              </DashboardLayout>
              <Toaster />
            </TooltipProvider>
          </DarkModeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
