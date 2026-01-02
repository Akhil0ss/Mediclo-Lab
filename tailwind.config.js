/** @type {import('tailwindcss').Config} */
module.exports = {
    important: true,
    content: [
        './src/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['var(--font-inter)', 'Segoe UI', 'Tahoma', 'Geneva', 'Verdana', 'sans-serif'],
            },
            colors: {
                // Theme colors using CSS variables
                theme: {
                    primary: 'var(--color-primary)',
                    secondary: 'var(--color-secondary)',
                    accent: 'var(--color-accent)',
                    background: 'var(--color-background)',
                    surface: 'var(--color-surface)',
                    text: 'var(--color-text)',
                    'text-secondary': 'var(--color-text-secondary)',
                    border: 'var(--color-border)',
                    success: 'var(--color-success)',
                    warning: 'var(--color-warning)',
                    error: 'var(--color-error)',
                    info: 'var(--color-info)',
                },
            },
            backgroundColor: {
                // Override default white/gray with theme
                'DEFAULT': 'var(--color-background)',
            },
            textColor: {
                // Override default text colors
                'DEFAULT': 'var(--color-text)',
            },
            borderColor: {
                'DEFAULT': 'var(--color-border)',
            },
            backgroundImage: {
                'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
                'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
                // Theme gradients
                'gradient-theme': 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%)',
            },
        },
    },
    plugins: [],
}
