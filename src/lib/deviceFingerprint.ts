/**
 * Device Fingerprinting Utility
 * Generates a unique device ID based on browser and system characteristics
 * Used for single-device login security
 */

export function generateDeviceFingerprint(): string {
    if (typeof window === 'undefined') {
        return 'server-side';
    }

    const components = [
        // Browser info
        navigator.userAgent,
        navigator.language,
        navigator.platform,

        // Screen info
        screen.width,
        screen.height,
        screen.colorDepth,

        // Timezone
        new Date().getTimezoneOffset(),

        // Hardware concurrency (CPU cores)
        navigator.hardwareConcurrency || 0,

        // Device memory (if available)
        (navigator as any).deviceMemory || 0,
    ];

    // Create a simple hash
    const fingerprint = components.join('|');
    return simpleHash(fingerprint);
}

/**
 * Simple hash function for fingerprinting
 */
function simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
}

/**
 * Get a human-readable device name
 */
export function getDeviceName(): string {
    if (typeof window === 'undefined') {
        return 'Unknown Device';
    }

    const ua = navigator.userAgent;

    // Detect OS
    let os = 'Unknown OS';
    if (ua.indexOf('Win') !== -1) os = 'Windows';
    else if (ua.indexOf('Mac') !== -1) os = 'MacOS';
    else if (ua.indexOf('Linux') !== -1) os = 'Linux';
    else if (ua.indexOf('Android') !== -1) os = 'Android';
    else if (ua.indexOf('iOS') !== -1) os = 'iOS';

    // Detect Browser
    let browser = 'Unknown Browser';
    if (ua.indexOf('Chrome') !== -1) browser = 'Chrome';
    else if (ua.indexOf('Firefox') !== -1) browser = 'Firefox';
    else if (ua.indexOf('Safari') !== -1) browser = 'Safari';
    else if (ua.indexOf('Edge') !== -1) browser = 'Edge';

    return `${browser} on ${os}`;
}
