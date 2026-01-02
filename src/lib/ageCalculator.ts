/**
 * Age Calculator Utility
 * Calculates age from date of birth
 * Returns age in Years, Months, and Days format
 */

/**
 * Calculate age from date of birth
 * @param dob - Date of birth (Date object or string)
 * @returns Object with years, months, days, and formatted string
 */
export function calculateAge(dob: Date | string): {
    years: number;
    months: number;
    days: number;
    formatted: string;
    ageInYears: number;
} {
    const birthDate = typeof dob === 'string' ? new Date(dob) : dob;
    const today = new Date();

    let years = today.getFullYear() - birthDate.getFullYear();
    let months = today.getMonth() - birthDate.getMonth();
    let days = today.getDate() - birthDate.getDate();

    // Adjust for negative days
    if (days < 0) {
        months--;
        const lastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
        days += lastMonth.getDate();
    }

    // Adjust for negative months
    if (months < 0) {
        years--;
        months += 12;
    }

    // Format age string
    let formatted = '';
    if (years > 0) {
        formatted = `${years} Year${years > 1 ? 's' : ''}`;
        if (months > 0) {
            formatted += ` ${months} Month${months > 1 ? 's' : ''}`;
        }
    } else if (months > 0) {
        formatted = `${months} Month${months > 1 ? 's' : ''}`;
        if (days > 0) {
            formatted += ` ${days} Day${days > 1 ? 's' : ''}`;
        }
    } else {
        formatted = `${days} Day${days > 1 ? 's' : ''}`;
    }

    return {
        years,
        months,
        days,
        formatted,
        ageInYears: years
    };
}

/**
 * Get age in years only (for simple display)
 */
export function getAgeInYears(dob: Date | string): number {
    const birthDate = typeof dob === 'string' ? new Date(dob) : dob;
    const today = new Date();

    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }

    return age;
}

/**
 * Validate date of birth
 * @param dob - Date of birth to validate
 * @returns true if valid, false otherwise
 */
export function isValidDOB(dob: Date | string): boolean {
    const birthDate = typeof dob === 'string' ? new Date(dob) : dob;
    const today = new Date();

    // Check if date is valid
    if (isNaN(birthDate.getTime())) {
        return false;
    }

    // Check if date is not in future
    if (birthDate > today) {
        return false;
    }

    // Check if age is reasonable (not more than 150 years)
    const age = getAgeInYears(birthDate);
    if (age > 150) {
        return false;
    }

    return true;
}

/**
 * Get age category
 * @param dob - Date of birth
 * @returns Age category string
 */
export function getAgeCategory(dob: Date | string): string {
    const age = getAgeInYears(dob);

    if (age < 1) return 'Infant';
    if (age < 13) return 'Child';
    if (age < 20) return 'Teenager';
    if (age < 60) return 'Adult';
    return 'Senior';
}

/**
 * Format DOB for display
 * @param dob - Date of birth
 * @returns Formatted date string
 */
export function formatDOB(dob: Date | string): string {
    const birthDate = typeof dob === 'string' ? new Date(dob) : dob;

    return birthDate.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

/**
 * Get age for form input (backward compatibility)
 * Returns age in years as number
 */
export function getAgeForForm(dob: Date | string | null): number {
    if (!dob) return 0;
    return getAgeInYears(dob);
}
