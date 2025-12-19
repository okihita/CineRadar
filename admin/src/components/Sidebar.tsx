'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, MapPin, Film, Users, ChevronLeft, ChevronRight, DollarSign, Trophy, TrendingUp, Navigation, Settings, Heart, Brain, Database } from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

const menuItems = [
  {
    title: 'Executive Dashboard',
    description: 'Overview & insights',
    href: '/',
    icon: LayoutDashboard,
  },
  {
    title: 'Cinema Intelligence',
    description: 'Theatre locations & chains',
    href: '/cinemas',
    icon: MapPin,
  },
  {
    title: 'Movie Intelligence',
    description: 'Showtimes & schedules',
    href: '/movies',
    icon: Film,
  },
  {
    title: 'Audience Intelligence',
    description: 'Seat occupancy & trends',
    href: '/audience',
    icon: Users,
  },
  {
    title: 'Revenue Intelligence',
    description: 'Pricing & forecasting',
    href: '/revenue',
    icon: DollarSign,
  },
  {
    title: 'Competition Intelligence',
    description: 'Market share & rivals',
    href: '/competition',
    icon: Trophy,
  },
  {
    title: 'Trend Intelligence',
    description: 'Genre & seasonal patterns',
    href: '/trends',
    icon: TrendingUp,
  },
  {
    title: 'Location Intelligence',
    description: 'Catchment & expansion',
    href: '/location',
    icon: Navigation,
  },
  {
    title: 'Operations Intelligence',
    description: 'Scheduling & capacity',
    href: '/operations',
    icon: Settings,
  },
  {
    title: 'Engagement Intelligence',
    description: 'Loyalty & promotions',
    href: '/engagement',
    icon: Heart,
  },
  {
    title: 'Advanced Analytics',
    description: 'Predictions & scenarios',
    href: '/analytics',
    icon: Brain,
  },
  {
    title: 'Scraper Monitor',
    description: 'Data collection & runs',
    href: '/scraper',
    icon: Database,
  },
];





export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // Initialize theme on client mount (prevents hydration mismatch)
  useEffect(() => {
    const savedTheme = localStorage.getItem('darkMode');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = savedTheme === 'true' || (!savedTheme && prefersDark);
    document.documentElement.classList.toggle('dark', isDark);
  }, []);

  return (
    <aside
      className={cn(
        'h-screen bg-muted/30 border-r flex flex-col transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="p-4 border-b flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-primary-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="6" />
            <circle cx="12" cy="12" r="2" />
          </svg>
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="text-lg font-bold tracking-tight">CineRadar</h1>
            <p className="text-xs text-muted-foreground">Intelligence Dashboard</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1">
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted text-muted-foreground hover:text-foreground'
              )}
              title={collapsed ? item.title : undefined}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && (
                <div className="overflow-hidden">
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className={cn(
                    'text-xs',
                    isActive ? 'text-primary-foreground/70' : 'text-muted-foreground'
                  )}>
                    {item.description}
                  </p>
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Theme Toggle + Collapse */}
      <div className="p-2 border-t space-y-1">
        <button
          onClick={() => {
            const isDark = document.documentElement.classList.toggle('dark');
            localStorage.setItem('darkMode', String(isDark));
          }}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title="Toggle theme"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="5" />
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </svg>
          {!collapsed && <span className="text-xs">Toggle Theme</span>}
        </button>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span className="text-xs">Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
