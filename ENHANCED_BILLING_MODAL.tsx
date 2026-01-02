// Enhanced Billing Modal Component
// Replace the existing billing modal (lines 995-1023) with this code

{/* Enhanced Billing Modal */ }
<Modal isOpen={showBillingModal} onClose={() => { setShowBillingModal(false); setSelectedTests([]); setSelectedDoctor(''); setTestSearch(''); setDoctorSearch(''); }}>
    <h3 className="text-xl font-bold mb-4">Generate Bill - {billingPatient?.name}</h3>
    <div className="space-y-4 max-h-[70vh] overflow-y-auto">
        {/* Quick Add Sections */}
        <div className="grid grid-cols-2 gap-3 pb-3 border-b">
            {/* Lab Tests Multiselect */}
            <div>
                <label className="text-sm font-bold mb-1 block">Lab Tests</label>
                <input
                    type="text"
                    placeholder="Search tests..."
                    value={testSearch}
                    onChange={(e) => setTestSearch(e.target.value)}
                    className="w-full px-2 py-1 border rounded text-sm mb-2"
                />
                <div className="border rounded max-h-32 overflow-y-auto bg-gray-50 p-2 space-y-1">
                    {templates
                        .filter(t => t.testName?.toLowerCase().includes(testSearch.toLowerCase()))
                        .slice(0, 10)
                        .map(t => (
                            <label key={t.id} className="flex items-center gap-2 text-sm hover:bg-white p-1 rounded cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={selectedTests.includes(t.id)}
                                    onChange={(e) => {
                                        if (e.target.checked) {
                                            setSelectedTests([...selectedTests, t.id]);
                                            const newItem = createBillingItem(t.testName, 1, parseFloat(t.price) || 0);
                                            setBillingItems([...billingItems.filter(i => i.name), newItem]);
                                        } else {
                                            setSelectedTests(selectedTests.filter(id => id !== t.id));
                                            setBillingItems(billingItems.filter(i => i.name !== t.testName));
                                        }
                                    }}
                                    className="w-4 h-4"
                                />
                                <span className="flex-1">{t.testName}</span>
                                <span className="text-xs text-gray-500">₹{t.price || 0}</span>
                            </label>
                        ))}
                    {templates.filter(t => t.testName?.toLowerCase().includes(testSearch.toLowerCase())).length === 0 &&
                        <p className="text-xs text-gray-400 text-center py-2">No tests found</p>
                    }
                </div>
            </div>

            {/* Doctor Fee Dropdown */}
            <div>
                <label className="text-sm font-bold mb-1 block">Doctor Consultation</label>
                <input
                    type="text"
                    placeholder="Search doctor..."
                    value={doctorSearch}
                    onChange={(e) => setDoctorSearch(e.target.value)}
                    className="w-full px-2 py-1 border rounded text-sm mb-2"
                />
                <div className="border rounded max-h-32 overflow-y-auto bg-gray-50 p-2 space-y-1">
                    {doctors
                        .filter(d => d.name?.toLowerCase().includes(doctorSearch.toLowerCase()))
                        .slice(0, 10)
                        .map(d => (
                            <label key={d.id} className="flex items-center gap-2 text-sm hover:bg-white p-1 rounded cursor-pointer">
                                <input
                                    type="radio"
                                    name="doctor"
                                    checked={selectedDoctor === d.id}
                                    onChange={() => {
                                        setSelectedDoctor(d.id);
                                        // Remove existing doctor fee
                                        const existing = billingItems.find(i => i.name.includes('Dr.'));
                                        if (existing) {
                                            setBillingItems(billingItems.filter(i => !i.name.includes('Dr.')));
                                        }
                                        // Add new doctor fee
                                        const newItem = createBillingItem(`Dr. ${d.name} - Consultation`, 1, parseFloat(d.consultationFee) || 500);
                                        setBillingItems([...billingItems.filter(i => i.name), newItem]);
                                    }}
                                    className="w-4 h-4"
                                />
                                <span className="flex-1">Dr. {d.name}</span>
                                <span className="text-xs text-gray-500">₹{d.consultationFee || 500}</span>
                            </label>
                        ))}
                    {doctors.filter(d => d.name?.toLowerCase().includes(doctorSearch.toLowerCase())).length === 0 &&
                        <p className="text-xs text-gray-400 text-center py-2">No doctors found</p>
                    }
                </div>
            </div>
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
                                    placeholder="Service name"
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
                                {billingItems.filter(i => i.name).length > 1 && (
                                    <button
                                        onClick={() => {
                                            const itemName = billingItems[i].name;
                                            setBillingItems(billingItems.filter((_, idx) => idx !== i));
                                            // Clear selections if deleted
                                            if (itemName.includes('Dr.')) setSelectedDoctor('');
                                            const test = templates.find(t => t.testName === itemName);
                                            if (test) setSelectedTests(selectedTests.filter(id => id !== test.id));
                                        }}
                                        className="text-red-500 text-sm"
                                    >
                                        <i className="fas fa-trash"></i>
                                    </button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <button
                onClick={() => setBillingItems([...billingItems, createBillingItem('', 1, 0)])}
                className="text-blue-600 text-sm mt-2"
            >
                <i className="fas fa-plus mr-1"></i>Add Custom Item
            </button>
        </div>

        {/* Payment Details */}
        <div className="grid grid-cols-2 gap-4 pt-3 border-t">
            <div className="space-y-2">
                <div>
                    <label className="text-sm font-medium">Discount (%)</label>
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
                    <label className="text-sm font-medium">Payment Mode</label>
                    <select
                        value={paymentMode}
                        onChange={(e) => setPaymentMode(e.target.value)}
                        className="w-full px-3 py-2 border rounded"
                    >
                        <option>Cash</option>
                        <option>Card</option>
                        <option>UPI</option>
                        <option>Cheque</option>
                    </select>
                </div>
                <div>
                    <label className="text-sm font-medium">Paid</label>
                    <input
                        type="number"
                        value={paid}
                        onChange={(e) => setPaid(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border rounded"
                        min="0"
                    />
                </div>
            </div>
            <div className="bg-gray-50 p-3 rounded space-y-1 text-sm">
                {(() => {
                    const b = calculateBilling(billingItems.filter(i => i.name), discount, 18, paid);
                    return (
                        <>
                            <div className="flex justify-between">
                                <span>Subtotal:</span>
                                <span>{formatCurrency(b.subtotal)}</span>
                            </div>
                            {b.discount > 0 && (
                                <div className="flex justify-between text-green-600">
                                    <span>Discount:</span>
                                    <span>- {formatCurrency(b.discount)}</span>
                                </div>
                            )}
                            <div className="flex justify-between">
                                <span>GST (18%):</span>
                                <span>{formatCurrency(b.gst)}</span>
                            </div>
                            <div className="flex justify-between font-bold text-lg border-t pt-1">
                                <span>Total:</span>
                                <span>{formatCurrency(b.total)}</span>
                            </div>
                            <div className="flex justify-between text-blue-600">
                                <span>Paid:</span>
                                <span>{formatCurrency(b.paid)}</span>
                            </div>
                            {b.due > 0 && (
                                <div className="flex justify-between text-red-600 font-bold">
                                    <span>Due:</span>
                                    <span>{formatCurrency(b.due)}</span>
                                </div>
                            )}
                        </>
                    );
                })()}
            </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
            <button
                onClick={() => {
                    setShowBillingModal(false);
                    setSelectedTests([]);
                    setSelectedDoctor('');
                }}
                className="px-4 py-2 border rounded hover:bg-gray-50"
            >
                Cancel
            </button>
            <button
                onClick={async () => {
                    if (!user || !billingPatient) return;
                    const b = calculateBilling(billingItems.filter(i => i.name), discount, 18, paid);
                    const invNum = generateInvoiceNumber('INV', Date.now());
                    const invData = {
                        invoiceNumber: invNum,
                        patientId: billingPatient.id,
                        patientName: billingPatient.name,
                        ...b,
                        paymentMode,
                        createdAt: new Date().toISOString(),
                        createdBy: user.uid
                    };
                    await push(ref(database, `invoices/${user.uid}`), invData);
                    window.open(`/print/invoice/${invNum}?data=${encodeURIComponent(JSON.stringify(invData))}`, '_blank');
                    setShowBillingModal(false);
                    setSelectedTests([]);
                    setSelectedDoctor('');
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
                <i className="fas fa-print mr-2"></i>Save & Print
            </button>
        </div>
    </div>
</Modal>
