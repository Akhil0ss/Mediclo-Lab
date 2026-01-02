'use client';

import { useState, useEffect } from 'react';
import { ref, get } from 'firebase/database';
import { database } from '@/lib/firebase';

interface DoctorStatsModalProps {
    isOpen: boolean;
    onClose: () => void;
    ownerId: string;
    doctors: any[];
}

export default function DoctorStatsModal({ isOpen, onClose, ownerId, doctors }: DoctorStatsModalProps) {
    const [doctorRevenueData, setDoctorRevenueData] = useState<any[]>([]);
    const [doctorStatsFilter, setDoctorStatsFilter] = useState<'weekly' | 'monthly'>('monthly');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isOpen || !ownerId) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch all OPD visits for accurate stats
                const snapshot = await get(ref(database, `opd/${ownerId}`));
                if (snapshot.exists()) {
                    const opdList: any[] = [];
                    snapshot.forEach(child => {
                        opdList.push(child.val());
                    });
                    calculateStats(opdList);
                } else {
                    setDoctorRevenueData([]);
                }
            } catch (error) {
                console.error('Error fetching doctor stats:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [isOpen, ownerId]);

    const calculateStats = (opdVisits: any[]) => {
        if (!opdVisits.length || !doctors.length) return;

        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const thisMonth = new Date().toISOString().slice(0, 7);

        const doctorStats: any = {};

        opdVisits.forEach((opd: any) => {
            const docId = opd.assignedDoctorId || opd.consultingDoctorId;
            const docName = opd.doctorName || opd.consultingDoctor || 'Unknown';

            if (docId) {
                if (!doctorStats[docId]) {
                    const doctor: any = doctors.find((d: any) => d.id === docId || d.name === docName);
                    doctorStats[docId] = {
                        name: docName,
                        count: 0,
                        revenue: 0,
                        revenueWeekly: 0,
                        revenueMonthly: 0,
                        consultationFee: parseFloat(doctor?.consultationFee || '0') || 0
                    };
                }

                const doctor: any = doctors.find((d: any) => d.id === docId || d.name === docName);
                const fee = parseFloat(doctor?.consultationFee || '0') || 0;

                doctorStats[docId].count++;
                doctorStats[docId].revenue += fee;

                // Weekly
                if ((opd.visitDate || opd.createdAt) >= oneWeekAgo) {
                    doctorStats[docId].revenueWeekly += fee;
                }

                // Monthly
                const opdDate = (opd.visitDate || opd.createdAt || '').slice(0, 7);
                if (opdDate === thisMonth) {
                    doctorStats[docId].revenueMonthly += fee;
                }
            }
        });

        setDoctorRevenueData(Object.values(doctorStats));
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden">
                {/* Modal Header */}
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-2xl font-bold flex items-center gap-2">
                            <i className="fas fa-user-md"></i>
                            Doctor Revenue Stats
                        </h2>
                        <button
                            onClick={onClose}
                            className="text-white hover:text-gray-200 text-2xl"
                        >
                            ×
                        </button>
                    </div>

                    {/* Filter Buttons */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => setDoctorStatsFilter('weekly')}
                            className={`px-4 py-2 rounded-lg font-semibold transition-all ${doctorStatsFilter === 'weekly'
                                ? 'bg-white text-blue-600'
                                : 'bg-blue-500 text-white hover:bg-blue-400'
                                }`}
                        >
                            Weekly
                        </button>
                        <button
                            onClick={() => setDoctorStatsFilter('monthly')}
                            className={`px-4 py-2 rounded-lg font-semibold transition-all ${doctorStatsFilter === 'monthly'
                                ? 'bg-white text-blue-600'
                                : 'bg-blue-500 text-white hover:bg-blue-400'
                                }`}
                        >
                            Monthly
                        </button>
                    </div>
                </div>

                {/* Modal Body */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
                    {loading ? (
                        <div className="text-center py-8">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                            <p>Loading revenue data...</p>
                        </div>
                    ) : doctorRevenueData.length === 0 ? (
                        <p className="text-center text-gray-500 py-8">No doctor data available</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-100 sticky top-0">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">#</th>
                                        <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Doctor Name</th>
                                        <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Consultations</th>
                                        <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Fee/Visit</th>
                                        <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">
                                            {doctorStatsFilter === 'weekly' ? 'Weekly Revenue' : 'Monthly Revenue'}
                                        </th>
                                        <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">Total Revenue</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {doctorRevenueData.map((doctor: any, idx: number) => (
                                        <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-4 py-3 text-sm text-gray-600">{idx + 1}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-xs ${idx === 0 ? 'bg-yellow-500' :
                                                        idx === 1 ? 'bg-gray-400' :
                                                            idx === 2 ? 'bg-orange-600' :
                                                                'bg-blue-500'
                                                        }`}>
                                                        {doctor.name.charAt(0).toUpperCase()}
                                                    </span>
                                                    <span className="font-semibold text-gray-800">{doctor.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="inline-block bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-semibold">
                                                    {doctor.count}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center text-sm text-gray-600">
                                                ₹{doctor.consultationFee.toLocaleString('en-IN')}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <span className="font-bold text-green-600">
                                                    ₹{(doctorStatsFilter === 'weekly'
                                                        ? doctor.revenueWeekly
                                                        : doctor.revenueMonthly
                                                    ).toLocaleString('en-IN')}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <span className="font-bold text-blue-600 text-lg">
                                                    ₹{doctor.revenue.toLocaleString('en-IN')}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-gray-100 font-bold">
                                    <tr>
                                        <td colSpan={4} className="px-4 py-3 text-right text-gray-800">Total:</td>
                                        <td className="px-4 py-3 text-right text-green-600">
                                            ₹{doctorRevenueData.reduce((sum: number, d: any) =>
                                                sum + (doctorStatsFilter === 'weekly' ? d.revenueWeekly : d.revenueMonthly), 0
                                            ).toLocaleString('en-IN')}
                                        </td>
                                        <td className="px-4 py-3 text-right text-blue-600 text-lg">
                                            ₹{doctorRevenueData.reduce((sum: number, d: any) => sum + d.revenue, 0).toLocaleString('en-IN')}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
