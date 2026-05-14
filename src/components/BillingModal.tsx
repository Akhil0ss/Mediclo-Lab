'use client';

import { useState, useEffect } from 'react';
import { ref, onValue, get, update, push, set } from 'firebase/database';
import { database } from '@/lib/firebase';
import { calculateBilling, createBillingItem, formatCurrency } from '@/lib/billingCalculator';
import { mergeTemplates, getPriceMap } from '@/lib/templateUtils';
import { generateInvoiceId } from '@/lib/idGenerator';
import Modal from './Modal';

interface BillingModalProps {
    isOpen: boolean;
    onClose: () => void;
    patient: any;
    ownerId: string;
    userId: string;
}

export default function BillingModal({ isOpen, onClose, patient, ownerId, userId }: BillingModalProps) {
    const [billingDate, setBillingDate] = useState(new Date().toISOString().split('T')[0]);
    const [billingItems, setBillingItems] = useState<any[]>([]);
    const [discount, setDiscount] = useState(0);
    const [paid, setPaid] = useState(0);
    const [paymentMode, setPaymentMode] = useState('Cash');
    const [includeGST, setIncludeGST] = useState(false);
    const [autoLabEntry, setAutoLabEntry] = useState(false);
    const [templates, setTemplates] = useState<any[]>([]);
    const [doctors, setDoctors] = useState<any[]>([]);
    const [opdVisits, setOpdVisits] = useState<any[]>([]);
    const [reports, setReports] = useState<any[]>([]);
    const [testSearch, setTestSearch] = useState('');
    const [customPrice, setCustomPrice] = useState('');
    const [labName, setLabName] = useState('CLINIC');
    const [loading, setLoading] = useState(true);
    const [existingInvoice, setExistingInvoice] = useState<any>(null);
    const [samples, setSamples] = useState<any[]>([]);

    // Fetch Reference Data
    useEffect(() => {
        if (!isOpen || !ownerId) return;

        const templatesRef = ref(database, `templates/${ownerId}`);
        const commonTemplatesRef = ref(database, 'common_templates');
        const staffRef = ref(database, `users/${ownerId}/auth/staff`);
        const opdRef = ref(database, `opd/${ownerId}`);
        const reportsRef = ref(database, `reports/${ownerId}`);
        const samplesRef = ref(database, `samples/${ownerId}`);
        const brandingRef = ref(database, `branding/${ownerId}`);

        const fetchData = async () => {
            setLoading(true);
            try {
                // Branding
                const brandingSnap = await get(brandingRef);
                if (brandingSnap.exists()) setLabName(brandingSnap.val().labName || 'CLINIC');

                // Templates
                const userT = await get(templatesRef);
                const commonT = await get(commonTemplatesRef);
                const userTList: any[] = [];
                userT.forEach(c => { userTList.push({ id: c.key, ...c.val() }); });
                const commonTList: any[] = [];
                commonT.forEach(c => { commonTList.push({ id: c.key, ...c.val() }); });
                
                const combinedT = mergeTemplates(userTList, commonTList);
                setTemplates(combinedT);

                // Staff/Doctors
                const staffSnap = await get(staffRef);
                const doctorsList: any[] = [];
                if (staffSnap.exists()) {
                    staffSnap.forEach(c => {
                        const s = c.val();
                        if (['doctor', 'dr-staff'].includes(s.role)) {
                            doctorsList.push({ id: c.key, ...s });
                        }
                    });
                }
                setDoctors(doctorsList);

                // Patient Specific Data
                const opdSnap = await get(opdRef);
                const opdList: any[] = [];
                opdSnap.forEach(c => {
                    const v = c.val();
                    if (v.patientId === patient?.id) opdList.push({ id: c.key, ...v });
                });
                setOpdVisits(opdList);

                const reportsSnap = await get(reportsRef);
                const reportsList: any[] = [];
                reportsSnap.forEach(c => {
                    const r = c.val();
                    if (r.patientId === patient?.id) reportsList.push({ id: c.key, ...r });
                });
                setReports(reportsList);

                const samplesSnap = await get(samplesRef);
                const samplesList: any[] = [];
                samplesSnap.forEach(c => {
                    const s = c.val();
                    if (s.patientId === patient?.id || s.patientKey === patient?.id) samplesList.push({ id: c.key, ...s });
                });
                setSamples(samplesList);

                // Initial Load for Today
                loadItemsForDate(new Date().toISOString().split('T')[0], opdList, reportsList, samplesList, combinedT, doctorsList);
            } catch (err) {
                console.error("Billing data fetch error:", err);
            }
            setLoading(false);
        };

        fetchData();
    }, [isOpen, ownerId, patient]);

    const loadItemsForDate = async (date: string, visits: any[], reps: any[], samps: any[], temps: any[], docs: any[]) => {
        const newItems: any[] = [];
        const billedNames = new Set<string>();
        
        // 1. Load existing invoice data first to use as base
        const invoiceKey = `inv_${patient?.id}_${date}`;
        let baseInvoiceData: any = null;
        try {
            const invSnap = await get(ref(database, `invoices/${ownerId}/${invoiceKey}`));
            if (invSnap.exists()) {
                baseInvoiceData = invSnap.val();
                setExistingInvoice(baseInvoiceData);
                if (baseInvoiceData.items && baseInvoiceData.items.length > 0) {
                    baseInvoiceData.items.forEach((item: any) => {
                        newItems.push(item);
                        billedNames.add(item.name?.toLowerCase().trim());
                    });
                    setDiscount(baseInvoiceData.discountPercent || baseInvoiceData.discount || 0);
                    setPaid(baseInvoiceData.paid || 0);
                    setPaymentMode(baseInvoiceData.paymentMode || 'Cash');
                    setIncludeGST(baseInvoiceData.includeGST || false);
                }
            } else {
                setExistingInvoice(null);
            }
        } catch (e) {
            setExistingInvoice(null);
        }

        // 2. Scan clinical nodes for NEW items not yet in the bill
        const priceMap = getPriceMap(temps || templates);
        
        // A. OPD Consultations
        const dateOpd = (visits || opdVisits).filter(v => v.visitDate?.startsWith(date));
        dateOpd.forEach(visit => {
            const consultationName = `Dr. ${visit.doctorName || 'Doctor'} - Consultation`.toLowerCase().trim();
            // Check if already billed
            const alreadyBilled = Array.from(billedNames).some(name => name.includes('consultation') && name.includes((visit.doctorName || '').toLowerCase()));
            
            if (!alreadyBilled) {
                const doctor = docs.find(d => d.name === visit.doctorName || d.id === visit.doctorId);
                const fee = parseFloat(String(doctor?.fee || doctor?.consultationFee || 500));
                const newItem = createBillingItem(`Dr. ${visit.doctorName || 'Doctor'} - Consultation`, 1, fee);
                newItems.push(newItem);
                billedNames.add(consultationName);
            }
        });

        // B. Lab Reports (Priority Source)
        const dateReports = (reps || reports).filter(r => (r.createdAt || r.date)?.startsWith(date));
        dateReports.forEach(r => {
            const testNames: string[] = [];
            const rItems: string[] = [];
            if (r.testName) r.testName.split(/[,&/]/).forEach((s: string) => rItems.push(s.trim()));
            if (r.testDetails && Array.isArray(r.testDetails)) {
                r.testDetails.forEach((td: any) => td.testName && rItems.push(td.testName.trim()));
            }

            const newTestsInReport: string[] = [];
            rItems.forEach(tn => {
                const lowerTn = tn?.toLowerCase().trim();
                if (lowerTn && !billedNames.has(lowerTn)) {
                    newTestsInReport.push(tn);
                    billedNames.add(lowerTn);
                }
            });

            if (newTestsInReport.length > 0) {
                let finalPrice = parseFloat(String(r.price || r.totalPrice || 0)) || 0;
                if (finalPrice <= 0) {
                    newTestsInReport.forEach(tn => {
                        const price = priceMap[tn.toLowerCase().trim()] || 0;
                        finalPrice += price;
                    });
                }
                newItems.push(createBillingItem(newTestsInReport.join(', '), 1, finalPrice));
            }
        });

        // C. Samples (Pre-Report)
        const dateSamples = (samps || samples).filter(s => (s.createdAt || s.date)?.startsWith(date));
        dateSamples.forEach(sample => {
            const sampleTests = sample.tests || [];
            sampleTests.forEach((testName: string) => {
                const trimmed = testName.trim();
                if (trimmed && !billedNames.has(trimmed.toLowerCase())) {
                    const price = priceMap[trimmed.toLowerCase()] || 0;
                    newItems.push(createBillingItem(trimmed, 1, price));
                    billedNames.add(trimmed.toLowerCase());
                }
            });
        });

        setBillingItems(newItems.length > 0 ? newItems : [createBillingItem('', 1, 0)]);
    };

    const handleDateChange = (date: string) => {
        setBillingDate(date);
        loadItemsForDate(date, opdVisits, reports, samples, templates, doctors);
    };

    const addTemplateItem = (template: any) => {
        const rate = parseFloat(template.totalPrice || template.price || 0);
        const newItem = createBillingItem(template.name, 1, rate);
        setBillingItems(prev => {
            const filtered = prev.filter(i => i.name && !['', 'No tests'].includes(i.name.trim()));
            return [...filtered, newItem];
        });
        setTestSearch('');
    };

    const addCustomItem = () => {
        if (!testSearch) return;
        const price = parseFloat(customPrice) || 0;
        const newItem = createBillingItem(testSearch, 1, price);
        setBillingItems(prev => {
            const filtered = prev.filter(i => i.name && !['', 'No tests'].includes(i.name.trim()));
            return [...filtered, newItem];
        });
        setTestSearch('');
        setCustomPrice('');
    };

    const b = calculateBilling(billingItems.filter(i => i.name), discount, includeGST ? 18 : 0, paid);

    const handleSave = async () => {
        if (!patient || !ownerId) return;

        const validItems = billingItems.filter(i => i.name);
        if (validItems.length === 0) {
            alert("No items to bill!");
            return;
        }

        const invoiceKey = `inv_${patient.id}_${billingDate}`;
        const invRef = ref(database, `invoices/${ownerId}/${invoiceKey}`);
        const invSnap = await get(invRef);

        let invNum = '';
        let createdAt = new Date().toISOString();

        if (invSnap.exists()) {
            const existing = invSnap.val();
            invNum = existing.invoiceNumber || existing.invoiceId;
            if (existing.createdAt) createdAt = existing.createdAt;
        } else {
            invNum = await generateInvoiceId(ownerId, labName);
        }

        const invData = {
            invoiceId: invNum,
            invoiceNumber: invNum,
            patientId: patient.patientId || patient.id,
            patientKey: patient.id,
            patientName: patient.name,
            patientAge: patient.age,
            patientGender: patient.gender,
            ...b,
            items: validItems,
            paymentMode,
            includeGST,
            visitDate: billingDate,
            createdAt,
            createdBy: userId
        };

        await update(invRef, invData);

        // Auto-generate Lab Worklist Entry if enabled
        if (autoLabEntry) {
            try {
                const selectedTestIds = validItems
                    .map(item => templates.find(t => t.name === item.name)?.id)
                    .filter(Boolean) as string[];

                if (selectedTestIds.length > 0) {
                    const sampleKey = `sample_${invNum.replace(/[^A-Z0-9]/g, '')}`;
                    const samplesRef = ref(database, `samples/${ownerId}/${sampleKey}`);
                    
                    const sampleData = {
                        sampleId: `LAB-${Date.now().toString().slice(-6)}`,
                        sampleNumber: `LAB-${Date.now().toString().slice(-6)}`,
                        patientId: patient.patientId || patient.id,
                        patientName: patient.name,
                        sampleType: 'Procedure / No Sample',
                        date: new Date().toISOString(),
                        status: 'Processing',
                        tests: validItems.map(i => i.name).filter(Boolean),
                        testIds: selectedTestIds,
                        createdAt: new Date().toISOString(),
                        billingId: invNum
                    };
                    
                    // Check if sample already exists for this bill to avoid duplicates
                    const existingSample = await get(samplesRef);
                    if (!existingSample.exists()) {
                        await set(samplesRef, sampleData);
                    } else {
                        // Just update the tests if it already exists
                        await update(samplesRef, {
                            tests: sampleData.tests,
                            testIds: sampleData.testIds,
                            updatedAt: new Date().toISOString()
                        });
                    }
                }
            } catch (err) {
                console.error("Failed to create lab entry:", err);
            }
        }

        // Update Patient Record Reference
        await update(ref(database, `patient_records/${ownerId}/${patient.id}/invoices/${invoiceKey}`), {
            invoiceId: invNum,
            date: billingDate,
            total: b.total,
            status: b.due <= 0 ? 'paid' : (b.paid > 0 ? 'partial' : 'pending')
        });

        // Open Print
        try {
            localStorage.setItem(`print_cache_invoice_${invNum}`, JSON.stringify(invData));
        } catch (e) {}
        const printData = encodeURIComponent(JSON.stringify(invData));
        window.open(`/print/invoice/${invNum}?data=${printData}&ownerId=${ownerId}`, '_blank');
        onClose();
    };

    const handleReprint = () => {
        if (!existingInvoice) return;
        try {
            localStorage.setItem(`print_cache_invoice_${existingInvoice.invoiceNumber}`, JSON.stringify(existingInvoice));
        } catch (e) {}
        const printData = encodeURIComponent(JSON.stringify(existingInvoice));
        window.open(`/print/invoice/${existingInvoice.invoiceNumber}?data=${printData}&ownerId=${ownerId}`, '_blank');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <div className="flex justify-between items-center mb-4 border-b pb-2">
                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <i className="fas fa-file-invoice-dollar text-blue-600"></i>
                    Generate Bill - {patient?.name}
                </h3>
            </div>

            <div className="space-y-4">
                {/* Visit Selection */}
                <div className="grid grid-cols-2 gap-4 bg-blue-50 p-3 rounded-xl border border-blue-100">
                    <div>
                        <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1 block">Visit Date</label>
                        <select
                            value={billingDate}
                            onChange={(e) => handleDateChange(e.target.value)}
                            className="w-full px-3 py-2 border-2 border-blue-100 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                            {(() => {
                                const dates = new Set<string>();
                                const today = new Date().toISOString().split('T')[0];
                                dates.add(today);
                                opdVisits.forEach(v => v.visitDate && dates.add(v.visitDate.split('T')[0]));
                                reports.forEach(r => (r.createdAt || r.date) && dates.add((r.createdAt || r.date).split('T')[0]));
                                return Array.from(dates).sort((a, b) => b.localeCompare(a)).map(d => (
                                    <option key={d} value={d}>
                                        {d === today ? `Today (${new Date(d).toLocaleDateString('en-IN')})` : new Date(d).toLocaleDateString('en-IN')}
                                    </option>
                                ));
                            })()}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1 block">Lab/Clinic Name</label>
                        <div className="px-3 py-2 bg-white/50 rounded-lg font-bold text-blue-800 border-2 border-blue-100">
                            {labName}
                        </div>
                    </div>
                </div>

                {/* Quick Add */}
                <div className="relative">
                    <label className="text-sm font-bold mb-1 block text-gray-700">Add Service / Test</label>
                    <div className="flex gap-2">
                        <div className="relative flex-[2]">
                            <i className="fas fa-search absolute left-3 top-3 text-gray-400 text-sm"></i>
                            <input
                                type="text"
                                placeholder="Search templates..."
                                value={testSearch}
                                onChange={(e) => setTestSearch(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                            />
                        </div>
                        <div className="relative flex-1">
                            <i className="fas fa-tag absolute left-3 top-3 text-gray-400 text-sm"></i>
                            <input
                                type="number"
                                placeholder="Price"
                                value={customPrice}
                                onChange={(e) => setCustomPrice(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                            />
                        </div>
                        <button
                            onClick={addCustomItem}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-bold shadow-md"
                        >
                            <i className="fas fa-plus"></i>
                        </button>
                    </div>

                    {testSearch && (
                        <div className="absolute z-20 w-full mt-1 bg-white border-2 border-blue-100 rounded-xl shadow-2xl max-h-48 overflow-y-auto">
                            {templates
                                .filter(t => 
                                    t.name?.toLowerCase().includes(testSearch.toLowerCase()) ||
                                    t.subtests?.some((st: any) => (st.name || st.testName || "").toLowerCase().includes(testSearch.toLowerCase()))
                                )
                                .slice(0, 5)
                                .map(t => (
                                    <button
                                        key={t.id}
                                        onClick={() => addTemplateItem(t)}
                                        className="w-full text-left px-4 py-2 hover:bg-blue-50 flex justify-between items-center border-b last:border-0"
                                    >
                                        <span className="font-semibold text-gray-700">{t.name}</span>
                                        <span className="text-blue-600 font-black">₹{t.totalPrice || t.price || 0}</span>
                                    </button>
                                ))}
                        </div>
                    )}
                </div>

                {/* Items TABLE */}
                <div className="border-2 border-gray-100 rounded-xl overflow-hidden shadow-inner bg-gray-50/30">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-100 uppercase text-[10px] font-black text-gray-500 tracking-wider">
                            <tr>
                                <th className="px-4 py-2 text-left">Service/Item</th>
                                <th className="px-4 py-2 w-16 text-center">Qty</th>
                                <th className="px-4 py-2 w-24 text-right">Rate</th>
                                <th className="px-4 py-2 w-24 text-right">Amount</th>
                                <th className="w-10"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {billingItems.map((item, idx) => (
                                <tr key={item.id} className="border-b last:border-0 hover:bg-white transition-colors">
                                    <td className="px-4 py-2">
                                        <input
                                            type="text"
                                            value={item.name}
                                            onChange={(e) => {
                                                const n = [...billingItems];
                                                n[idx].name = e.target.value;
                                                setBillingItems(n);
                                            }}
                                            className="w-full bg-transparent font-medium text-gray-800 outline-none focus:text-blue-600"
                                        />
                                    </td>
                                    <td className="px-4 py-2">
                                        <input
                                            type="number"
                                            value={item.quantity}
                                            onChange={(e) => {
                                                const n = [...billingItems];
                                                n[idx].quantity = parseFloat(e.target.value) || 0;
                                                n[idx].amount = n[idx].quantity * n[idx].rate;
                                                setBillingItems(n);
                                            }}
                                            className="w-full text-center bg-transparent outline-none"
                                        />
                                    </td>
                                    <td className="px-4 py-2">
                                        <input
                                            type="number"
                                            value={item.rate}
                                            onChange={(e) => {
                                                const n = [...billingItems];
                                                n[idx].rate = parseFloat(e.target.value) || 0;
                                                n[idx].amount = n[idx].quantity * n[idx].rate;
                                                setBillingItems(n);
                                            }}
                                            className="w-full text-right bg-transparent outline-none font-bold text-gray-600"
                                        />
                                    </td>
                                    <td className="px-4 py-2 text-right font-black text-gray-700">
                                        {formatCurrency(item.amount)}
                                    </td>
                                    <td className="px-4 py-2 text-center text-gray-300 hover:text-red-500 cursor-pointer" onClick={() => setBillingItems(billingItems.filter((_, i) => i !== idx))}>
                                        <i className="fas fa-trash-alt"></i>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Summary Section */}
                <div className="grid grid-cols-2 gap-6 pt-2">
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Discount %</label>
                                <input type="number" value={discount} onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 border rounded-lg" min="0" max="100" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Pay Mode</label>
                                <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)} className="w-full px-3 py-2 border rounded-lg">
                                    <option>Cash</option>
                                    <option>UPI</option>
                                    <option>Card</option>
                                    <option>Cheque</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Amount Paid</label>
                            <input type="number" value={paid} onChange={(e) => setPaid(parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 border-2 border-blue-50 focus:border-blue-500 rounded-lg text-lg font-bold text-blue-600" />
                        </div>
                        <div className="flex items-center gap-2">
                            <input type="checkbox" checked={includeGST} onChange={(e) => setIncludeGST(e.target.checked)} className="w-4 h-4 rounded" />
                            <span className="text-xs font-semibold text-gray-600">Include GST (18%)</span>
                        </div>
                        <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg border border-blue-100">
                            <input type="checkbox" checked={autoLabEntry} onChange={(e) => setAutoLabEntry(e.target.checked)} className="w-4 h-4 text-blue-600 rounded" />
                            <div>
                                <span className="text-[10px] font-bold text-blue-800 uppercase block">Auto-generate Lab Worklist</span>
                                <p className="text-[9px] text-blue-500 leading-tight">Send directly to reporting queue.</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-2xl space-y-1 shadow-sm border border-slate-200">
                        <div className="flex justify-between text-xs text-slate-500 font-bold uppercase tracking-wider">
                            <span>Subtotal</span>
                            <span>{formatCurrency(b.subtotal)}</span>
                        </div>
                        {b.discount > 0 && (
                            <div className="flex justify-between text-xs text-emerald-600 font-bold">
                                <span>Discount ({discount}%)</span>
                                <span>- {formatCurrency(b.discount)}</span>
                            </div>
                        )}
                        {includeGST && (
                            <div className="flex justify-between text-xs text-slate-500 font-bold uppercase tracking-wider">
                                <span>GST (18%)</span>
                                <span>{formatCurrency(b.gst)}</span>
                            </div>
                        )}
                        <div className="flex justify-between text-xl font-black border-t border-slate-200 pt-2 mt-2 text-slate-900">
                            <span>Total</span>
                            <span>{formatCurrency(b.total)}</span>
                        </div>
                        <div className="flex justify-between text-sm text-indigo-600 font-black border-t border-slate-200 pt-2">
                            <span>Balance Due</span>
                            <span className={b.due > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                                {formatCurrency(b.due)}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex justify-end items-center gap-3 pt-4 border-t">
                    <button onClick={onClose} className="px-6 py-2 rounded-xl text-gray-500 font-bold hover:bg-gray-100 uppercase text-xs tracking-widest whitespace-nowrap">
                        Cancel
                    </button>
                    {existingInvoice && (
                        <button
                            onClick={handleReprint}
                            className="px-8 py-3 bg-white border-2 border-slate-900 text-slate-900 rounded-xl font-black shadow-sm hover:bg-slate-50 active:scale-95 transition-all flex items-center gap-2 whitespace-nowrap"
                        >
                            <i className="fas fa-print"></i>
                            REPRINT BILL
                        </button>
                    )}
                    <button
                        onClick={handleSave}
                        className="px-8 py-3 bg-slate-900 text-white rounded-xl font-black shadow-lg hover:shadow-slate-500/20 active:scale-95 transition-all flex items-center gap-2 whitespace-nowrap"
                    >
                        <i className={`fas ${existingInvoice ? 'fa-sync' : 'fa-save'}`}></i>
                        {existingInvoice ? 'UPDATE & PRINT' : 'SAVE & PRINT'}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
