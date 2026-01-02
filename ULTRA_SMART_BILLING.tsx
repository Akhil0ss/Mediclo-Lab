// Ultra-Smart Billing Modal - Auto-loads today's visits
// Replace billing modal in patients/page.tsx (lines 999-1027)

{/* Ultra-Smart Billing Modal */ }
<Modal isOpen={showBillingModal} onClose={() => { setShowBillingModal(false); setBillingItems([createBillingItem('', 1, 0)]); }}>
    <h3 className="text-xl font-bold mb-4">Generate Bill - {billingPatient?.name}</h3>
    <div className="space-y-4">
        {/* Visit Date Selector */}
        <div>
            <label className="text-sm font-bold mb-1 block">Select Visit Date</label>
            <select
                className="w-full px-3 py-2 border rounded"
                defaultValue={new Date().toISOString().split('T')[0]}
                onChange={(e) => {
                    const selectedDate = e.target.value;

                    // Get OPD visits for this date
                    const dateOpdVisits = opdVisits.filter(v =>
                        v.patientId === billingPatient?.id &&
                        v.visitDate?.startsWith(selectedDate)
                    );

                    // Get Lab reports for this date
                    const dateReports = reports.filter(r =>
                        r.patientId === billingPatient?.id &&
                        r.createdAt?.startsWith(selectedDate)
                    );

                    // Auto-create billing items
                    const newItems = [];

                    // Add OPD consultations
                    dateOpdVisits.forEach(visit => {
                        const doctor = doctors.find(d => d.id === visit.assignedDoctorId || d.name === visit.doctorName);
                        const fee = parseFloat(doctor?.consultationFee) || 500;
                        newItems.push(createBillingItem(`Dr. ${visit.doctorName} - Consultation`, 1, fee));
                    });

                    // Add Lab tests
                    dateReports.forEach(report => {
                        const template = templates.find(t => t.id === report.templateId);
                        if (template) {
                            const price = parseFloat(template.price) || 0;
                            newItems.push(createBillingItem(template.testName, 1, price));
                        }
                    });

                    setBillingItems(newItems.length > 0 ? newItems : [createBillingItem('', 1, 0)]);
                }}
            >
                {/* Today's date first */}
                <option value={new Date().toISOString().split('T')[0]}>
                    Today - {new Date().toLocaleDateString('en-IN')}
                </option>

                {/* Patient's visit dates */}
                {(() => {
                    const visitDates = new Set();

                    // Collect OPD visit dates
                    opdVisits
                        .filter(v => v.patientId === billingPatient?.id)
                        .forEach(v => {
                            if (v.visitDate) {
                                const date = v.visitDate.split('T')[0];
                                if (date !== new Date().toISOString().split('T')[0]) {
                                    visitDates.add(date);
                                }
                            }
                        });

                    // Collect Lab report dates
                    reports
                        .filter(r => r.patientId === billingPatient?.id)
                        .forEach(r => {
                            if (r.createdAt) {
                                const date = r.createdAt.split('T')[0];
                                if (date !== new Date().toISOString().split('T')[0]) {
                                    visitDates.add(date);
                                }
                            }
                        });

                    // Sort dates descending (newest first)
                    return Array.from(visitDates)
                        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
                        .map(date => (
                            <option key={date} value={date}>
                                {new Date(date).toLocaleDateString('en-IN', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric'
                                })}
                            </option>
                        ));
                })()}
            </select>
            <p className="text-xs text-gray-500 mt-1">
                {billingItems.filter(i => i.name).length > 0
                    ? `${billingItems.filter(i => i.name).length} items loaded`
                    : 'No visits found for this date'}
            </p>
        </div>

        {/* Items Table */}
        <div>
            <table className="w-full text-sm">
                <thead className="bg-gray-100">
                    <tr>
                        <th className="px-2 py-2 text-left">Item</th>
                        <th className="px-2 py-2 w-16">Qty</th>
                        <th className="px-2 py-2 w-24">Rate</th>
                        <th className="px-2 py-2 w-24">Amount</th>
                        <th className="w-8"></th>
                    </tr>
                </thead>
                <tbody>
                    {billingItems.filter(i => i.name).map((item, i) => (
                        <tr key={i} className="border-b">
                            <td className="px-2 py-2">
                                <input
                                    type="text"
                                    value={item.name}
                                    onChange={(e) => {
                                        const n = [...billingItems];
                                        n[i].name = e.target.value;
                                        setBillingItems(n);
                                    }}
                                    className="w-full px-2 py-1 border rounded text-sm"
                                />
                            </td>
                            <td className="px-2 py-2">
                                <input
                                    type="number"
                                    value={item.quantity}
                                    onChange={(e) => {
                                        const n = [...billingItems];
                                        n[i].quantity = parseFloat(e.target.value) || 0;
                                        n[i].amount = n[i].quantity * n[i].rate;
                                        setBillingItems(n);
                                    }}
                                    className="w-full px-2 py-1 border rounded text-center text-sm"
                                    min="1"
                                />
                            </td>
                            <td className="px-2 py-2">
                                <input
                                    type="number"
                                    value={item.rate}
                                    onChange={(e) => {
                                        const n = [...billingItems];
                                        n[i].rate = parseFloat(e.target.value) || 0;
                                        n[i].amount = n[i].quantity * n[i].rate;
                                        setBillingItems(n);
                                    }}
                                    className="w-full px-2 py-1 border rounded text-right text-sm"
                                    min="0"
                                />
                            </td>
                            <td className="px-2 py-2 text-right font-medium text-sm">
                                {formatCurrency(item.amount)}
                            </td>
                            <td className="px-2 py-2">
                                <button
                                    onClick={() => setBillingItems(billingItems.filter((_, idx) => idx !== i))}
                                    className="text-red-500 text-sm"
                                >
                                    <i className="fas fa-trash"></i>
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <button
                onClick={() => setBillingItems([...billingItems, createBillingItem('', 1, 0)])}
                className="text-blue-600 text-sm mt-2"
            >
                <i className="fas fa-plus mr-1"></i>Add Item
            </button>
        </div>

        {/* Payment Details */}
        <div className="grid grid-cols-2 gap-4 pt-3 border-t">
            <div className="space-y-2">
                <div><label className="text-sm font-medium">Discount (%)</label><input type="number" value={discount} onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 border rounded" min="0" max="100" /></div>
                <div><label className="text-sm font-medium">Payment Mode</label><select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)} className="w-full px-3 py-2 border rounded"><option>Cash</option><option>Card</option><option>UPI</option><option>Cheque</option></select></div>
                <div><label className="text-sm font-medium">Paid</label><input type="number" value={paid} onChange={(e) => setPaid(parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 border rounded" min="0" /></div>
            </div>
            <div className="bg-gray-50 p-3 rounded space-y-1 text-sm">
                {(() => { const b = calculateBilling(billingItems.filter(i => i.name), discount, 18, paid); return (<><div className="flex justify-between"><span>Subtotal:</span><span>{formatCurrency(b.subtotal)}</span></div>{b.discount > 0 && <div className="flex justify-between text-green-600"><span>Discount:</span><span>- {formatCurrency(b.discount)}</span></div>}<div className="flex justify-between"><span>GST (18%):</span><span>{formatCurrency(b.gst)}</span></div><div className="flex justify-between font-bold text-lg border-t pt-1"><span>Total:</span><span>{formatCurrency(b.total)}</span></div><div className="flex justify-between text-blue-600"><span>Paid:</span><span>{formatCurrency(b.paid)}</span></div>{b.due > 0 && <div className="flex justify-between text-red-600 font-bold"><span>Due:</span><span>{formatCurrency(b.due)}</span></div>}</>); })()}
            </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
            <button onClick={() => setShowBillingModal(false)} className="px-4 py-2 border rounded hover:bg-gray-50">Cancel</button>
            <button onClick={async () => { if (!user || !billingPatient) return; const b = calculateBilling(billingItems.filter(i => i.name), discount, 18, paid); const invNum = generateInvoiceNumber('INV', Date.now()); const invData = { invoiceNumber: invNum, patientId: billingPatient.id, patientName: billingPatient.name, items: billingItems.filter(i => i.name), ...b, paymentMode, createdAt: new Date().toISOString(), createdBy: user.uid }; await push(ref(database, `invoices/${user.uid}`), invData); window.open(`/print/invoice/${invNum}?data=${encodeURIComponent(JSON.stringify(invData))}`, '_blank'); setShowBillingModal(false); }} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"><i className="fas fa-print mr-2"></i>Save & Print</button>
        </div>
    </div>
</Modal>
