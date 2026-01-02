'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Theme, themes, defaultTheme } from '@/lib/themes';

interface ThemeContextType {
    currentTheme: Theme;
    setTheme: (themeId: string) => void;
    availableThemes: Theme[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [currentTheme, setCurrentTheme] = useState<Theme>(defaultTheme);
    const [mounted, setMounted] = useState(false);

    // Load theme from localStorage on mount (client-side only)
    useEffect(() => {
        setMounted(true);

        if (typeof window !== 'undefined') {
            const savedThemeId = localStorage.getItem('mediclo-theme');
            if (savedThemeId) {
                const theme = themes.find(t => t.id === savedThemeId);
                if (theme) {
                    setCurrentTheme(theme);
                    applyTheme(theme);
                    console.log('✅ Theme loaded from localStorage:', theme.name);
                } else {
                    applyTheme(defaultTheme);
                    console.log('✅ Default theme applied');
                }
            } else {
                applyTheme(defaultTheme);
                console.log('✅ Default theme applied (no saved theme)');
            }
        }
    }, []);

    const setTheme = (themeId: string) => {
        const theme = themes.find(t => t.id === themeId);
        if (theme) {
            setCurrentTheme(theme);
            if (typeof window !== 'undefined') {
                localStorage.setItem('mediclo-theme', themeId);
            }
            applyTheme(theme);
            console.log('✅ Theme changed to:', theme.name);
        }
    };

    const applyTheme = (theme: Theme) => {
        if (typeof window === 'undefined') return;

        const root = document.documentElement;
        root.style.setProperty('--color-primary', theme.primary);
        root.style.setProperty('--color-secondary', theme.secondary);
        root.style.setProperty('--color-accent', theme.accent);
        root.style.setProperty('--color-background', theme.background);
        root.style.setProperty('--color-surface', theme.surface);
        root.style.setProperty('--color-text', theme.text);
        root.style.setProperty('--color-text-secondary', theme.textSecondary);
        root.style.setProperty('--color-border', theme.border);
        root.style.setProperty('--color-success', theme.success);
        root.style.setProperty('--color-warning', theme.warning);
        root.style.setProperty('--color-error', theme.error);
        root.style.setProperty('--color-info', theme.info);

        console.log('🎨 Theme CSS variables applied:', {
            primary: theme.primary,
            background: theme.background,
            text: theme.text
        });
    };

    // Don't render children until mounted to avoid hydration mismatch
    if (!mounted) {
        return <>{children}</>;
    }

    return (
        <ThemeContext.Provider value={{ currentTheme, setTheme, availableThemes: themes }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}
