'use client';

import { useSearchParams } from 'next/navigation';
import { formatCurrency } from '@/lib/billingCalculator';
import { useEffect, useState, useRef } from 'react';
import { ref, get } from 'firebase/database';
import { database } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';

export default function InvoicePrintPage() {
    const searchParams = useSearchParams();
    const { user, userProfile } = useAuth();
    const [invoiceData, setInvoiceData] = useState<any>(null);
    const [branding, setBranding] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const printTriggeredRef = useRef(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const data = searchParams.get('data');
                if (data) {
                    const invoice = JSON.parse(decodeURIComponent(data));
                    setInvoiceData(invoice);
                }

                // Fetch branding
                let ownerId = userProfile?.ownerId || user?.uid;
                if (ownerId) {
                    const brandingSnapshot = await get(ref(database, `branding/${ownerId}`));
                    const brandingData = brandingSnapshot.val() || {};
                    setBranding(brandingData);
                }

                setLoading(false);
            } catch (error) {
                console.error('Error loading invoice:', error);
                setLoading(false);
            }
        };

        fetchData();
    }, [searchParams, user, userProfile]);

    // Generate HTML and replace document
    useEffect(() => {
        if (loading || !invoiceData || !branding) return;
        if (printTriggeredRef.current) return;

        printTriggeredRef.current = true;

        const theme = {
            primary: '#3b82f6',
            gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        };

        const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invoice ${invoiceData.invoiceNumber}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            background: #f8fafc; 
            padding: 20px;
            color: #1e293b;
        }
        .invoice-container { 
            max-width: 900px; 
            margin: 0 auto; 
            background: white; 
            box-shadow: 0 4px 20px rgba(0,0,0,0.1); 
            border-radius: 12px;
            overflow: hidden;
        }
        
        .header {
            background: ${theme.gradient};
            color: white;
            padding: 30px 40px;
            position: relative;
        }
        .rainbow-bar {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 4px;
            background: linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899, #f59e0b, #10b981);
        }
        .header-content {
            display: flex;
            justify-content: space-between;
            align-items: start;
        }
        .lab-info h1 {
            font-size: 28px;
            font-weight: 800;
            margin-bottom: 5px;
        }
        .lab-info p {
            font-size: 13px;
            opacity: 0.9;
            line-height: 1.6;
        }
        .invoice-meta {
            text-align: right;
        }
        .invoice-title {
            font-size: 32px;
            font-weight: 900;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
        }
        .invoice-number {
            font-size: 16px;
            font-weight: 600;
            background: rgba(255,255,255,0.2);
            padding: 8px 16px;
            border-radius: 6px;
            display: inline-block;
        }

        .content {
            padding: 40px;
        }
        
        .info-section {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin-bottom: 30px;
            padding-bottom: 30px;
            border-bottom: 2px solid #e2e8f0;
        }
        .info-box {
            background: #f8fafc;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid ${theme.primary};
        }
        .info-box h3 {
            font-size: 12px;
            text-transform: uppercase;
            color: #64748b;
            font-weight: 700;
            margin-bottom: 12px;
            letter-spacing: 0.5px;
        }
        .info-box p {
            font-size: 15px;
            margin-bottom: 6px;
        }

        .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
        }
        .items-table thead {
            background: ${theme.gradient};
            color: white;
        }
        .items-table th {
            padding: 14px 12px;
            text-align: left;
            font-size: 13px;
            font-weight: 700;
            text-transform: uppercase;
        }
        .items-table th:last-child,
        .items-table td:last-child {
            text-align: right;
        }
        .items-table tbody tr {
            border-bottom: 1px solid #e2e8f0;
        }
        .items-table tbody tr:hover {
            background: #f8fafc;
        }
        .items-table td {
            padding: 14px 12px;
            font-size: 14px;
        }
        .item-name {
            font-weight: 600;
        }

        .totals-section {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 30px;
        }
        .totals-box {
            width: 350px;
            background: #f8fafc;
            border-radius: 8px;
            padding: 20px;
        }
        .total-row {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            font-size: 14px;
        }
        .total-row.subtotal {
            border-bottom: 1px solid #e2e8f0;
        }
        .total-row.discount {
            color: #10b981;
            font-weight: 600;
        }
        .total-row.grand-total {
            border-top: 2px solid ${theme.primary};
            padding-top: 15px;
            margin-top: 10px;
            font-size: 18px;
            font-weight: 800;
            color: ${theme.primary};
        }
        .total-row.paid {
            color: #3b82f6;
            font-weight: 600;
        }
        .total-row.due {
            color: #ef4444;
            font-weight: 700;
            font-size: 16px;
        }

        .payment-info {
            background: #eff6ff;
            border: 2px dashed ${theme.primary};
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 30px;
        }
        .payment-info h3 {
            font-size: 14px;
            font-weight: 700;
            color: ${theme.primary};
            margin-bottom: 10px;
            text-transform: uppercase;
        }
        .payment-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
        }
        .payment-item {
            display: flex;
            justify-content: space-between;
            font-size: 14px;
        }

        .footer {
            background: #f8fafc;
            padding: 25px 40px;
            border-top: 2px solid #e2e8f0;
            text-align: center;
        }
        .footer p {
            font-size: 12px;
            color: #64748b;
            margin-bottom: 5px;
        }
        .footer .signature {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #1e293b;
            display: inline-block;
            min-width: 250px;
        }
        .footer .signature p {
            font-weight: 700;
            color: #1e293b;
        }

        @media print {
            body { padding: 0; background: white; }
            .invoice-container { box-shadow: none; border-radius: 0; }
            .no-print { display: none !important; }
        }

        .print-btn { 
            position: fixed; 
            bottom: 20px; 
            right: 20px; 
            background: ${theme.gradient}; 
            color: white; 
            padding: 14px 28px; 
            border: none; 
            border-radius: 8px; 
            cursor: pointer; 
            font-size: 14px; 
            font-weight: 700; 
            box-shadow: 0 4px 15px rgba(0,0,0,0.2); 
            z-index: 1000;
        }
        .print-btn:hover { transform: translateY(-2px); }
    </style>
</head>
<body>
    <div class="invoice-container">
        <div class="header">
            <div class="rainbow-bar"></div>
            <div class="header-content">
                <div class="lab-info">
                    <h1>${branding.labName || 'Spotnet MedOS'}</h1>
                    <p>${branding.tagline || 'Professional Healthcare Services'}</p>
                    ${branding.address ? `<p>${branding.address}</p>` : ''}
                    ${branding.city || branding.state || branding.pincode ? `<p>${[branding.city, branding.state, branding.pincode].filter(Boolean).join(', ')}</p>` : ''}
                    <p>
                        ${branding.contact ? `📞 ${branding.contact}` : ''}
                        ${branding.contact && branding.email ? ' | ' : ''}
                        ${branding.email ? `✉️ ${branding.email}` : ''}
                    </p>
                    ${branding.gstin ? `<p>GSTIN: ${branding.gstin}</p>` : ''}
                </div>
                <div class="invoice-meta">
                    <div class="invoice-title">INVOICE</div>
                    <div class="invoice-number">#${invoiceData.invoiceNumber}</div>
                </div>
            </div>
        </div>

        <div class="content">
            <div class="info-section">
                <div class="info-box">
                    <h3>Bill To</h3>
                    <p><strong>${invoiceData.patientName}</strong></p>
                    <p>Patient ID: ${invoiceData.patientId || 'N/A'}</p>
                </div>
                <div class="info-box">
                    <h3>Invoice Details</h3>
                    <p><strong>Date:</strong> ${new Date(invoiceData.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                    <p><strong>Time:</strong> ${new Date(invoiceData.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
            </div>

            <table class="items-table">
                <thead>
                    <tr>
                        <th>Description</th>
                        <th style="text-align: center; width: 80px;">Qty</th>
                        <th style="text-align: right; width: 120px;">Rate</th>
                        <th style="text-align: right; width: 120px;">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${invoiceData.items.map((item: any) => `
                        <tr>
                            <td class="item-name">${item.name}</td>
                            <td style="text-align: center;">${item.quantity}</td>
                            <td style="text-align: right;">₹${item.rate.toFixed(2)}</td>
                            <td style="text-align: right; font-weight: 600;">₹${item.amount.toFixed(2)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <div class="totals-section">
                <div class="totals-box">
                    <div class="total-row subtotal">
                        <span>Subtotal</span>
                        <span>₹${invoiceData.subtotal.toFixed(2)}</span>
                    </div>
                    ${invoiceData.discount > 0 ? `
                        <div class="total-row discount">
                            <span>Discount (${invoiceData.discountPercent}%)</span>
                            <span>- ₹${invoiceData.discount.toFixed(2)}</span>
                        </div>
                    ` : ''}
                    ${invoiceData.includeGST && invoiceData.gst > 0 ? `
                        <div class="total-row">
                            <span>GST (${invoiceData.gstPercent}%)</span>
                            <span>₹${invoiceData.gst.toFixed(2)}</span>
                        </div>
                    ` : ''}
                    <div class="total-row grand-total">
                        <span>TOTAL</span>
                        <span>₹${invoiceData.total.toFixed(2)}</span>
                    </div>
                    <div class="total-row paid">
                        <span>Paid (${invoiceData.paymentMode})</span>
                        <span>₹${invoiceData.paid.toFixed(2)}</span>
                    </div>
                    ${invoiceData.due > 0 ? `
                        <div class="total-row due">
                            <span>BALANCE DUE</span>
                            <span>₹${invoiceData.due.toFixed(2)}</span>
                        </div>
                    ` : ''}
                </div>
            </div>

            <div class="payment-info">
                <h3>💳 Payment Information</h3>
                <div class="payment-grid">
                    <div class="payment-item">
                        <span>Payment Mode:</span>
                        <strong>${invoiceData.paymentMode}</strong>
                    </div>
                    <div class="payment-item">
                        <span>Payment Status:</span>
                        <strong style="color: ${invoiceData.due > 0 ? '#ef4444' : '#10b981'}">
                            ${invoiceData.due > 0 ? 'PARTIAL' : 'PAID'}
                        </strong>
                    </div>
                </div>
            </div>
        </div>

        <div class="footer">
            <p>Thank you for choosing ${branding.labName || 'Spotnet MedOS'}!</p>
            <p style="font-size: 11px; margin-top: 10px;">This is a computer-generated invoice and does not require a signature.</p>
            <div class="signature">
                <p>Authorized Signatory</p>
                <p style="font-size: 11px; margin-top: 5px;">${branding.director || 'Lab Director'}</p>
            </div>
        </div>
    </div>

    <button onclick="window.print()" class="print-btn no-print">
        🖨️ Print Invoice
    </button>
</body>
</html>`;

        document.open();
        document.write(fullHtml);
        document.close();

    }, [loading, invoiceData, branding]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600 font-semibold">Generating Invoice...</p>
                </div>
            </div>
        );
    }

    return null;
}
