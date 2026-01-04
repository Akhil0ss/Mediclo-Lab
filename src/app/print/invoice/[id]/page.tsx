'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { ref, get } from 'firebase/database';
import { database } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';

function InvoiceContent() {
    const params = useParams();
    const searchParams = useSearchParams();
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
                // 1. Check URL for instant data
                const urlData = searchParams.get('data');
                let initialData = null;
                if (urlData) {
                    try {
                        const decoded = JSON.parse(decodeURIComponent(urlData));
                        if (decoded.invoiceNumber === invoiceId) {
                            initialData = decoded;
                            setInvoiceData(decoded);
                        }
                    } catch (e) {
                        console.error("Error parsing URL invoice data:", e);
                    }
                }

                // 2. Resolve Owner
                const queryOwnerId = searchParams.get('ownerId');
                const sessionOwnerId = userProfile?.ownerId || user?.uid;
                const ownerId = queryOwnerId || sessionOwnerId;

                if (!ownerId) {
                    if (!initialData) {
                        console.error('No owner found');
                    }
                    setLoading(false);
                    return;
                }

                // 3. Fetch Branding
                const brandingSnapshot = await get(ref(database, `branding/${ownerId}`));
                const brandingData = brandingSnapshot.val() || {};
                setBranding(brandingData);

                // 4. Fetch from DB if needed
                if (!initialData) {
                    let data = null;
                    const paths = [`invoices/${ownerId}`, `billing/${ownerId}`];
                    for (const path of paths) {
                        const snap = await get(ref(database, path));
                        if (snap.exists()) {
                            // Invoices are pushed with auto-ID usually, so we search children
                            snap.forEach(child => {
                                const val = child.val();
                                if (val.invoiceNumber === invoiceId || child.key === invoiceId) {
                                    data = val;
                                }
                            });
                        }
                        if (data) break;
                    }
                    if (data) setInvoiceData(data);
                }

                setLoading(false);
            } catch (error) {
                console.error('Error fetching invoice:', error);
                setLoading(false);
            }
        };

        fetchData();
    }, [invoiceId, user, userProfile, searchParams]);

    // Cleanup printTriggeredRef when invoiceId changes
    useEffect(() => {
        printTriggeredRef.current = false;
    }, [invoiceId]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen no-print">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600 font-semibold">Generating Invoice...</p>
                </div>
            </div>
        );
    }

    if (!invoiceData || !branding) {
        return (
            <div className="flex items-center justify-center min-h-screen no-print">
                <div className="text-center bg-white p-8 rounded-xl shadow-lg border border-red-100">
                    <i className="fas fa-exclamation-triangle text-red-500 text-5xl mb-4"></i>
                    <h2 className="text-2xl font-bold text-gray-800">Invoice Not Found</h2>
                    <p className="text-gray-500 mt-2">Could not find the invoice details. Please check the URL or try again.</p>
                </div>
            </div>
        );
    }

    // Theme Configuration
    const selectedTheme = branding.pdfTheme || 'blue';
    const themes: any = {
        blue: { primary: '#2563eb', secondary: '#1e40af', gradient: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)' },
        green: { primary: '#10b981', secondary: '#059669', gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' },
        purple: { primary: '#8b5cf6', secondary: '#7c3aed', gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' }
    };
    const theme = themes[selectedTheme] || themes.blue;

    return (
        <>
            {/* Print-Specific Styles for Darker Output */}
            <style jsx global>{`
                @media print {
                    * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                        color-adjust: exact !important;
                    }
                    
                    @page {
                        margin: 0;
                        size: A4;
                    }
                    
                    body {
                        margin: 0;
                        padding: 0;
                        background: white !important;
                        color: #000 !important;
                    }
                    
                    .no-print {
                        display: none !important;
                    }
                    
                    .invoice-container {
                        width: 100% !important;
                        height: 297mm !important;
                        margin: 0 !important;
                        box-shadow: none !important;
                        position: absolute;
                        top: 0;
                        left: 0;
                    }
                    
                    header {
                        print-color-adjust: exact;
                        -webkit-print-color-adjust: exact;
                    }
                    
                    /* Darker text */
                    p, span, div, td, th {
                        color: #000 !important;
                    }
                    
                    /* Stronger borders */
                    .border, [class*="border-"] {
                        border-color: #333 !important;
                        border-width: 1px !important;
                    }
                    
                    /* Table borders darker */
                    table, th, td {
                        border-color: #333 !important;
                    }
                    
                    /* Darker backgrounds */
                    .bg-gray-50, .bg-gray-100 {
                        background-color: #e5e5e5 !important;
                    }
                    
                    /* Ensure gradients print */
                    [style*="gradient"] {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    
                    /* Darker text colors */
                    .text-gray-600 {
                        color: #333 !important;
                    }
                    
                    .text-gray-700 {
                        color: #222 !important;
                    }
                    
                    .text-gray-800, .text-gray-900 {
                        color: #000 !important;
                    }
                    
                    /* Font weight for better visibility */
                    .font-medium {
                        font-weight: 600 !important;
                    }
                    
                    .font-semibold {
                        font-weight: 700 !important;
                    }
                }
            `}</style>

            <div className="min-h-screen bg-gray-100 py-0 sm:py-10 print:bg-white print:py-0">
                {/* Action Bar (Hidden when printing) */}
                <div className="max-w-[210mm] mx-auto mb-4 flex justify-between items-center no-print px-4 sm:px-0">
                    <button
                        onClick={() => window.close()}
                        className="bg-white text-gray-700 px-4 py-2 rounded-lg shadow-sm border font-bold hover:bg-gray-50 transition"
                    >
                        <i className="fas fa-arrow-left mr-2"></i> Back
                    </button>
                    <button
                        onClick={() => window.print()}
                        className="bg-blue-600 text-white px-6 py-2 rounded-lg shadow-md font-bold hover:bg-blue-700 transition"
                    >
                        <i className="fas fa-print mr-2"></i> Print Invoice
                    </button>
                </div>

                {/* Invoice Container - Forced A4 Size */}
                <div className="invoice-container bg-white mx-auto shadow-2xl relative flex flex-col overflow-hidden w-[210mm] min-h-[297mm] print:shadow-none print:w-full print:min-h-screen">

                    {/* Header Section */}
                    <header className="relative bg-white text-white overflow-hidden" style={{ background: theme.gradient }}>
                        {/* Rainbow Strip */}
                        <div className="h-1 w-full bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500" />

                        <div className="px-8 py-6 flex items-center justify-between gap-6">
                            {/* 1. Logo */}
                            <div className="flex-shrink-0 w-24 h-24 bg-white rounded-xl p-2 flex items-center justify-center shadow-inner">
                                {branding.logoUrl ? (
                                    <img src={branding.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
                                ) : (
                                    <i className="fas fa-microscope text-blue-600 text-4xl"></i>
                                )}
                            </div>

                            {/* 2. Brand Identity */}
                            <div className="flex-1 text-center">
                                <h1 className="text-2xl font-extrabold uppercase tracking-tight">{branding.labName || 'Mediclo Lab'}</h1>
                                <p className="text-xs font-medium italic opacity-90 mt-0.5">{branding.tagline || 'Leading Excellence in Diagnostics'}</p>
                                <div className="mt-3 text-[10px] space-y-0.5 opacity-80 font-medium">
                                    {branding.address && <p>{branding.address}</p>}
                                    <p>
                                        {branding.contact && <span>📞 {branding.contact}</span>}
                                        {branding.contact && branding.email && <span className="mx-2">|</span>}
                                        {branding.email && <span>✉️ {branding.email}</span>}
                                    </p>
                                </div>
                            </div>

                            {/* 3. Invoice Badge */}
                            <div className="text-right flex-shrink-0">
                                <div className="inline-block bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2 border border-white/30">
                                    <p className="text-[10px] font-black tracking-[0.2em] uppercase opacity-80 mb-0.5">Tax Invoice</p>
                                    <p className="text-xl font-black">#{invoiceData.invoiceNumber}</p>
                                </div>
                            </div>
                        </div>
                    </header>

                    <main className="flex-1 p-10 flex flex-col">
                        {/* Patient & Invoice Metadata */}
                        <section className="flex justify-between items-start mb-10 pb-6 border-b border-gray-100">
                            <div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Billed To</p>
                                <h2 className="text-lg font-bold text-gray-800">{invoiceData.patientName}</h2>
                                <p className="text-xs text-gray-500 mt-1 font-semibold">Patient ID: <span className="text-blue-600">#{invoiceData.patientId?.slice(-6) || 'N/A'}</span></p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Invoice Info</p>
                                <div className="space-y-1">
                                    <p className="text-xs font-bold text-gray-700">Date: <span className="font-normal">{new Date(invoiceData.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span></p>
                                    <p className="text-xs font-bold text-gray-700">Time: <span className="font-normal">{new Date(invoiceData.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span></p>
                                </div>
                            </div>
                        </section>

                        {/* Items Table */}
                        <section className="flex-1">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 text-gray-500 text-[10px] font-black uppercase tracking-widest border-y border-gray-200">
                                        <th className="px-4 py-3 text-left">Description of Services</th>
                                        <th className="px-4 py-3 text-center w-24">Quantity</th>
                                        <th className="px-4 py-3 text-right w-32">Rate (₹)</th>
                                        <th className="px-4 py-3 text-right w-32">Amount (₹)</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm">
                                    {(invoiceData.items || []).map((item: any, idx: number) => (
                                        <tr key={idx} className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors">
                                            <td className="px-4 py-4 font-bold text-gray-800">{item.name}</td>
                                            <td className="px-4 py-4 text-center text-gray-600">{item.quantity}</td>
                                            <td className="px-4 py-4 text-right text-gray-600">{item.rate.toFixed(2)}</td>
                                            <td className="px-4 py-4 text-right font-black text-gray-900">{item.amount.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </section>

                        {/* Totals & Payments Section */}
                        <section className="mt-10 pt-6 border-t-2 border-gray-100 flex justify-between items-start gap-10">
                            {/* Payment Details */}
                            <div className="bg-gray-50 rounded-xl p-6 flex-1 max-w-sm">
                                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Payment Summary</h3>
                                <div className="grid grid-cols-2 gap-y-3 text-xs">
                                    <span className="text-gray-500 font-semibold">Mode:</span>
                                    <span className="font-black text-right text-gray-800">{invoiceData.paymentMode}</span>

                                    <span className="text-gray-500 font-semibold">Status:</span>
                                    <span className={`font-black text-right uppercase ${invoiceData.due > 0 ? 'text-red-500' : 'text-green-600'}`}>
                                        {invoiceData.due > 0 ? 'Partial Payment' : 'Fully Paid'}
                                    </span>
                                </div>
                                {invoiceData.due > 0 && (
                                    <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg">
                                        <p className="text-[10px] text-red-600 font-bold text-center">Balance of ₹{invoiceData.due.toFixed(2)} is pending.</p>
                                    </div>
                                )}
                            </div>

                            {/* Calculation Box */}
                            <div className="w-72 space-y-2">
                                <div className="flex justify-between text-sm text-gray-600 font-semibold">
                                    <span>Subtotal:</span>
                                    <span>₹{invoiceData.subtotal.toFixed(2)}</span>
                                </div>
                                {invoiceData.discount > 0 && (
                                    <div className="flex justify-between text-sm text-green-600 font-semibold">
                                        <span>Discount ({invoiceData.discountPercent}%):</span>
                                        <span>- ₹{invoiceData.discount.toFixed(2)}</span>
                                    </div>
                                )}
                                {invoiceData.gst > 0 && (
                                    <div className="flex justify-between text-sm text-gray-600 font-semibold">
                                        <span>GST ({invoiceData.gstPercent}%):</span>
                                        <span>₹{invoiceData.gst.toFixed(2)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center pt-3 border-t-2 border-gray-200 mt-2">
                                    <span className="text-base font-black text-gray-800">Grand Total:</span>
                                    <span className="text-2xl font-black" style={{ color: theme.primary }}>₹{invoiceData.total.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm font-bold pt-2 text-blue-600">
                                    <span>Amount Paid:</span>
                                    <span>₹{invoiceData.paid.toFixed(2)}</span>
                                </div>
                                {invoiceData.due > 0 && (
                                    <div className="flex justify-between text-sm font-bold text-red-500">
                                        <span>Balance Due:</span>
                                        <span>₹{invoiceData.due.toFixed(2)}</span>
                                    </div>
                                )}
                            </div>
                        </section>
                    </main>

                    {/* Footer Section */}
                    <footer className="mt-auto border-t border-gray-100 bg-white">
                        <div className="px-10 py-8 flex items-end justify-between">
                            {/* Thank You Note */}
                            <div className="max-w-xs">
                                <p className="text-xs text-gray-400 italic font-medium leading-relaxed">
                                    * Thank you for choosing {branding.labName}. This is a computer-generated invoice and doesn't require a physical signature.
                                </p>
                            </div>

                            {/* Signature */}
                            <div className="text-center w-48">
                                <div className="h-14 flex items-center justify-center italic text-gray-400 opacity-50 text-xs">
                                    {branding.director ? `Seal of ${branding.director}` : 'Authorized Signatory'}
                                </div>
                                <div className="pt-2 border-t border-gray-300 font-black text-[11px] uppercase tracking-wider text-gray-700">
                                    Authorized Signatory
                                </div>
                                <p className="text-[9px] text-gray-500 mt-1 font-bold">{branding.director || 'Lab Director'}</p>
                            </div>
                        </div>

                        {/* Bottom Identity Bar */}
                        <div className="py-3 px-8 text-center text-[9px] font-black text-gray-400 uppercase tracking-widest border-t border-gray-50 bg-gray-50/50">
                            Generated via Mediclo MedOS • {new Date().toLocaleDateString('en-IN')} {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                    </footer>
                </div>
            </div>
        </>
    );
}

export default function PrintInvoicePage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-screen">
                <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        }>
            <InvoiceContent />
        </Suspense>
    );
}
