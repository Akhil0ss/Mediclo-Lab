'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { ref, get } from 'firebase/database';
import { database } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';

export default function PrintInvoicePage() {
    const params = useParams();
    const { user, userProfile } = useAuth();
    const [invoiceData, setInvoiceData] = useState<any>(null);
    const [branding, setBranding] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const printTriggeredRef = useRef(false);

    const invoiceId = params.id as string;

    useEffect(() => {
        if (!invoiceId) return;

        const fetchData = async () => {
            try {
                // If user is logged in, use their ownerId
                const ownerId = userProfile?.ownerId || user?.uid;
                if (!ownerId) {
                    console.error('No owner found');
                    setLoading(false);
                    return;
                }

                // Fetch Invoice
                const invoiceSnapshot = await get(ref(database, `billing/${ownerId}/${invoiceId}`));
                const data = invoiceSnapshot.val();

                if (!data) {
                    console.error('Invoice not found');
                    setLoading(false);
                    return;
                }

                // Fetch Branding
                const brandingSnapshot = await get(ref(database, `branding/${ownerId}`));
                const brandingData = brandingSnapshot.val() || {};

                setInvoiceData(data);
                setBranding(brandingData);
                setLoading(false);
            } catch (error) {
                console.error('Error fetching invoice:', error);
                setLoading(false);
            }
        };

        fetchData();
    }, [invoiceId, user, userProfile]);

    useEffect(() => {
        if (loading || !invoiceData || !branding) return;
        if (printTriggeredRef.current) return;

        printTriggeredRef.current = true;

        const selectedTheme = branding.pdfTheme || 'blue';
        const themes: any = {
            blue: { primary: '#2563eb', secondary: '#1e40af', gradient: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)' },
            green: { primary: '#10b981', secondary: '#059669', gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' },
            purple: { primary: '#8b5cf6', secondary: '#7c3aed', gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' }
        };
        const theme = themes[selectedTheme] || themes.blue;

        const fullHtml = `<!DOCTYPE html>
<html>
<head>
    <title>Invoice - ${invoiceData.invoiceNumber}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @page { 
            margin: 0mm 0mm 10px 0mm; 
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
            width: 210mm; 
            min-height: 296mm;
            margin: 0 auto; 
            background: white; 
            padding: 0;
            position: relative;
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
        .header-logo { width: 70px; height: 70px; object-fit: contain; background: white; border-radius: 8px; padding: 4px; }

        /* Center Brand */
        .header-center {
            flex: 1;
            text-align: center;
            padding: 0 20px;
        }
        .header-center h1 { font-size: 24px; font-weight: 800; margin-bottom: 2px; }
        .header-center .tagline { font-size: 10px; opacity: 0.9; font-style: italic; }
        .header-center .contact-details { font-size: 9px; opacity: 0.8; margin-top: 4px; line-height: 1.3; }

        /* Right Invoice Info */
        .header-right { flex: 0 0 160px; text-align: right; }
        .invoice-title { font-size: 20px; font-weight: 900; letter-spacing: 2px; }
        .invoice-number { font-size: 11px; opacity: 0.9; margin-top: 2px; }

        .content { padding: 30px 40px; flex: 1; }

        .info-section { display: flex; justify-content: space-between; margin-bottom: 30px; }
        .info-box h3 { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
        .info-box p { font-size: 13px; line-height: 1.5; color: #1e293b; }

        .items-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        .items-table th { background: #f8fafc; padding: 12px 15px; text-align: left; font-size: 11px; font-weight: 700; color: #64748b; border-bottom: 2px solid #e2e8f0; text-transform: uppercase; }
        .items-table td { padding: 12px 15px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
        .item-name { font-weight: 600; color: #1e293b; }

        .totals-section { display: flex; justify-content: flex-end; }
        .totals-box { width: 250px; }
        .total-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 13px; }
        .total-row.grand-total { border-top: 2px solid #e2e8f0; margin-top: 10px; padding-top: 10px; font-size: 16px; font-weight: 800; color: ${theme.primary}; }
        .total-row.due { color: #ef4444; font-weight: 700; }

        .payment-info { margin-top: 40px; border-top: 1px solid #f1f5f9; padding-top: 20px; }
        .payment-info h3 { font-size: 12px; font-weight: 700; color: #64748b; margin-bottom: 10px; }
        .payment-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }
        .payment-item { font-size: 12px; }
        .payment-item span { color: #64748b; }

        .footer {
            margin-top: auto;
            padding: 15px 25px 25px 25px;
        }
        .signature-section {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 20px;
        }
        .signature-box {
            text-align: center;
            width: 150px;
            padding-top: 10px;
            border-top: 1px solid #1e293b;
        }
        .signature-box p { font-size: 11px; font-weight: 700; margin-top: 5px; }
        
        .footer-bottom { 
            text-align: center; 
            padding-top: 15px;
            border-top: 1px solid #f1f5f9;
            font-size: 11px; 
            color: #94a3b8; 
            display: flex; 
            justify-content: space-between; 
        }

        /* Last Section Docking */
        .last-section {
            margin-top: auto; /* Push to bottom in flex container */
            background: white;
        }

        @media print {
            body { background: white; margin: 0; padding: 0; }
            .invoice-container { 
                box-shadow: none; 
                width: 100%; 
                border-radius: 0; 
                min-height: 285mm; 
                margin-top: 0; 
            }
            .no-print { display: none !important; }
            thead { display: table-header-group; }
            tfoot { display: table-footer-group; }
        }

        .print-btn { position: fixed; bottom: 20px; right: 20px; background: ${theme.gradient}; color: white; padding: 12px 24px; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 700; box-shadow: 0 4px 15px rgba(0,0,0,0.2); z-index: 1000; }
        .print-btn:hover { transform: translateY(-2px); }
    </style>
</head>
<body>
    <div class="invoice-container">
        <table style="width: 100%; border-collapse: collapse;">
            <thead style="display: table-header-group;">
                <tr>
                    <td>
                        <div class="header">
                            <div class="rainbow-bar"></div>
                            <div class="header-logo-container">
                                ${branding.logoUrl ? `<img src="${branding.logoUrl}" class="header-logo" alt="Logo">` : ''}
                            </div>
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
                                </div>
                            </div>
                            <div class="header-right">
                                <div class="invoice-title">INVOICE</div>
                                <div class="invoice-number">#${invoiceData.invoiceNumber}</div>
                            </div>
                        </div>
                    </td>
                </tr>
            </thead>

            <!-- Spacer for intermediate pages -->
            <tfoot style="display: table-footer-group;">
                <tr><td><div style="height: 10px;"></div></td></tr>
            </tfoot>

            <tbody>
                <tr>
                    <td>
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
                        </div>
                    </td>
                </tr>
            </tbody>
        </table>

        <!-- THE LAST SECTION (Pushed to bottom by margin-top: auto) -->
        <div class="last-section">
            <div style="padding: 0 40px;">
                <div class="totals-section" style="margin-top: 20px;">
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

                <div class="payment-info" style="margin-top: 20px;">
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

                <div class="signature-section" style="margin-top: 30px; display: flex; justify-content: flex-end; margin-bottom: 20px;">
                    <div class="signature-box" style="text-align: center; width: 150px; border-top: 1px solid #1e293b; padding-top: 5px;">
                        <p style="font-size: 11px; font-weight: 700;">Authorized Signatory</p>
                        <p style="font-size: 10px; font-weight: 400; margin-top: 2px;">${branding.director || 'Lab Director'}</p>
                    </div>
                </div>
            </div>

            <div class="footer-bottom" style="text-align: center; padding: 15px 25px; border-top: 1px solid #f1f5f9; font-size: 11px; color: #94a3b8; display: flex; justify-content: space-between;">
                <p>Thank you for choosing ${branding.labName || 'Spotnet MedOS'}!</p>
                <p>Generated on ${new Date().toLocaleDateString('en-IN')} ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
                <p>Computer-generated invoice.</p>
            </div>
        </div>
    </div>

    <button onclick="window.print()" class="print-btn no-print">🖨️ Print / Save PDF</button>
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
                    <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600 font-semibold">Generating Invoice...</p>
                </div>
            </div>
        );
    }

    return null;
}
