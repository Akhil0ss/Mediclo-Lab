/**
 * Theme Configuration
 * 10 Professional Medical Themes with High Contrast
 */

export interface Theme {
    id: string;
    name: string;
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    success: string;
    warning: string;
    error: string;
    info: string;
}

export const themes: Theme[] = [
    {
        id: 'ocean-blue',
        name: 'Ocean Blue',
        primary: '#0891b2', // Cyan 600
        secondary: '#0284c7', // Sky 600
        accent: '#3b82f6', // Blue 500
        background: '#f0f9ff', // Sky 50
        surface: '#ffffff',
        text: '#0c4a6e', // Sky 900
        textSecondary: '#475569', // Slate 600
        border: '#bae6fd', // Sky 200
        success: '#059669',
        warning: '#d97706',
        error: '#dc2626',
        info: '#0284c7'
    },
    {
        id: 'medical-green',
        name: 'Medical Green',
        primary: '#059669', // Emerald 600
        secondary: '#10b981', // Emerald 500
        accent: '#14b8a6', // Teal 500
        background: '#f0fdf4', // Green 50
        surface: '#ffffff',
        text: '#064e3b', // Emerald 900
        textSecondary: '#475569',
        border: '#bbf7d0', // Green 200
        success: '#059669',
        warning: '#d97706',
        error: '#dc2626',
        info: '#0891b2'
    },
    {
        id: 'royal-purple',
        name: 'Royal Purple',
        primary: '#7c3aed', // Violet 600
        secondary: '#8b5cf6', // Violet 500
        accent: '#a855f7', // Purple 500
        background: '#faf5ff', // Purple 50
        surface: '#ffffff',
        text: '#4c1d95', // Violet 900
        textSecondary: '#475569',
        border: '#e9d5ff', // Purple 200
        success: '#059669',
        warning: '#d97706',
        error: '#dc2626',
        info: '#7c3aed'
    },
    {
        id: 'sunset-orange',
        name: 'Sunset Orange',
        primary: '#ea580c', // Orange 600
        secondary: '#f97316', // Orange 500
        accent: '#fb923c', // Orange 400
        background: '#fff7ed', // Orange 50
        surface: '#ffffff',
        text: '#7c2d12', // Orange 900
        textSecondary: '#475569',
        border: '#fed7aa', // Orange 200
        success: '#059669',
        warning: '#d97706',
        error: '#dc2626',
        info: '#0891b2'
    },
    {
        id: 'rose-pink',
        name: 'Rose Pink',
        primary: '#e11d48', // Rose 600
        secondary: '#f43f5e', // Rose 500
        accent: '#fb7185', // Rose 400
        background: '#fff1f2', // Rose 50
        surface: '#ffffff',
        text: '#881337', // Rose 900
        textSecondary: '#475569',
        border: '#fecdd3', // Rose 200
        success: '#059669',
        warning: '#d97706',
        error: '#dc2626',
        info: '#e11d48'
    },
    {
        id: 'midnight-blue',
        name: 'Midnight Blue',
        primary: '#1e40af', // Blue 700
        secondary: '#2563eb', // Blue 600
        accent: '#3b82f6', // Blue 500
        background: '#eff6ff', // Blue 50
        surface: '#ffffff',
        text: '#1e3a8a', // Blue 900
        textSecondary: '#475569',
        border: '#bfdbfe', // Blue 200
        success: '#059669',
        warning: '#d97706',
        error: '#dc2626',
        info: '#2563eb'
    },
    {
        id: 'forest-green',
        name: 'Forest Green',
        primary: '#15803d', // Green 700
        secondary: '#16a34a', // Green 600
        accent: '#22c55e', // Green 500
        background: '#f0fdf4', // Green 50
        surface: '#ffffff',
        text: '#14532d', // Green 900
        textSecondary: '#475569',
        border: '#bbf7d0', // Green 200
        success: '#059669',
        warning: '#d97706',
        error: '#dc2626',
        info: '#0891b2'
    },
    {
        id: 'slate-gray',
        name: 'Slate Gray',
        primary: '#475569', // Slate 600
        secondary: '#64748b', // Slate 500
        accent: '#94a3b8', // Slate 400
        background: '#f8fafc', // Slate 50
        surface: '#ffffff',
        text: '#0f172a', // Slate 900
        textSecondary: '#475569',
        border: '#cbd5e1', // Slate 300
        success: '#059669',
        warning: '#d97706',
        error: '#dc2626',
        info: '#475569'
    },
    {
        id: 'amber-gold',
        name: 'Amber Gold',
        primary: '#d97706', // Amber 600
        secondary: '#f59e0b', // Amber 500
        accent: '#fbbf24', // Amber 400
        background: '#fffbeb', // Amber 50
        surface: '#ffffff',
        text: '#78350f', // Amber 900
        textSecondary: '#475569',
        border: '#fde68a', // Amber 200
        success: '#059669',
        warning: '#d97706',
        error: '#dc2626',
        info: '#d97706'
    },
    {
        id: 'indigo-night',
        name: 'Indigo Night',
        primary: '#4f46e5', // Indigo 600
        secondary: '#6366f1', // Indigo 500
        accent: '#818cf8', // Indigo 400
        background: '#eef2ff', // Indigo 50
        surface: '#ffffff',
        text: '#312e81', // Indigo 900
        textSecondary: '#475569',
        border: '#c7d2fe', // Indigo 200
        success: '#059669',
        warning: '#d97706',
        error: '#dc2626',
        info: '#4f46e5'
    }
];

export const defaultTheme = themes[0]; // Ocean Blue
