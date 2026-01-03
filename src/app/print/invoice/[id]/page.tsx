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
        @page { 
            margin: 0 0 12mm 0; 
            size: A4; 
        }
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            background: #f8fafc; 
            padding: 0;
            margin: 0;
            color: #1e293b;
        }
        .invoice-container { 
            width: 210mm; /* A4 Width */
            min-height: 297mm;
            margin: 0 auto; 
            background: white; 
            padding: 0;
            display: flex;
            flex-direction: column;
        }
        
        .header {
            background: ${theme.gradient};
            color: white;
            padding: 15px 25px;
            position: relative;
            display: flex;
            align-items: center;
        }
        .rainbow-bar {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 3px;
            background: linear-gradient(90deg, #fbbf24, #f97316, #ef4444, #ec4899);
        }
        
        /* Left Logo */
        .header-logo-container {
            flex: 0 0 80px;
            display: flex;
            align-items: center;
            justify-content: flex-start;
        }
        .header-logo { 
            width: 65px; 
            height: 65px; 
            object-fit: contain; 
        }

        /* Center: Brand Info */
        .header-center {
            flex: 1;
            text-align: center;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
        }
        .header-center h1 { 
            font-size: 20px; 
            font-weight: 900; 
            margin-bottom: 2px; 
            text-transform: uppercase; 
            letter-spacing: 0.5px;
        }
        .header-center p.tagline { 
            font-size: 10px; 
            opacity: 0.95; 
            margin-bottom: 2px; 
            font-style: italic; 
        }
        .header-center .contact-details { 
            font-size: 8.5px; 
            opacity: 0.9; 
            line-height: 1.3; 
        }

        /* Right: Invoice Info */
        .header-right {
            flex: 0 0 150px; 
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            justify-content: center;
        }
        .invoice-title {
            font-size: 20px;
            font-weight: 900;
            margin-bottom: 2px;
            letter-spacing: 1px;
            text-shadow: 0 1px 2px rgba(0,0,0,0.1);
        }
        .invoice-number {
            font-size: 11px;
            font-weight: 600;
            background: rgba(255,255,255,0.2);
            padding: 4px 10px;
            border-radius: 4px;
            display: inline-block;
        }

        .content {
            padding: 15px 25px;
            flex: 1;
        }
        
        .info-section {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 20px;
            padding-bottom: 20px;
            border-bottom: 1px solid #e2e8f0;
        }
        .info-box {
            padding: 12px 15px;
            border-radius: 6px;
            border: 1px solid #e2e8f0;
            background: #fff;
        }
        .info-box h3 {
            font-size: 10px;
            text-transform: uppercase;
            color: #64748b;
            font-weight: 700;
            margin-bottom: 8px;
            letter-spacing: 0.5px;
        }
        .info-box p {
            font-size: 13px;
            margin-bottom: 4px;
            line-height: 1.4;
        }

        .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }
        .items-table thead {
            background: ${theme.gradient};
            color: white;
        }
        .items-table th {
            padding: 10px 12px;
            text-align: left;
            font-size: 12px;
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
        .items-table td {
            padding: 8px 12px;
            font-size: 13px;
        }
        .items-table tbody tr:last-child {
            border-bottom: 2px solid #1e293b;
        }
        .item-name {
            font-weight: 600;
        }

        .totals-section {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 20px;
        }
        .totals-box {
            width: 300px;
            border-radius: 6px;
            padding: 10px 15px;
            border: 1px solid #e2e8f0;
        }
        .total-row {
            display: flex;
            justify-content: space-between;
            padding: 6px 0;
            font-size: 13px;
        }
        .total-row.subtotal {
            border-bottom: 1px solid #e2e8f0;
        }
        .total-row.discount {
            color: #10b981;
            font-weight: 600;
        }
        .total-row.grand-total {
            border-top: 1px solid #1e293b;
            padding-top: 10px;
            margin-top: 5px;
            font-size: 16px;
            font-weight: 800;
            color: #1e293b;
        }
        .total-row.paid {
            color: #0369a1;
            font-weight: 600;
        }
        .total-row.due {
            color: #b91c1c;
            font-weight: 700;
            font-size: 14px;
        }

        .payment-info {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 12px 15px;
            margin-bottom: 20px;
        }
        .payment-info h3 {
            font-size: 11px;
            font-weight: 700;
            color: #64748b;
            margin-bottom: 8px;
            text-transform: uppercase;
        }
        .payment-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
        }
        .payment-item {
            display: flex;
            justify-content: space-between;
            font-size: 13px;
        }

        .footer {
            margin-top: auto;
            padding: 15px 25px 25px 25px;
        }
        .signature-section {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 15px;
        }
        .signature-box {
            text-align: center;
            border-top: 1px solid #1e293b;
            padding-top: 8px;
            min-width: 180px;
        }
        .signature-box p {
            font-weight: 700;
            color: #1e293b;
            font-size: 12px;
        }
        .footer-bottom {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-top: 1px solid #e2e8f0;
            padding-top: 10px;
            font-size: 11px;
            color: #64748b;
        }
        .footer-bottom p {
            margin: 0;
            font-size: 10px;
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
            <!-- Left: Logo -->
            <div class="header-logo-container">
                ${branding.logoUrl ? `<img src="${branding.logoUrl}" class="header-logo" alt="Logo">` : ''}
            </div>

            <!-- Center: Brand Info -->
            <div class="header-center">
                <h1>${branding.labName || 'Spotnet MedOS'}</h1>
                <p class="tagline">${branding.tagline || 'Professional Healthcare Services'}</p>
                <div class="contact-details">
                    ${branding.address ? `<p>${branding.address}</p>` : ''}
                    <p>
                        ${branding.contact ? `📞 ${branding.contact}` : ''}
                        ${branding.contact && branding.email ? ' | ' : ''}
                        ${branding.email ? `✉️ ${branding.email}` : ''}
                    </p>
                    ${branding.gstin ? `<p>GSTIN: ${branding.gstin}</p>` : ''}
                </div>
            </div>

            <!-- Right: Invoice Info -->
            <div class="header-right">
                <div class="invoice-title">INVOICE</div>
                <div class="invoice-number">#${invoiceData.invoiceNumber}</div>
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
            <div class="signature-section">
                <div class="signature-box">
                    <p>Authorized Signatory</p>
                    <p style="font-size: 10px; font-weight: 400; margin-top: 2px;">${branding.director || 'Lab Director'}</p>
                </div>
            </div>
            <div class="footer-bottom">
                <p>Thank you for choosing ${branding.labName || 'Spotnet MedOS'}!</p>
                <p>Generated on ${new Date().toLocaleDateString('en-IN')} ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
                <p>Computer-generated invoice.</p>
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
