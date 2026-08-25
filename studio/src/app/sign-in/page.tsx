"use client";

import { signIn } from "next-auth/react";
import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, Clock, Ban } from "lucide-react";

function AuthErrorBanner() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  if (!error) return null;

  const config: Record<string, { icon: React.ReactNode; title: string; message: string; className: string }> = {
    AccessPending: {
      icon: <Clock className="w-5 h-5 text-amber-500" />,
      title: "Registration Submitted",
      message: "Your account is awaiting admin approval. You'll receive access once approved.",
      className: "border-amber-500/20 bg-amber-500/5",
    },
    AccessDenied: {
      icon: <Ban className="w-5 h-5 text-red-500" />,
      title: "Access Denied",
      message: "Your registration was not approved. Contact an administrator for assistance.",
      className: "border-red-500/20 bg-red-500/5",
    },
    AccessSuspended: {
      icon: <AlertCircle className="w-5 h-5 text-orange-500" />,
      title: "Account Suspended",
      message: "Your account has been suspended. Contact an administrator for assistance.",
      className: "border-orange-500/20 bg-orange-500/5",
    },
  };

  const c = config[error];
  if (!c) return null;

  return (
    <div className={`flex items-start gap-3 p-4 rounded-xl border ${c.className} mb-6`}>
      <div className="flex-shrink-0 mt-0.5">{c.icon}</div>
      <div>
        <p className="text-sm font-semibold">{c.title}</p>
        <p className="text-xs text-muted-foreground mt-1">{c.message}</p>
      </div>
    </div>
  );
}

const STATS = [
  { label: "Theatres Tracked", value: "500+", sub: "across Indonesia" },
  { label: "Daily Showtimes", value: "15K+", sub: "real-time monitoring" },
  { label: "Cinema Chains", value: "4", sub: "XXI · CGV · Cinépolis · FLIX" },
  { label: "Cities Covered", value: "50+", sub: "nationwide coverage" },
];

export default function SignInPage() {
  const [loading, setLoading] = useState(false);

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left: Branding + Stats */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-primary">
        {/* Cinematic radial gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/95 to-primary/80" />

        {/* Decorative film reel pattern */}
        <div className="absolute inset-0 opacity-[0.03]">
          <div className="absolute top-10 left-10 w-32 h-32 rounded-full border-2 border-white" />
          <div className="absolute top-10 left-10 w-24 h-24 rounded-full border-2 border-white mx-auto my-auto" style={{ margin: '16px' }} />
          <div className="absolute bottom-20 right-20 w-48 h-48 rounded-full border-2 border-white" />
          <div className="absolute top-1/3 right-10 w-20 h-20 rounded-full border-2 border-white" />
          <div className="absolute bottom-1/3 left-1/4 w-16 h-16 rounded-full border-2 border-white" />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-16">
          {/* Logo */}
          <div className="flex items-center gap-4 mb-12">
            <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/10">
              <svg className="w-7 h-7 text-primary-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="6" />
                <circle cx="12" cy="12" r="2" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-black text-primary-foreground tracking-tight">CineRadar</h1>
              <p className="text-sm text-primary-foreground/50 font-medium tracking-wide">INTELLIGENCE DASHBOARD</p>
            </div>
          </div>

          {/* Tagline */}
          <h2 className="text-4xl font-black text-primary-foreground leading-tight mb-4">
            Real-time Indonesian<br />Cinema Intelligence
          </h2>
          <p className="text-base text-primary-foreground/60 leading-relaxed max-w-md mb-16">
            Track showtime coverage, monitor box office performance, and analyze theatre networks across the Indonesian cinema landscape.
          </p>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-4">
            {STATS.map((stat) => (
              <div key={stat.label} className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                <p className="text-2xl font-black text-primary-foreground font-mono">{stat.value}</p>
                <p className="text-xs font-semibold text-primary-foreground/80 mt-0.5">{stat.label}</p>
                <p className="text-[10px] text-primary-foreground/40">{stat.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Sign-in form */}
      <div className="flex-1 flex items-center justify-center px-8">
        <div className="w-full max-w-sm">
          {/* Mobile logo (hidden on desktop) */}
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <svg className="w-5 h-5 text-primary-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="6" />
                <circle cx="12" cy="12" r="2" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold">CineRadar</h1>
              <p className="text-[10px] text-muted-foreground tracking-wide">INTELLIGENCE DASHBOARD</p>
            </div>
          </div>

          <h2 className="text-2xl font-bold mb-2">Welcome back</h2>
          <p className="text-sm text-muted-foreground mb-8">Sign in to access the dashboard.</p>

          {/* Auth status messages */}
          <Suspense fallback={null}>
            <AuthErrorBanner />
          </Suspense>

          {/* Google Sign-in Button */}
          <button
            onClick={() => { setLoading(true); signIn("google", { callbackUrl: "/" }); }}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3.5 rounded-xl border border-border bg-background hover:bg-muted transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {loading ? 'Signing in...' : 'Sign in with Google'}
          </button>

          {/* Footer */}
          <div className="mt-12 pt-6 border-t border-border">
            <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
              New here? Sign in with Google to request access.<br />
              An administrator will review and approve your account.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
