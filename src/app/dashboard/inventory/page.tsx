'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { database } from '@/lib/firebase';
import { ref, onValue, push, remove, update } from 'firebase/database';
import { useToast } from '@/contexts/ToastContext';

interface InventoryItem {
    id: string;
    name: string;
    quantity: number;
    unit: string;
    minLevel: number;
    supplier?: string;
    lastUpdated: string;
}

export default function InventoryPage() {
    const { user, userProfile } = useAuth();
    const { showToast } = useToast();
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [newItem, setNewItem] = useState({ name: '', quantity: 0, unit: 'kits', minLevel: 10, supplier: '' });
    const [isAdding, setIsAdding] = useState(false);

    useEffect(() => {
        if (!user || !userProfile) return;
        const ownerId = userProfile.ownerId || user.uid;
        const inventoryRef = ref(database, `inventory/${ownerId}`);

        const unsub = onValue(inventoryRef, (snapshot) => {
            const data: InventoryItem[] = [];
            snapshot.forEach(child => {
                data.push({ id: child.key, ...child.val() });
            });
            setItems(data);
            setLoading(false);
        });

        return () => unsub();
    }, [user, userProfile]);

    const handleAddItem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !userProfile) return;

        try {
            const ownerId = userProfile.ownerId || user.uid;
            await push(ref(database, `inventory/${ownerId}`), {
                ...newItem,
                lastUpdated: new Date().toISOString()
            });
            setNewItem({ name: '', quantity: 0, unit: 'kits', minLevel: 10, supplier: '' });
            setIsAdding(false);
            showToast('Item added to inventory', 'success');
        } catch (err) {
            console.error(err);
            showToast('Failed to add item', 'error');
        }
    };

    const handleDelete = async (itemId: string) => {
        if (!confirm('Delete this item?')) return;
        const ownerId = userProfile.ownerId || user.uid;
        await remove(ref(database, `inventory/${ownerId}/${itemId}`));
        showToast('Item deleted', 'success');
    };

    const handleUpdateQuantity = async (itemId: string, newQty: number) => {
        const ownerId = userProfile.ownerId || user.uid;
        await update(ref(database, `inventory/${ownerId}/${itemId}`), {
            quantity: newQty,
            lastUpdated: new Date().toISOString()
        });
    };

    if (loading) return <div className="p-8 text-center">Loading inventory...</div>;

    return (
        <div className="bg-white rounded-xl shadow-lg p-6 min-h-[500px]">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">
                    <i className="fas fa-boxes text-blue-600 mr-2"></i>
                    Inventory Management
                </h1>
                <button
                    onClick={() => setIsAdding(!isAdding)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold shadow-sm transition-all"
                >
                    <i className={`fas ${isAdding ? 'fa-times' : 'fa-plus'} mr-2`}></i>
                    {isAdding ? 'Cancel' : 'Add Item'}
                </button>
            </div>

            {/* Add Item Form */}
            {isAdding && (
                <form onSubmit={handleAddItem} className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                    <div className="lg:col-span-2">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Item Name</label>
                        <input
                            type="text"
                            placeholder="e.g. Glucose Kits"
                            value={newItem.name}
                            onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                            className="w-full p-2 border rounded-lg"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Quantity</label>
                        <input
                            type="number"
                            value={newItem.quantity}
                            onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 0 })}
                            className="w-full p-2 border rounded-lg"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Min Level</label>
                        <input
                            type="number"
                            value={newItem.minLevel}
                            onChange={(e) => setNewItem({ ...newItem, minLevel: parseInt(e.target.value) || 0 })}
                            className="w-full p-2 border rounded-lg"
                            required
                        />
                    </div>
                    <button type="submit" className="bg-green-600 text-white p-2 rounded-lg font-bold hover:bg-green-700">
                        Save
                    </button>
                </form>
            )}

            {/* Inventory Table */}
            {items.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                    <p className="text-gray-400">No items in inventory. Add one to get started.</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold border-b">
                            <tr>
                                <th className="px-4 py-2">Item Name</th>
                                <th className="px-4 py-2">Status</th>
                                <th className="px-4 py-2 text-center">Quantity</th>
                                <th className="px-4 py-2">Last Updated</th>
                                <th className="px-4 py-2 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {items.map(item => {
                                const isLow = item.quantity <= item.minLevel;
                                return (
                                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-2 font-medium text-gray-800">{item.name}</td>
                                        <td className="px-4 py-2">
                                            {isLow ? (
                                                <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-bold border border-red-200">
                                                    Low Stock
                                                </span>
                                            ) : (
                                                <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-bold border border-green-200">
                                                    In Stock
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-2 flex items-center justify-center gap-2">
                                            <button
                                                onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                                                className="w-6 h-6 rounded bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-gray-700 text-xs"
                                            >
                                                <i className="fas fa-minus"></i>
                                            </button>
                                            <span className={`w-12 text-center font-bold ${isLow ? 'text-red-600' : 'text-gray-800'}`}>
                                                {item.quantity}
                                            </span>
                                            <button
                                                onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                                                className="w-6 h-6 rounded bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-gray-700 text-xs"
                                            >
                                                <i className="fas fa-plus"></i>
                                            </button>
                                        </td>
                                        <td className="px-4 py-2 text-xs text-gray-500">
                                            {new Date(item.lastUpdated).toLocaleDateString()}
                                        </td>
                                        <td className="px-4 py-2 text-right">
                                            <button
                                                onClick={() => handleDelete(item.id)}
                                                className="text-gray-400 hover:text-red-600 transition-colors"
                                            >
                                                <i className="fas fa-trash"></i>
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
