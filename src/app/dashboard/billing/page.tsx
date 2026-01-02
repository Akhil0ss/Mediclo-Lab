'use client';

import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { calculateBilling, createBillingItem, formatCurrency, generateInvoiceNumber } from '@/lib/billingCalculator';
import { ref, push } from 'firebase/database';
import { database } from '@/lib/firebase';

export default function BillingPage() {
    const { user } = useAuth();
    const searchParams = useSearchParams();
    const router = useRouter();

    const patientId = searchParams.get('patientId');
    const patientName = searchParams.get('patientName');

    const [items, setItems] = useState([createBillingItem('', 1, 0)]);
    const [discount, setDiscount] = useState(0);
    const [paid, setPaid] = useState(0);
    const [paymentMode, setPaymentMode] = useState('Cash');

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
        if (!user || !patientId) return;

        const invoiceNumber = generateInvoiceNumber('INV', Date.now());
        const invoiceData = {
            invoiceNumber,
            patientId,
            patientName,
            ...billing,
            paymentMode,
            createdAt: new Date().toISOString(),
            createdBy: user.uid
        };

        await push(ref(database, `invoices/${user.uid}`), invoiceData);

        // Open print page
        window.open(`/print/invoice/${invoiceNumber}?data=${encodeURIComponent(JSON.stringify(invoiceData))}`, '_blank');
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

                {/* Items Table */}
                <div className="mb-6">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-2 text-left">Service/Item</th>
                                <th className="px-4 py-2 text-center w-24">Qty</th>
                                <th className="px-4 py-2 text-right w-32">Rate</th>
                                <th className="px-4 py-2 text-right w-32">Amount</th>
                                <th className="px-4 py-2 w-12"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item, idx) => (
                                <tr key={idx} className="border-b">
                                    <td className="px-4 py-2">
                                        <input
                                            type="text"
                                            value={item.name}
                                            onChange={(e) => updateItem(idx, 'name', e.target.value)}
                                            placeholder="e.g. OPD Consultation, CBC Test"
                                            className="w-full px-2 py-1 border rounded"
                                        />
                                    </td>
                                    <td className="px-4 py-2">
                                        <input
                                            type="number"
                                            value={item.quantity}
                                            onChange={(e) => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                                            className="w-full px-2 py-1 border rounded text-center"
                                            min="1"
                                        />
                                    </td>
                                    <td className="px-4 py-2">
                                        <input
                                            type="number"
                                            value={item.rate}
                                            onChange={(e) => updateItem(idx, 'rate', parseFloat(e.target.value) || 0)}
                                            className="w-full px-2 py-1 border rounded text-right"
                                            min="0"
                                        />
                                    </td>
                                    <td className="px-4 py-2 text-right font-medium">
                                        {formatCurrency(item.amount)}
                                    </td>
                                    <td className="px-4 py-2 text-center">
                                        {items.length > 1 && (
                                            <button onClick={() => removeItem(idx)} className="text-red-500 hover:text-red-700">
                                                <i className="fas fa-trash"></i>
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <button onClick={addItem} className="mt-2 text-blue-600 hover:text-blue-700 text-sm">
                        <i className="fas fa-plus mr-1"></i> Add Item
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
        </div>
    );
}
