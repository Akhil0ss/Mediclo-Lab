// User management utilities for multi-user system

import { ref, get } from 'firebase/database';
import { database } from './firebase';
import bcrypt from 'bcryptjs';

/**
 * Generate a unique brand prefix for usernames.
 * Format: [First4Chars] or [First4Chars][Number] if collision exists.
 * Examples: "spot", "spot1", "spot2", "medi", "medi1"
 * 
 * @param labName - The lab/brand name
 * @returns A unique prefix (lowercase, alphanumeric only)
 */
export async function generateUniqueBrandPrefix(labName: string): Promise<string> {
    // Clean and get first 4 characters
    const basePrefix = labName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .substring(0, 4)
        .padEnd(4, 'x'); // Pad with 'x' if less than 4 chars

    let prefix = basePrefix;
    let isUnique = false;
    let attempts = 0;

    // Check availability in prefixes node
    while (!isUnique && attempts < 10) {
        const potentialPrefix = attempts === 0 ? prefix : `${prefix}${Math.floor(100 + Math.random() * 900)}`;
        const prefixRef = ref(database, `prefixes/${potentialPrefix}`);
        const snapshot = await get(prefixRef);
        
        if (!snapshot.exists()) {
            prefix = potentialPrefix;
            isUnique = true;
        }
        attempts++;
    }

    return prefix;
}

/**
 * Generate username based on lab name (or brand prefix) and role (ALL LOWERCASE)
 * Format: {prefix}@{role}
 * Examples: spot@receptionist, spot1@lab, spot2@pharmacy, medi@drjohn
 */
export function generateUsername(
    labNameOrPrefix: string,
    role: 'doctor' | 'pharmacy' | 'receptionist' | 'lab',
    name?: string
): string {
    // If already a clean prefix (no spaces, lowercase), use as-is
    // Otherwise, clean it up (first 4 chars)
    const prefix = labNameOrPrefix.length <= 6 && !labNameOrPrefix.includes(' ')
        ? labNameOrPrefix.toLowerCase()
        : labNameOrPrefix.substring(0, 4).toLowerCase().replace(/\s+/g, '').padEnd(4, 'x');

    switch (role) {
        case 'doctor':
            const doctorName = name?.toLowerCase().replace(/\s+/g, '').replace(/[^a-z]/g, '') || 'doctor';
            return `${prefix}@dr${doctorName}`;
        case 'lab':
            return `${prefix}@lab`;
        case 'pharmacy':
            return `${prefix}@pharmacy`;
        case 'receptionist':
            return `${prefix}@admin`;
        default:
            return `${prefix}@user`;
    }
}

/**
 * Generate patient username based on mobile and brand
 * Format: {first4chars}@{mobile}
 * Example: spot@9876543210
 */
export function generatePatientUsername(mobile: string, brandName: string): string {
    const brand = brandName.substring(0, 4).toLowerCase().replace(/\s+/g, '').padEnd(4, 'x');
    return `${brand}@${mobile}`;
}


/**
 * Generate a STRONG random password (12 characters)
 * Includes: uppercase, lowercase, numbers, special characters
 * Example: Sp0t@Lab#2024
 */
export function generatePassword(): string {
    const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lowercase = 'abcdefghjkmnpqrstuvwxyz';
    const numbers = '23456789';
    const special = '!@#$%^&*';

    let password = '';

    // Ensure at least one of each type
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += special[Math.floor(Math.random() * special.length)];

    // Fill remaining 8 characters randomly
    const allChars = uppercase + lowercase + numbers + special;
    for (let i = 0; i < 8; i++) {
        password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
}

/**
 * Hash a password using bcryptjs (saltRounds=12)
 * Industry-standard, brute-force resistant
 */
export function hashPassword(password: string): string {
    const salt = bcrypt.genSaltSync(12);
    return bcrypt.hashSync(password, salt);
}

/**
 * Legacy DJB2 hash — only used for detecting old-format hashes
 * DO NOT use for new passwords
 */
function legacyDJB2Hash(password: string): string {
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
        const char = password.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
}

/**
 * Verify password against hash — backward compatible
 * Supports both old DJB2 hashes and new bcrypt hashes
 * Old hashes: short alphanumeric string (e.g. "1z5b4a2")
 * New hashes: start with "$2b$" (bcrypt format)
 */
export function verifyPassword(password: string, hash: string): boolean {
    if (!hash) return false;
    // Detect bcrypt hash by its prefix
    if (hash.startsWith('$2b$') || hash.startsWith('$2a$')) {
        return bcrypt.compareSync(password, hash);
    }
    // Fallback: legacy DJB2 comparison for old hashes
    return legacyDJB2Hash(password) === hash;
}

/**
 * User role type
 */
export type UserRole = 'receptionist' | 'doctor' | 'pharmacy' | 'lab';

/**
 * Staff user interface
 */
export interface StaffUser {
    id?: string;
    username: string;
    passwordHash: string;
    role: UserRole;
    name: string;
    email?: string;
    doctorId?: string; // if role is doctor
    isActive: boolean;
    createdAt: string;
    createdBy: string;
    lastLogin?: string;
}
