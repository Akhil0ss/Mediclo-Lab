'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { calculateBilling, createBillingItem, formatCurrency } from '@/lib/billingCalculator';
import { ref, push, onValue, get, update } from 'firebase/database';
import { database } from '@/lib/firebase';
import { generateInvoiceId } from '@/lib/idGenerator';
import { mergeTemplates } from '@/lib/templateUtils';
import { getBrandingData } from '@/lib/dataUtils';

export default function BillingPage() {
    const { user, userProfile } = useAuth();
    const searchParams = useSearchParams();
    const router = useRouter();

    const patientId = searchParams.get('patientId');
    const patientName = searchParams.get('patientName');

    const [items, setItems] = useState([createBillingItem('', 1, 0)]);
    const [discount, setDiscount] = useState(0);
    const [paid, setPaid] = useState(0);
    const [paymentMode, setPaymentMode] = useState('Cash');
    const [templates, setTemplates] = useState<any[]>([]);
    const [testSearch, setTestSearch] = useState('');
    const [autoLabEntry, setAutoLabEntry] = useState(true);
    const [labName, setLabName] = useState('CLINIC');

    useEffect(() => {
        if (!user || !userProfile) return;
        const dataSourceId = userProfile.ownerId || user.uid;

        // Fetch Branding for Clinic Name
        getBrandingData(dataSourceId, { ownerId: dataSourceId }).then(data => {
            if (data?.labName) setLabName(data.labName);
        });

        const templatesRef = ref(database, `templates/${dataSourceId}`);
        const commonTemplatesRef = ref(database, 'common_templates');

        const fetchTemplates = () => {
            get(templatesRef).then(userSnapshot => {
                get(commonTemplatesRef).then(commonSnapshot => {
                    const userTemplates: any[] = [];
                    userSnapshot.forEach(child => {
                        userTemplates.push({ id: child.key, ...child.val() });
                    });

                    const commonTemplates: any[] = [];
                    commonSnapshot.forEach(child => {
                        commonTemplates.push({ id: child.key, ...child.val() });
                    });

                    const combined = mergeTemplates(userTemplates, commonTemplates);
                    setTemplates(combined.sort((a, b) => a.name.localeCompare(b.name)));
                });
            });
        };

        fetchTemplates();
        const unsubTemplates = onValue(templatesRef, fetchTemplates);
        const unsubCommon = onValue(commonTemplatesRef, fetchTemplates);
        return () => {
            unsubTemplates();
            unsubCommon();
        };
    }, [user]);

    const addTemplateToBilling = (template: any) => {
        const rate = parseFloat(template.totalPrice || template.price || 0);
        const newItem = createBillingItem(template.name, 1, rate);
        setItems(prev => {
            const filtered = prev.filter(i => i.name && !['', 'CBC Test, Lipid Profile'].includes(i.name.trim()));
            return [...filtered, newItem];
        });
        setTestSearch('');
    };

    const billing = calculateBilling(items.filter(i => i.name), discount, 18, paid);

    const addItem = () => setItems([...items, createBillingItem('', 1, 0)]);

    const updateItem = (index: number, field: string, value: any) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        if (field === 'quantity' || field === 'rate') {
            newItems[index].amount = newItems[index].quantity * newItems[index].rate;
        }
        setItems(newItems);
    };

    const removeItem = (index: number) => {
        if (items.length > 1) setItems(items.filter((_, i) => i !== index));
    };

    const handleSave = async () => {
        const ownerId = userProfile?.ownerId || user?.uid;
        if (!ownerId || !patientId) return;

        const invoiceNumber = await generateInvoiceId(ownerId, labName);
        const invoiceData = {
            invoiceId: invoiceNumber,
            invoiceNumber: invoiceNumber,
            patientId,
            patientName,
            ...billing,
            paymentMode,
            createdAt: new Date().toISOString(),
            createdBy: user.uid
        };

        const newInvRef = await push(ref(database, `invoices/${ownerId}`), invoiceData);
        const invKey = newInvRef.key;

        // BINDING: Update patient_records index
        await update(ref(database, `patient_records/${ownerId}/${patientId}/invoices/${invKey}`), {
            invoiceId: invoiceNumber,
            date: new Date().toISOString().split('T')[0],
            total: billing.total,
            status: 'pending'
        });

        // Auto-generate Lab Worklist Entry if enabled
        if (autoLabEntry) {
            try {
                const selectedTestIds = items
                    .map(item => templates.find(t => t.name === item.name)?.id)
                    .filter(Boolean) as string[];

                if (selectedTestIds.length > 0) {
                    const sampleId = `LAB-${Date.now().toString().slice(-6)}`;
                    const sampleData = {
                        sampleId,
                        sampleNumber: sampleId,
                        patientId,
                        patientName,
                        // If it's something like ECG, we can set a generic type
                        sampleType: 'Procedure / No Sample',
                        date: new Date().toISOString(),
                        status: 'Processing', // Skip 'Pending' since no sample collection needed
                        tests: items.map(i => i.name).filter(Boolean),
                        testIds: selectedTestIds,
                        createdAt: new Date().toISOString(),
                        billingId: invoiceNumber
                    };
                    const ownerId = userProfile?.ownerId || user?.uid;
                    await push(ref(database, `samples/${ownerId}`), sampleData);
                }
            } catch (err) {
                console.error("Failed to create lab entry:", err);
            }
        }

        const ownerIdForPrint = userProfile?.ownerId || user?.uid || '';
        window.open(`/print/invoice/${invoiceNumber}?ownerId=${ownerIdForPrint}&data=${encodeURIComponent(JSON.stringify(invoiceData))}`, '_blank');
        router.back();
    };

    return (
        <div className="max-w-4xl mx-auto p-6">
            <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex justify-between items-center mb-6 pb-4 border-b">
                    <div>
                        <h1 className="text-2xl font-bold">Generate Bill</h1>
                        <p className="text-sm text-gray-500">Patient: {patientName}</p>
                    </div>
                    <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700">
                        <i className="fas fa-times text-xl"></i>
                    </button>
                </div>

                {/* Template Search */}
                <div className="mb-6 relative">
                    <label className="block text-sm font-medium mb-1">Quick Add Test (Template)</label>
                    <div className="relative">
                        <i className="fas fa-search absolute left-3 top-3 text-gray-400"></i>
                        <input
                            type="text"
                            placeholder="Search test templates..."
                            value={testSearch}
                            onChange={(e) => setTestSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    {testSearch && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                            {templates
                                .filter(t => t.name.toLowerCase().includes(testSearch.toLowerCase()))
                                .slice(0, 10)
                                .map(t => (
                                    <button
                                        key={t.id}
                                        onClick={() => addTemplateToBilling(t)}
                                        className="w-full text-left px-4 py-2 hover:bg-blue-50 flex justify-between border-b last:border-0"
                                    >
                                        <span className="font-medium text-gray-800">{t.name}</span>
                                        <span className="text-blue-600 font-bold text-sm">₹{t.totalPrice || t.price || 0}</span>
                                    </button>
                                ))
                            }
                        </div>
                    )}
                </div>

                {/* Items Table */}
                <div className="mb-6">
                    <table className="w-full">
                        <thead className="bg-gray-50 uppercase text-xs text-gray-500 font-bold">
                            <tr>
                                <th className="px-4 py-2 text-left">Service/Item</th>
                                <th className="px-4 py-2 text-center w-24">Qty</th>
                                <th className="px-4 py-2 text-right w-32">Rate</th>
                                <th className="px-4 py-2 text-right w-32">Amount</th>
                                <th className="px-4 py-2 w-12 text-center"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item, idx) => (
                                <tr key={idx} className="border-b hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-2 text-sm">
                                        <input
                                            type="text"
                                            value={item.name}
                                            onChange={(e) => updateItem(idx, 'name', e.target.value)}
                                            placeholder="e.g. CBC Test, Lipid Profile"
                                            className="w-full px-2 py-1 border border-transparent focus:border-blue-300 focus:bg-white rounded transition-all outline-none"
                                        />
                                    </td>
                                    <td className="px-4 py-2">
                                        <input
                                            type="number"
                                            value={item.quantity}
                                            onChange={(e) => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                                            className="w-full px-2 py-1 border border-transparent focus:border-blue-300 focus:bg-white rounded text-center transition-all outline-none"
                                            min="1"
                                        />
                                    </td>
                                    <td className="px-4 py-2">
                                        <input
                                            type="number"
                                            value={item.rate}
                                            onChange={(e) => updateItem(idx, 'rate', parseFloat(e.target.value) || 0)}
                                            className="w-full px-2 py-1 border border-transparent focus:border-blue-300 focus:bg-white rounded text-right transition-all outline-none"
                                            min="0"
                                        />
                                    </td>
                                    <td className="px-4 py-2 text-right font-bold text-gray-700">
                                        {formatCurrency(item.amount)}
                                    </td>
                                    <td className="px-4 py-2 text-center">
                                        {items.length > 1 && (
                                            <button onClick={() => removeItem(idx)} className="text-gray-300 hover:text-red-500 transition-colors">
                                                <i className="fas fa-trash-alt"></i>
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <button onClick={addItem} className="mt-4 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition font-semibold text-sm">
                        <i className="fas fa-plus mr-1"></i> Add Manual Row
                    </button>
                </div>

                {/* Calculations */}
                <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-3">
                        <div>
                            <label className="block text-sm font-medium mb-1">Discount (%)</label>
                            <input
                                type="number"
                                value={discount}
                                onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                                className="w-full px-3 py-2 border rounded"
                                min="0"
                                max="100"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Payment Mode</label>
                            <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)} className="w-full px-3 py-2 border rounded">
                                <option>Cash</option>
                                <option>Card</option>
                                <option>UPI</option>
                                <option>Cheque</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Amount Paid</label>
                            <input
                                type="number"
                                value={paid}
                                onChange={(e) => setPaid(parseFloat(e.target.value) || 0)}
                                className="w-full px-3 py-2 border rounded"
                                min="0"
                            />
                        </div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                        <div className="flex justify-between">
                            <span>Subtotal:</span>
                            <span className="font-medium">{formatCurrency(billing.subtotal)}</span>
                        </div>
                        <div className="flex justify-between text-green-600">
                            <span>Discount ({discount}%):</span>
                            <span>- {formatCurrency(billing.discount)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Taxable Amount:</span>
                            <span>{formatCurrency(billing.taxableAmount)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>GST (18%):</span>
                            <span>{formatCurrency(billing.gst)}</span>
                        </div>
                        <div className="flex justify-between text-lg font-bold border-t pt-2">
                            <span>Total:</span>
                            <span>{formatCurrency(billing.total)}</span>
                        </div>
                        <div className="flex justify-between text-blue-600">
                            <span>Paid:</span>
                            <span>{formatCurrency(billing.paid)}</span>
                        </div>
                        <div className="flex justify-between text-red-600 font-bold">
                            <span>Due:</span>
                            <span>{formatCurrency(billing.due)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Automation Options */}
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
                <label className="flex items-center gap-3 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={autoLabEntry}
                        onChange={(e) => setAutoLabEntry(e.target.checked)}
                        className="w-5 h-5 text-blue-600 rounded"
                    />
                    <div>
                        <span className="font-bold text-blue-800">Auto-generate Lab Worklist</span>
                        <p className="text-xs text-blue-600">Send these tests directly to the reporting queue (skips manual sample collection for procedures like ECG/X-Ray).</p>
                    </div>
                </label>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                <button onClick={() => router.back()} className="px-6 py-2 border rounded-lg hover:bg-gray-50">
                    Cancel
                </button>
                <button onClick={handleSave} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    <i className="fas fa-print mr-2"></i>
                    Save & Print Invoice
                </button>
            </div>
        </div>
    );
}
