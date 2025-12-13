'use client';

/**
 * useDarkMode - Custom hook for dark mode with localStorage persistence
 * Following Single Responsibility Principle
 */

import { useState, useEffect, useCallback } from 'react';

interface UseDarkModeReturn {
    darkMode: boolean;
    toggleDarkMode: () => void;
    setDarkMode: (mode: boolean) => void;
}

const STORAGE_KEY = 'cineradar-dark-mode';

function getInitialValue(defaultValue: boolean): boolean {
    if (typeof window === 'undefined') return defaultValue;
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored !== null ? stored === 'true' : defaultValue;
}

export function useDarkMode(defaultValue = false): UseDarkModeReturn {
    const [darkMode, setDarkModeState] = useState(() => getInitialValue(defaultValue));

    // Apply dark mode class to document
    useEffect(() => {
        document.documentElement.classList.toggle('dark', darkMode);
    }, [darkMode]);

    const setDarkMode = useCallback((mode: boolean) => {
        setDarkModeState(mode);
        localStorage.setItem(STORAGE_KEY, String(mode));
    }, []);

    const toggleDarkMode = useCallback(() => {
        setDarkMode(!darkMode);
    }, [darkMode, setDarkMode]);

    return { darkMode, toggleDarkMode, setDarkMode };
}

export default useDarkMode;
