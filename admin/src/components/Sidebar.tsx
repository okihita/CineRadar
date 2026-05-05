'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    MapPin, ChevronLeft, ChevronRight, ChevronDown,
    Database, Calendar, Clapperboard, Sun, Moon, Monitor,
    LogOut, Users as UsersIcon, Share2, ArrowRightLeft,
    TrendingUp, Rss, Settings, Shield, BookOpen, Radio,
    type LucideIcon,
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { useDarkModeContext } from '@/hooks';
import { useSession, signOut } from 'next-auth/react';

// ─── Types ───────────────────────────────────────────────

interface MenuItem {
    title: string;
    description: string;
    href: string;
    icon: LucideIcon;
    adminOnly: boolean;
}

interface MenuGroup {
    id: string;
    label: string;
    icon: LucideIcon;
    items: MenuItem[];
}

// ─── Menu Structure ──────────────────────────────────────

const standaloneItems: MenuItem[] = [
    {
        title: 'Head-to-Head Compare',
        description: 'Movie performance comparison',
        href: '/compare',
        icon: ArrowRightLeft,
        adminOnly: false,
    },
];

const menuGroups: MenuGroup[] = [
    {
        id: 'social',
        label: 'Social Intelligence',
        icon: Radio,
        items: [
            {
                title: 'Social Pulse',
                description: 'Sentiment & buzz tracking',
                href: '/social-pulse',
                icon: Share2,
                adminOnly: false,
            },
            {
                title: 'Industry Feed',
                description: 'Curated social timeline',
                href: '/social-feed',
                icon: Rss,
                adminOnly: false,
            },
            {
                title: 'Source Settings',
                description: 'Manage social sources',
                href: '/social-feed/settings',
                icon: Settings,
                adminOnly: false,
            },
        ],
    },
    {
        id: 'operations',
        label: 'Operations',
        icon: TrendingUp,
        items: [
            {
                title: 'Performance',
                description: 'Box office tracking',
                href: '/performances',
                icon: TrendingUp,
                adminOnly: false,
            },
            {
                title: 'Showtime Intelligence',
                description: 'Daily coverage & analysis',
                href: '/schedules',
                icon: Calendar,
                adminOnly: false,
            },
        ],
    },
    {
        id: 'knowledge',
        label: 'Knowledge Base',
        icon: BookOpen,
        items: [
            {
                title: 'Movie Registry',
                description: 'All movies & details',
                href: '/movies',
                icon: Clapperboard,
                adminOnly: false,
            },
            {
                title: 'Cinema Intelligence',
                description: 'Theatre locations & chains',
                href: '/cinemas',
                icon: MapPin,
                adminOnly: false,
            },
        ],
    },
];

const adminGroup: MenuGroup = {
    id: 'admin',
    label: 'Administration',
    icon: Shield,
    items: [
        {
            title: 'Scraper Monitor',
            description: 'Data collection & runs',
            href: '/scraper',
            icon: Database,
            adminOnly: false,
        },
        {
            title: 'User Management',
            description: 'Approve & manage access',
            href: '/users',
            icon: UsersIcon,
            adminOnly: true,
        },
    ],
};

// ─── Helpers ─────────────────────────────────────────────

const COLLAPSED_KEY = 'cineradar-nav-collapsed-groups';

function loadCollapsedGroups(): Set<string> {
    if (typeof window === 'undefined') return new Set();
    try {
        const raw = localStorage.getItem(COLLAPSED_KEY);
        if (raw) return new Set(JSON.parse(raw));
    } catch { /* ignore */ }
    return new Set();
}

function saveCollapsedGroups(groups: Set<string>) {
    try {
        localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...groups]));
    } catch { /* ignore */ }
}

/** Check if a menu item's route matches the current pathname */
function isItemActive(href: string, pathname: string): boolean {
    if (href === '/performances') {
        return pathname === '/performances' || pathname.startsWith('/performances/');
    }
    if (href === '/schedules') {
        return pathname === '/schedules' || pathname.startsWith('/schedules/');
    }
    if (href === '/social-feed') {
        return pathname === '/social-feed' || /^\/social-feed\/\d{4}/.test(pathname);
    }
    return pathname.startsWith(href);
}

/** Check if any item in a group is active */
function isGroupActive(group: MenuGroup, pathname: string): boolean {
    return group.items.some(item => isItemActive(item.href, pathname));
}

// ─── Component ───────────────────────────────────────────

export function Sidebar() {
    const pathname = usePathname();
    const [collapsed, setCollapsed] = useState(false);
    const { darkMode, toggleDarkMode, followsSystem, resetToSystem } = useDarkModeContext();
    const { data: session } = useSession();
    const isAdmin = (session as unknown as { user?: { role?: string } })?.user?.role === 'admin';

    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

    // Load persisted state on mount
    useEffect(() => {
        setCollapsedGroups(loadCollapsedGroups());
    }, []);

    const toggleGroup = useCallback((groupId: string) => {
        setCollapsedGroups(prev => {
            const next = new Set(prev);
            if (next.has(groupId)) {
                next.delete(groupId);
            } else {
                next.add(groupId);
            }
            saveCollapsedGroups(next);
            return next;
        });
    }, []);

    // Auto-expand groups that contain the active route (but don't persist this)
    const isGroupExpanded = (group: MenuGroup): boolean => {
        if (isGroupActive(group, pathname)) return true;
        return !collapsedGroups.has(group.id);
    };

    // Filter admin-only items from admin group
    const visibleAdminItems = adminGroup.items.filter(item => !item.adminOnly || isAdmin);
    const hasVisibleAdminGroup = visibleAdminItems.length > 0;

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
            <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
                {/* Standalone items (pinned at top) */}
                {standaloneItems.map((item) => {
                    const isActive = isItemActive(item.href, pathname);
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

                {/* Grouped menu sections */}
                {menuGroups.map((group) => (
                    <MenuSection
                        key={group.id}
                        group={group}
                        expanded={isGroupExpanded(group)}
                        collapsed={collapsed}
                        pathname={pathname}
                        onToggle={() => toggleGroup(group.id)}
                    />
                ))}
            </nav>

            {/* Bottom section: Admin group (pinned to bottom) */}
            {hasVisibleAdminGroup && (
                <div className="border-t p-2 pt-1.5 space-y-0.5">
                    <MenuSection
                        group={{ ...adminGroup, items: visibleAdminItems }}
                        expanded={isGroupExpanded(adminGroup)}
                        collapsed={collapsed}
                        pathname={pathname}
                        onToggle={() => toggleGroup(adminGroup.id)}
                    />
                </div>
            )}

            {/* User + Theme + Collapse */}
            <div className="p-2 border-t space-y-1">
                {/* User Info */}
                {session?.user && (
                    <div className="flex items-center gap-3 px-3 py-2">
                        {session.user.image ? (
                            <Image src={session.user.image} alt="" width={24} height={24} className="rounded-full flex-shrink-0" />
                        ) : (
                            <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                                <span className="text-[10px] font-bold text-primary-foreground">
                                    {session.user.name?.[0]?.toUpperCase() || 'U'}
                                </span>
                            </div>
                        )}
                        {!collapsed && (
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate">{session.user.name}</p>
                                <p className="text-[10px] text-muted-foreground truncate">{session.user.email}</p>
                            </div>
                        )}
                        {!collapsed && (
                            <button
                                onClick={() => signOut({ callbackUrl: '/sign-in' })}
                                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                                title="Sign out"
                            >
                                <LogOut className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                )}

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

                {/* Reset to System Button */}
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

// ─── MenuSection Component ───────────────────────────────

function MenuSection({
    group,
    expanded,
    collapsed,
    pathname,
    onToggle,
}: {
    group: MenuGroup;
    expanded: boolean;
    collapsed: boolean;
    pathname: string;
    onToggle: () => void;
}) {
    const groupActive = isGroupActive(group, pathname);
    const GroupIcon = group.icon;

    return (
        <div>
            {/* Group header */}
            <button
                onClick={onToggle}
                className={cn(
                    'w-full flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors',
                    'hover:bg-muted/50 text-muted-foreground/50 hover:text-muted-foreground/70',
                    groupActive && 'text-muted-foreground/70',
                )}
                title={collapsed ? group.label : undefined}
            >
                {collapsed ? (
                    <GroupIcon className="w-4 h-4 flex-shrink-0 mx-auto" />
                ) : (
                    <>
                        <ChevronDown
                            className={cn(
                                'w-3 h-3 flex-shrink-0 transition-transform duration-200',
                                !expanded && '-rotate-90'
                            )}
                        />
                        <span className="text-[11px] font-semibold uppercase tracking-wider">
                            {group.label}
                        </span>
                    </>
                )}
            </button>

            {/* Group items */}
            {expanded && (
                <div className="space-y-0.5 mt-0.5">
                    {group.items.map((item) => {
                        const isActive = isItemActive(item.href, pathname);
                        const Icon = item.icon;

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                                    isActive
                                        ? 'bg-primary text-primary-foreground'
                                        : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                                )}
                                title={collapsed ? item.title : undefined}
                            >
                                <Icon className="w-4 h-4 flex-shrink-0" />
                                {!collapsed && (
                                    <span className={cn(
                                        'text-sm',
                                        isActive ? 'font-medium' : ''
                                    )}>
                                        {item.title}
                                    </span>
                                )}
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
