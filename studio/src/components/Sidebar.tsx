'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    MapPin, ChevronLeft, ChevronRight, ChevronDown,
    Database, Calendar, Clapperboard, Sun, Moon, Monitor,
    LogOut, Users as UsersIcon, Share2, ArrowRightLeft,
    TrendingUp, Rss, Settings, Shield, BookOpen, Radio, Swords, Library, BarChart3, Target, Star,
    Play, Wand2, Sparkles, Video, Building2,
    type LucideIcon,
} from 'lucide-react';
import { useState, useCallback } from 'react';
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
        id: 'tiktok',
        label: 'TikTok Crawling',
        icon: Video,
        items: [
            {
                title: 'TikTok Radar',
                description: 'Daily buzz & sentiment',
                href: '/tiktok/explorer',
                icon: Play,
                adminOnly: false,
            },
            {
                title: 'Exhibitor Archive',
                description: 'XXI, CGV, Cinépolis timeline',
                href: '/tiktok/exhibitors',
                icon: Building2,
                adminOnly: false,
            },
            {
                title: 'Pipeline Workflow',
                description: 'Daily processing & AI graph',
                href: '/tiktok/workflow',
                icon: Sparkles,
                adminOnly: false,
            },
        ],
    },
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
    {
        id: 'cinepoint',
        label: 'CinePoint Intelligence',
        icon: Swords,
        items: [
            {
                title: 'Competitor Data',
                description: 'Raw tweets & snapshots',
                href: '/competitors',
                icon: Radio,
                adminOnly: false,
            },
            {
                title: 'Catalog',
                description: 'Movie database sync',
                href: '/competitors/cinepoint',
                icon: Library,
                adminOnly: false,
            },
            {
                title: 'Insights',
                description: 'Daily box office intelligence',
                href: '/competitors/cinepoint/insights',
                icon: BarChart3,
                adminOnly: false,
            },
            {
                title: 'Success Predictor',
                description: 'What makes a movie succeed?',
                href: '/competitors/cinepoint/analysis',
                icon: Target,
                adminOnly: false,
            },
            {
                title: 'Actor Database',
                description: 'Star power rankings',
                href: '/competitors/cinepoint/analysis/actors',
                icon: Star,
                adminOnly: false,
            },
            {
                title: 'Director Database',
                description: 'Director performance',
                href: '/competitors/cinepoint/analysis/directors',
                icon: Clapperboard,
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
const SIDEBAR_COLLAPSED_KEY = 'cineradar-sidebar-collapsed';

function loadSidebarCollapsed(): boolean {
    if (typeof window === 'undefined') return false;
    try {
        const raw = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
        if (raw !== null) return JSON.parse(raw);
    } catch { /* ignore */ }
    return false;
}

function saveSidebarCollapsed(collapsed: boolean) {
    try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, JSON.stringify(collapsed));
    } catch { /* ignore */ }
}

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
    // Exact-match routes (don't match sub-paths)
    const exactRoutes = ['/social-feed/settings'];
    if (exactRoutes.includes(href)) return pathname === href;

    // Prefix match: href must match pathname exactly or as a path prefix
    return pathname === href || pathname.startsWith(href + '/');
}

/**
 * Find the most specific (longest) matching href for the current pathname.
 * Used to highlight only the most specific menu item.
 */
function findMostSpecificActive(items: MenuItem[], pathname: string): string | null {
    let best: string | null = null;
    for (const item of items) {
        if (isItemActive(item.href, pathname)) {
            if (!best || item.href.length > best.length) best = item.href;
        }
    }
    return best;
}

/** Check if any item in a group is active */
function isGroupActive(group: MenuGroup, pathname: string): boolean {
    return group.items.some(item => isItemActive(item.href, pathname));
}

// ─── Component ───────────────────────────────────────────

export function Sidebar() {
    const pathname = usePathname();
    const { darkMode, toggleDarkMode, followsSystem, resetToSystem } = useDarkModeContext();
    const { data: session } = useSession();
    const isAdmin = (session as unknown as { user?: { role?: string } })?.user?.role === 'admin';

    const [collapsed, setCollapsed] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false;
        return document.documentElement.classList.contains('sidebar-collapsed') || loadSidebarCollapsed();
    });

    const toggleCollapsed = useCallback(() => {
        setCollapsed(prev => {
            const next = !prev;
            saveSidebarCollapsed(next);
            if (typeof document !== 'undefined') {
                document.documentElement.classList.toggle('sidebar-collapsed', next);
            }
            return next;
        });
    }, []);

    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
        if (typeof window === 'undefined') return new Set();
        return loadCollapsedGroups();
    });

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
            data-sidebar="cineradar-sidebar"
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
                        <p className="text-sm text-muted-foreground">Intelligence Dashboard</p>
                    </div>
                )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
                {/* Standalone items (pinned at top) */}
                {standaloneItems.map((item) => {
                    const isActive = item.href === findMostSpecificActive(standaloneItems, pathname);
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
                                        'text-sm',
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
                        mostSpecificActive={findMostSpecificActive(group.items, pathname)}
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
                        mostSpecificActive={findMostSpecificActive(visibleAdminItems, pathname)}
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
                                <span className="text-sm font-bold text-primary-foreground">
                                    {session.user.name?.[0]?.toUpperCase() || 'U'}
                                </span>
                            </div>
                        )}
                        {!collapsed && (
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{session.user.name}</p>
                                <p className="text-sm text-muted-foreground truncate">{session.user.email}</p>
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
                        <span className="text-sm">
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
                            <span className="text-sm">Auto</span>
                        )}
                    </button>
                )}

                {/* Collapse Button */}
                <button
                    onClick={toggleCollapsed}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                    {collapsed ? (
                        <ChevronRight className="w-4 h-4" />
                    ) : (
                        <>
                            <ChevronLeft className="w-4 h-4" />
                            <span className="text-sm">Collapse</span>
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
    mostSpecificActive,
}: {
    group: MenuGroup;
    expanded: boolean;
    collapsed: boolean;
    pathname: string;
    onToggle: () => void;
    mostSpecificActive: string | null;
}) {
    const groupActive = isGroupActive(group, pathname);
    const GroupIcon = group.icon;

    return (
        <div>
            {/* Group header */}
            <button
                onClick={onToggle}
                className={cn(
                    'w-full flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-left',
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
                        <span className="text-sm font-semibold uppercase tracking-wider text-left truncate">
                            {group.label}
                        </span>
                    </>
                )}
            </button>

            {/* Group items */}
            {expanded && (
                <div className="space-y-0.5 mt-0.5">
                    {group.items.map((item) => {
                        const isActive = item.href === mostSpecificActive;
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
