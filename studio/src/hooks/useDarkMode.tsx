'use client';

/**
 * useDarkMode - Context-based dark mode with localStorage persistence
 * Follows system preference by default, allows manual override
 * 
 * Usage:
 *   1. Wrap your app in <DarkModeProvider> at the top level
 *   2. Use useDarkModeContext() in any component to access theme state
 */

import { createContext, useContext, ReactNode, useState, useEffect, useCallback } from 'react';

interface DarkModeContextValue {
    darkMode: boolean;
    toggleDarkMode: () => void;
    setDarkMode: (mode: boolean) => void;
    followsSystem: boolean;
    resetToSystem: () => void;
}

const DarkModeContext = createContext<DarkModeContextValue | null>(null);

const STORAGE_KEY = 'cineradar-dark-mode';

/**
 * Get the system's preferred color scheme
 */
function getSystemPreference(): boolean {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Get initial dark mode value and whether it came from storage
 */
function getInitialValue(): { mode: boolean; fromStorage: boolean } {
    if (typeof window === 'undefined') {
        return { mode: false, fromStorage: false };
    }
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
        return { mode: stored === 'true', fromStorage: true };
    }
    // No stored preference - use system preference as default
    return { mode: getSystemPreference(), fromStorage: false };
}

/**
 * Provider component that owns the dark mode state
 * Wrap this at the top of your app (e.g., in layout.tsx)
 */
export function DarkModeProvider({ children }: { children: ReactNode }) {
    const [initialState] = useState(() => getInitialValue());
    const [darkMode, setDarkModeState] = useState(initialState.mode);
    const [followsSystem, setFollowsSystem] = useState(!initialState.fromStorage);

    // Apply dark mode class to document
    useEffect(() => {
        document.documentElement.classList.toggle('dark', darkMode);
    }, [darkMode]);

    // Listen for system theme changes (only when following system)
    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

        const handleChange = (e: MediaQueryListEvent) => {
            // Only auto-switch if user hasn't set a manual preference
            if (followsSystem) {
                setDarkModeState(e.matches);
            }
        };

        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, [followsSystem]);

    const setDarkMode = useCallback((mode: boolean) => {
        setDarkModeState(mode);
        localStorage.setItem(STORAGE_KEY, String(mode));
        setFollowsSystem(false); // User has set a manual preference
    }, []);

    const toggleDarkMode = useCallback(() => {
        setDarkMode(!darkMode);
    }, [darkMode, setDarkMode]);

    const resetToSystem = useCallback(() => {
        localStorage.removeItem(STORAGE_KEY);
        setFollowsSystem(true);
        setDarkModeState(getSystemPreference());
    }, []);

    return (
        <DarkModeContext.Provider value={{ darkMode, toggleDarkMode, setDarkMode, followsSystem, resetToSystem }}>
            {children}
        </DarkModeContext.Provider>
    );
}

/**
 * Hook to access dark mode context
 * Must be used within a DarkModeProvider
 */
export function useDarkModeContext(): DarkModeContextValue {
    const context = useContext(DarkModeContext);
    if (!context) {
        throw new Error('useDarkModeContext must be used within DarkModeProvider');
    }
    return context;
}

export default useDarkModeContext;
