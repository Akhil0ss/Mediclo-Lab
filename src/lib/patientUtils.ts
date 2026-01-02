/**
 * Generate a random password for patient accounts
 * Format: 6 characters with mix of letters and numbers
 */
export function generatePatientPassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 6; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}

/**
 * Generate username for patient
 * Format: PAT{mobile} or PAT{last10digits}
 */
export function generatePatientUsername(mobile: string): string {
    // Remove any non-digit characters
    const digits = mobile.replace(/\D/g, '');
    // Take last 10 digits
    const last10 = digits.slice(-10);
    return `PAT${last10}`;
}

/**
 * Hash password for storage (simple hash - in production use bcrypt)
 */
export function hashPassword(password: string): string {
    // Simple hash for demo - in production use proper hashing
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
        const char = password.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
}
