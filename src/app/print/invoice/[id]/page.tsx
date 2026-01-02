'use client';

import { useSearchParams } from 'next/navigation';
import { formatCurrency } from '@/lib/billingCalculator';
import { useEffect, useState } from 'react';

export default function InvoicePrintPage() {
    const searchParams = useSearchParams();
    const [invoiceData, setInvoiceData] = useState<any>(null);

    useEffect(() => {
        const data = searchParams.get('data');
        if (data) {
            setInvoiceData(JSON.parse(decodeURIComponent(data)));
        }
    }, [searchParams]);

    if (!invoiceData) return <div className="p-8 text-center">Loading...</div>;

    return (
        <div className="max-w-4xl mx-auto p-8 bg-white">
            {/* Header */}
            <div className="text-center mb-8 pb-6 border-b-2">
                <h1 className="text-3xl font-bold text-gray-800">INVOICE</h1>
                <p className="text-gray-600 mt-2">Invoice #: {invoiceData.invoiceNumber}</p>
                <p className="text-sm text-gray-500">Date: {new Date(invoiceData.createdAt).toLocaleDateString('en-IN')}</p>
            </div>

            {/* Patient Info */}
            <div className="mb-8">
                <h3 className="font-bold text-gray-700 mb-2">Bill To:</h3>
                <p className="text-lg font-semibold">{invoiceData.patientName}</p>
                <p className="text-sm text-gray-600">Patient ID: {invoiceData.patientId}</p>
            </div>

            {/* Items Table */}
            <table className="w-full mb-8">
                <thead className="bg-gray-100">
                    <tr>
                        <th className="px-4 py-3 text-left">Service/Item</th>
                        <th className="px-4 py-3 text-center">Qty</th>
                        <th className="px-4 py-3 text-right">Rate</th>
                        <th className="px-4 py-3 text-right">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    {invoiceData.items.map((item: any, idx: number) => (
                        <tr key={idx} className="border-b">
                            <td className="px-4 py-3">{item.name}</td>
                            <td className="px-4 py-3 text-center">{item.quantity}</td>
                            <td className="px-4 py-3 text-right">{formatCurrency(item.rate)}</td>
                            <td className="px-4 py-3 text-right font-medium">{formatCurrency(item.amount)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Totals */}
            <div className="flex justify-end mb-8">
                <div className="w-64 space-y-2">
                    <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span>{formatCurrency(invoiceData.subtotal)}</span>
                    </div>
                    {invoiceData.discount > 0 && (
                        <div className="flex justify-between text-green-600">
                            <span>Discount ({invoiceData.discountPercent}%):</span>
                            <span>- {formatCurrency(invoiceData.discount)}</span>
                        </div>
                    )}
                    <div className="flex justify-between">
                        <span>Taxable Amount:</span>
                        <span>{formatCurrency(invoiceData.taxableAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>GST (18%):</span>
                        <span>{formatCurrency(invoiceData.gst)}</span>
                    </div>
                    <div className="flex justify-between text-xl font-bold border-t-2 pt-2">
                        <span>Total:</span>
                        <span>{formatCurrency(invoiceData.total)}</span>
                    </div>
                    <div className="flex justify-between text-blue-600">
                        <span>Paid ({invoiceData.paymentMode}):</span>
                        <span>{formatCurrency(invoiceData.paid)}</span>
                    </div>
                    {invoiceData.due > 0 && (
                        <div className="flex justify-between text-red-600 font-bold">
                            <span>Due:</span>
                            <span>{formatCurrency(invoiceData.due)}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="text-center text-sm text-gray-500 mt-12 pt-6 border-t">
                <p>Thank you for your business!</p>
                <p className="mt-2">This is a computer-generated invoice.</p>
            </div>

            {/* Print Button */}
            <div className="text-center mt-8 no-print">
                <button onClick={() => window.print()} className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700">
                    <i className="fas fa-print mr-2"></i>
                    Print Invoice
                </button>
            </div>

            <style jsx global>{`
                @media print {
                    .no-print { display: none; }
                    body { margin: 0; padding: 20px; }
                }
            `}</style>
        </div>
    );
}
