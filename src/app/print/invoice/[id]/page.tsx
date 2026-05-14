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

                // 3. Initialize Branding instantly from cache
                try {
                    const bCached = localStorage.getItem(`global_branding_${ownerId}`);
                    if (bCached) setBranding(JSON.parse(bCached));
                } catch(e) {}

                // Fetch fresh branding asynchronously
                get(ref(database, `branding/${ownerId}`))
                    .then(snap => {
                        if (snap.exists()) setBranding(snap.val());
                    })
                    .catch(() => {});

                // 4. Fetch from DB if needed
                if (!initialData) {
                    let data = null;
                    
                    try {
                        const cached = localStorage.getItem(`print_cache_invoice_${invoiceId}`);
                        if (cached) {
                            data = JSON.parse(cached);
                        }
                    } catch (e) {}

                    if (!data) {
                        const paths = [`invoices/${ownerId}`, `billing/${ownerId}`];
                        for (const path of paths) {
                            const snap = await get(ref(database, path));
                            if (snap.exists()) {
                                snap.forEach(child => {
                                    const val = child.val();
                                    if (val.invoiceNumber === invoiceId || child.key === invoiceId) {
                                        data = val;
                                    }
                                });
                            }
                            if (data) break;
                        }
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
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
                
                @media print {
                    * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                        color-adjust: exact !important;
                        font-family: 'Inter', sans-serif !important;
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
                    }
                    
                    p, span, div, td, th {
                        color: #000 !important;
                    }
                    
                    .text-blue-600 {
                        color: ${theme.primary} !important;
                    }

                    .border, [class*="border-"] {
                        border-color: #000 !important;
                        border-width: 1.5px !important;
                    }

                    .border-2 {
                        border-width: 2.5px !important;
                        border-color: #000 !important;
                    }
                    
                    .bg-slate-50 {
                        background-color: #f8fafc !important;
                    }

                    .bg-slate-900 {
                        background-color: #f1f5f9 !important;
                        border: 2px solid #000 !important;
                    }

                    .bg-slate-900 * {
                        color: #000 !important;
                    }
                }
            `}</style>

            <div className="min-h-screen bg-slate-50 py-0 sm:py-10 print:bg-white print:py-0 font-['Inter']">
                {/* Action Bar */}
                <div className="max-w-[210mm] mx-auto mb-6 flex justify-between items-center no-print px-4 sm:px-0 animate-in fade-in slide-in-from-top-4 duration-700">
                    <button
                        onClick={() => window.close()}
                        className="bg-white text-slate-700 px-5 py-2.5 rounded-xl shadow-sm border border-slate-200 font-bold hover:bg-slate-50 transition active:scale-95 flex items-center gap-2"
                    >
                        <i className="fas fa-arrow-left text-sm"></i> Back
                    </button>
                    <button
                        onClick={() => window.print()}
                        className="bg-slate-900 text-white px-8 py-2.5 rounded-xl shadow-lg font-bold hover:bg-slate-800 transition active:scale-95 flex items-center gap-2"
                    >
                        <i className="fas fa-print text-sm"></i> Print Invoice
                    </button>
                </div>

                {/* Boxed Invoice Container */}
                <div className="invoice-container bg-white mx-auto shadow-2xl relative flex flex-col overflow-hidden w-[210mm] min-h-[297mm] print:shadow-none print:w-full print:min-h-screen">
                    {/* Top Branding Strip */}
                    <div className="h-1.5 w-full" style={{ background: theme.gradient }} />

                    <div className="p-10 flex flex-col h-full">
                        {/* Transparent Header Section */}
                        <header className="flex items-start justify-between mb-8 pb-6 border-b-2 border-slate-100 print:border-slate-800">
                            <div className="flex gap-6 items-center">
                                <div className="w-20 h-20 bg-white rounded-2xl p-2.5 flex items-center justify-center border-2 border-slate-400">
                                    {branding.logoUrl ? (
                                        <img src={branding.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
                                    ) : (
                                        <i className="fas fa-plus-square text-blue-600 text-4xl"></i>
                                    )}
                                </div>
                                <div className="max-w-md">
                                    <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none mb-1 uppercase">{branding.labName || 'Mediclo Lab'}</h1>
                                    <p className="text-sm font-bold text-blue-600 uppercase tracking-[0.2em] mb-3">{branding.tagline || 'Clinical Excellence'}</p>
                                    <div className="text-[10px] text-slate-700 font-bold space-y-0.5 leading-relaxed">
                                        <p className="flex items-center gap-2"><i className="fas fa-map-marker-alt opacity-30"></i> {branding.address}</p>
                                        <p className="flex items-center gap-2"><i className="fas fa-phone opacity-30"></i> {branding.contact} <span className="opacity-20 mx-1">|</span> <i className="fas fa-envelope opacity-30"></i> {branding.email}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="border-2 border-slate-900 rounded-2xl px-6 py-4 bg-slate-50/30">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Invoice Number</p>
                                    <p className="text-2xl font-black text-slate-900 tracking-tighter">#{invoiceData.invoiceNumber}</p>
                                </div>
                            </div>
                        </header>

                        {/* Boxed Patient & Meta Section */}
                        <div className="grid grid-cols-2 gap-0 border-2 border-slate-900 rounded-2xl overflow-hidden mb-8 shadow-sm">
                            <div className="p-5 border-r-2 border-slate-900">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <span className="w-2 h-2 bg-slate-900 rounded-full"></span> Billed To
                                </p>
                                <h2 className="text-xl font-black text-slate-900 leading-none mb-2">{invoiceData.patientName}</h2>
                                <p className="text-xs font-bold text-slate-700 uppercase flex items-center gap-2">
                                    PID: <span className="text-blue-600">#{invoiceData.patientId}</span> 
                                    <span className="opacity-20">|</span> 
                                    {invoiceData.patientAge}Y • {invoiceData.patientGender}
                                </p>
                            </div>
                            <div className="p-5 bg-slate-50/50 flex flex-col justify-center text-right">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Invoice Information</p>
                                <div className="space-y-1">
                                    <p className="text-xs font-bold text-slate-800">Date: <span className="text-slate-600 ml-2">{new Date(invoiceData.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span></p>
                                    <p className="text-xs font-bold text-slate-800">Time: <span className="text-slate-600 ml-2">{new Date(invoiceData.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span></p>
                                    <p className="text-xs font-bold text-slate-800">Mode: <span className="text-slate-900 ml-2 uppercase font-black">{invoiceData.paymentMode}</span></p>
                                </div>
                            </div>
                        </div>

                        {/* Boxed Items Table Section */}
                        <div className="flex-1 border-2 border-slate-900 rounded-2xl overflow-hidden mb-8 shadow-sm">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-slate-900 text-white">
                                        <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.2em]">Clinical Service Description</th>
                                        <th className="px-4 py-4 text-center text-[10px] font-black uppercase tracking-[0.2em] w-24 border-x border-white/10">Qty</th>
                                        <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-[0.2em] w-32">Rate (₹)</th>
                                        <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-[0.2em] w-32 border-l border-white/10">Amount (₹)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(invoiceData.items || []).map((item: any, idx: number) => (
                                        <tr key={idx} className="border-b-2 border-slate-300 last:border-0">
                                            <td className="px-6 py-5">
                                                <p className="font-extrabold text-slate-900 text-sm leading-tight mb-0.5">{item.name}</p>
                                                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tight italic">Clinical Diagnostics / Consultation</p>
                                            </td>
                                            <td className="px-4 py-5 text-center text-sm font-black text-slate-800 border-x-2 border-slate-100">{item.quantity}</td>
                                            <td className="px-6 py-5 text-right text-sm font-bold text-slate-700">{item.rate.toFixed(2)}</td>
                                            <td className="px-6 py-5 text-right text-sm font-black text-slate-900 border-l-2 border-slate-100 group-hover:bg-slate-50 transition-colors">{item.amount.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Boxed Summary & Payments */}
                        <div className="mt-auto grid grid-cols-5 gap-0 border-2 border-slate-900 rounded-2xl overflow-hidden shadow-sm">
                            {/* T&C Section */}
                            <div className="col-span-3 p-6 border-r-2 border-slate-900 bg-slate-50/50">
                                <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <i className="fas fa-gavel opacity-30"></i> Terms & Conditions
                                </h3>
                                <div className="space-y-2">
                                    <p className="text-[9px] text-slate-500 font-bold flex items-start gap-1.5"><span className="text-slate-900">01.</span> Services provided are non-refundable once performed.</p>
                                    <p className="text-[9px] text-slate-500 font-bold flex items-start gap-1.5"><span className="text-slate-900">02.</span> Reports issued after verified clinical examination.</p>
                                    <p className="text-[9px] text-slate-500 font-bold flex items-start gap-1.5"><span className="text-slate-900">03.</span> Computer generated - Digital Record ID: {invoiceData.invoiceId}</p>
                                </div>
                            </div>

                            {/* Totals Section */}
                            <div className="col-span-2">
                                <div className="p-4 space-y-1.5 bg-white">
                                    <div className="flex justify-between items-center text-[10px] font-bold text-slate-500">
                                        <span>SUBTOTAL</span>
                                        <span className="text-slate-900 font-black">₹{invoiceData.subtotal.toFixed(2)}</span>
                                    </div>
                                    {invoiceData.discount > 0 && (
                                        <div className="flex justify-between items-center text-[10px] font-black text-green-600">
                                            <span>DISCOUNT ({invoiceData.discountPercent}%)</span>
                                            <span>- ₹{invoiceData.discount.toFixed(2)}</span>
                                        </div>
                                    )}
                                    {invoiceData.gst > 0 && (
                                        <div className="flex justify-between items-center text-[10px] font-bold text-slate-500">
                                            <span>TAX / GST</span>
                                            <span className="text-slate-900 font-black">₹{invoiceData.gst.toFixed(2)}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="bg-slate-900 p-5 text-white">
                                    <div className="flex justify-between items-center mb-4">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Grand Total</span>
                                        <span className="text-2xl font-black tracking-tighter">₹{invoiceData.total.toFixed(2)}</span>
                                    </div>
                                    <div className="space-y-1 mt-4 pt-4 border-t border-white/20">
                                        <div className="flex justify-between items-center text-[10px] font-black text-green-400">
                                            <span className="tracking-widest">PAID AMOUNT</span>
                                            <span>₹{invoiceData.paid.toFixed(2)}</span>
                                        </div>
                                        {invoiceData.due > 0 && (
                                            <div className="flex justify-between items-center text-[10px] font-black text-red-500">
                                                <span className="tracking-widest">BALANCE DUE</span>
                                                <span className="animate-pulse">₹{invoiceData.due.toFixed(2)}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer Section - Director Only */}
                        <footer className="mt-12 flex items-end justify-between px-2">
                            <div className="flex-1 text-[8px] text-slate-400 font-black tracking-widest uppercase mb-1">
                                System Generated Document ID: {invoiceData.invoiceId} <br/>
                                Issued on: {new Date().toLocaleDateString('en-IN')}
                            </div>

                            <div className="text-right">
                                <div className="h-16 w-52 mb-3 flex items-center justify-center border-b-2 border-slate-900 bg-slate-50/10">
                                    <span className="text-[9px] text-slate-300 font-black uppercase tracking-[0.4em] opacity-40 italic">LAB DIRECTOR SEAL</span>
                                </div>
                                <p className="text-[11px] font-black text-slate-900 uppercase tracking-[0.1em]">{branding.director || 'Lab Director'}</p>
                                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Authorized Signatory</p>
                            </div>
                        </footer>
                    </div>
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
