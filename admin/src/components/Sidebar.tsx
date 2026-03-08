'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, MapPin, Film, ChevronLeft, ChevronRight, Database, Calendar, Clapperboard, Sun, Moon, Monitor, Layers } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useDarkModeContext } from '@/hooks';

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
    title: 'Performance Intelligence',
    description: 'Box office tracking',
    href: '/performances',
    icon: Film,
  },
  {
    title: 'Movie Database',
    description: 'All movies & details',
    href: '/movies',
    icon: Clapperboard,
  },
  {
    title: 'Showtime Intelligence',
    description: 'Daily coverage & analysis',
    href: '/schedules',
    icon: Calendar,
  },
  {
    title: 'Schedules V2',
    description: 'Metadata ID validation',
    href: '/schedules_v2',
    icon: Layers,
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
  const { darkMode, toggleDarkMode, followsSystem, resetToSystem } = useDarkModeContext();

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
          const isActive = item.href === '/'
            ? pathname === '/'
            : pathname.startsWith(item.href);
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
        {/* Theme Toggle Button */}
        <button
          onClick={toggleDarkMode}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {darkMode ? (
            <Sun className="w-5 h-5" />
          ) : (
            <Moon className="w-5 h-5" />
          )}
          {!collapsed && (
            <span className="text-xs">
              {darkMode ? 'Light Mode' : 'Dark Mode'}
            </span>
          )}
        </button>

        {/* Reset to System Button - only show if user has overridden */}
        {!followsSystem && (
          <button
            onClick={resetToSystem}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Reset to system theme"
          >
            <Monitor className="w-5 h-5" />
            {!collapsed && (
              <span className="text-xs">Auto</span>
            )}
          </button>
        )}

        {/* Collapse Button */}
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
