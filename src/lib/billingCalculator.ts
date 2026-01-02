/**
 * Billing Calculator Utility
 * Handles billing calculations, GST, discounts, and invoice generation
 */

export interface BillingItem {
    id: string;
    name: string;
    quantity: number;
    rate: number;
    amount: number;
}

export interface BillingData {
    items: BillingItem[];
    subtotal: number;
    discount: number;
    discountPercent: number;
    taxableAmount: number;
    gst: number;
    gstPercent: number;
    total: number;
    paid: number;
    due: number;
    paymentMode?: string;
}

/**
 * Calculate billing totals
 * @param items - Array of billing items
 * @param discountPercent - Discount percentage (0-100)
 * @param gstPercent - GST percentage (default: 18)
 * @param paid - Amount paid
 * @returns Complete billing data
 */
export function calculateBilling(
    items: BillingItem[],
    discountPercent: number = 0,
    gstPercent: number = 18,
    paid: number = 0
): BillingData {
    // Calculate subtotal
    const subtotal = items.reduce((sum, item) => sum + item.amount, 0);

    // Calculate discount
    const discount = (subtotal * discountPercent) / 100;

    // Calculate taxable amount
    const taxableAmount = subtotal - discount;

    // Calculate GST
    const gst = (taxableAmount * gstPercent) / 100;

    // Calculate total
    const total = taxableAmount + gst;

    // Calculate due
    const due = total - paid;

    return {
        items,
        subtotal: Math.round(subtotal * 100) / 100,
        discount: Math.round(discount * 100) / 100,
        discountPercent,
        taxableAmount: Math.round(taxableAmount * 100) / 100,
        gst: Math.round(gst * 100) / 100,
        gstPercent,
        total: Math.round(total * 100) / 100,
        paid: Math.round(paid * 100) / 100,
        due: Math.round(due * 100) / 100
    };
}

/**
 * Create billing item
 * @param name - Item name
 * @param quantity - Quantity
 * @param rate - Rate per unit
 * @returns Billing item
 */
export function createBillingItem(
    name: string,
    quantity: number,
    rate: number
): BillingItem {
    return {
        id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name,
        quantity,
        rate,
        amount: Math.round(quantity * rate * 100) / 100
    };
}

/**
 * Format currency
 * @param amount - Amount to format
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2
    }).format(amount);
}

/**
 * Get payment status
 * @param total - Total amount
 * @param paid - Paid amount
 * @returns Payment status
 */
export function getPaymentStatus(total: number, paid: number): 'paid' | 'partial' | 'unpaid' {
    if (paid >= total) return 'paid';
    if (paid > 0) return 'partial';
    return 'unpaid';
}

/**
 * Calculate split payment
 * @param total - Total amount
 * @param payments - Array of payment amounts
 * @returns Remaining amount
 */
export function calculateSplitPayment(total: number, payments: number[]): number {
    const totalPaid = payments.reduce((sum, payment) => sum + payment, 0);
    return Math.max(0, total - totalPaid);
}

/**
 * Generate invoice number
 * @param prefix - Invoice prefix (default: INV)
 * @param sequence - Sequence number
 * @returns Invoice number
 */
export function generateInvoiceNumber(prefix: string = 'INV', sequence: number): string {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const seq = String(sequence).padStart(4, '0');

    return `${prefix}-${year}${month}-${seq}`;
}

/**
 * Validate billing data
 * @param data - Billing data to validate
 * @returns Validation result
 */
export function validateBilling(data: BillingData): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (data.items.length === 0) {
        errors.push('At least one item is required');
    }

    if (data.subtotal <= 0) {
        errors.push('Subtotal must be greater than 0');
    }

    if (data.discountPercent < 0 || data.discountPercent > 100) {
        errors.push('Discount must be between 0 and 100');
    }

    if (data.paid < 0) {
        errors.push('Paid amount cannot be negative');
    }

    if (data.paid > data.total) {
        errors.push('Paid amount cannot exceed total');
    }

    return {
        valid: errors.length === 0,
        errors
    };
}
