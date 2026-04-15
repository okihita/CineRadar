import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DarkModeProvider } from "@/hooks";
import { TooltipProvider } from "@/components/ui/tooltip";

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
};

// Blocking script to prevent flash of wrong theme on initial load
// This runs before React hydrates to immediately apply the correct theme
const themeScript = `
(function() {
    const STORAGE_KEY = 'cineradar-dark-mode';
    const stored = localStorage.getItem(STORAGE_KEY);
    let dark;
    if (stored !== null) {
        dark = stored === 'true';
    } else {
        dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    document.documentElement.classList.toggle('dark', dark);
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
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <DarkModeProvider>
          <TooltipProvider>
            <DashboardLayout>
              {children}
            </DashboardLayout>
          </TooltipProvider>
        </DarkModeProvider>
      </body>
    </html>
  );
}
