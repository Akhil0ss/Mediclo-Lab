'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ref, get } from 'firebase/database';
import { database } from '@/lib/firebase';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
    PointElement,
    LineElement,
    Filler,
} from 'chart.js';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import { generateAIAnalytics } from '@/lib/groqAI';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
    PointElement,
    LineElement,
    Filler
);

export default function AnalyticsPage() {
    const { user, userProfile } = useAuth();
    const dataSourceId = userProfile?.ownerId || user?.uid || '';
    const [loading, setLoading] = useState(true);
    const [timeframe, setTimeframe] = useState<'daily' | 'weekly' | 'monthly'>('monthly');

    // Core Metrics
    const [metrics, setMetrics] = useState({
        // Patients
        totalPatients: 0,
        newPatientsToday: 0,
        newPatientsThisMonth: 0,
        activePatients: 0,

        // OPD
        totalOPDVisits: 0,
        opdToday: 0,
        opdThisWeek: 0,
        opdThisMonth: 0,
        pendingOPD: 0,
        finalizedOPD: 0,
        avgOPDPerDay: 0,

        // Queue
        tokensToday: 0,
        avgWaitTime: 0,
        completedToday: 0,
        inConsultation: 0,

        // Lab
        totalReports: 0,
        reportsToday: 0,
        reportsThisMonth: 0,
        pendingSamples: 0,
        completedSamples: 0,

        // Appointments
        totalAppointments: 0,
        upcomingAppointments: 0,
        completedAppointments: 0,
        cancelledAppointments: 0,

        // Pharmacy
        totalPrescriptions: 0,
        prescriptionsToday: 0,

        // Doctors
        totalDoctors: 0,
        activeDoctorsToday: 0,

        // Revenue (if applicable)
        totalRevenue: 0,
        revenueToday: 0,
        revenueThisMonth: 0,
        doctorRevenue: 0,
        doctorRevenueToday: 0,
        doctorRevenueThisMonth: 0
    });

    // Charts Data
    const [opdTrendData, setOpdTrendData] = useState<any>(null);
    const [patientGrowthData, setPatientGrowthData] = useState<any>(null);
    const [departmentData, setDepartmentData] = useState<any>(null);
    const [topDoctorsData, setTopDoctorsData] = useState<any[]>([]);
    const [topTestsData, setTopTestsData] = useState<any[]>([]);
    const [showDoctorStatsModal, setShowDoctorStatsModal] = useState(false);
    const [doctorRevenueData, setDoctorRevenueData] = useState<any[]>([]);
    const [doctorStatsFilter, setDoctorStatsFilter] = useState<'weekly' | 'monthly'>('monthly');
    const [aiInsights, setAiInsights] = useState<any>(null);
    const [generatingAI, setGeneratingAI] = useState(false);

    const handleGenerateAI = async () => {
        // Owner only - receptionists cannot access AI analytics
        if (!user || !userProfile || userProfile.role === 'receptionist') return;

        setGeneratingAI(true);
        try {
            const result = await generateAIAnalytics(metrics);
            setAiInsights(result);
        } catch (e) {
            console.error(e);
            setAiInsights({
                summary: "Unable to generate AI insights at this time.",
                highlights: [],
                recommendations: []
            });
        } finally {
            setGeneratingAI(false);
        }
    };

    useEffect(() => {
        if (!user?.uid) {
            setLoading(false);
            return;
        }

        fetchComprehensiveAnalytics();
    }, [user, timeframe]);

    const fetchComprehensiveAnalytics = async () => {
        if (!user?.uid) {
            return;
        }

        const today = new Date().toISOString().split('T')[0];
        const thisMonth = new Date().toISOString().slice(0, 7);
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

        try {
            // Fetch all data without timeout
            const [patientsSnap, opdSnap, reportsSnap, appointmentsSnap, queueSnap, doctorsSnap, invoicesSnap] = await Promise.all([
                get(ref(database, `patients/${dataSourceId}`)),
                get(ref(database, `opd/${dataSourceId}`)),
                get(ref(database, `reports/${dataSourceId}`)),
                get(ref(database, `appointments/${dataSourceId}`)),
                get(ref(database, `opd_queue/${dataSourceId}`)),
                get(ref(database, `doctors/${dataSourceId}`)),
                get(ref(database, `invoices/${dataSourceId}`))
            ]).catch(error => {
                console.error('Error fetching analytics data:', error);
                // Return empty snapshots on error
                return [
                    { exists: () => false, val: () => ({}) },
                    { exists: () => false, val: () => ({}) },
                    { exists: () => false, val: () => ({}) },
                    { exists: () => false, val: () => ({}) },
                    { exists: () => false, val: () => ({}) },
                    { exists: () => false, val: () => ({}) },
                    { exists: () => false, val: () => ({}) }
                ];
            });

            // Process Patients
            const patients = patientsSnap.exists() ? Object.values(patientsSnap.val()) : [];
            const newPatientsToday = patients.filter((p: any) => p.createdAt?.startsWith(today)).length;
            const newPatientsThisMonth = patients.filter((p: any) => p.createdAt?.startsWith(thisMonth)).length;

            // Process OPD
            const opdRecords = opdSnap.exists() ? Object.values(opdSnap.val()) : [];
            const opdToday = opdRecords.filter((o: any) => o.visitDate?.startsWith(today) || o.createdAt?.startsWith(today)).length;
            const opdThisWeek = opdRecords.filter((o: any) => (o.visitDate || o.createdAt) >= oneWeekAgo).length;
            const opdThisMonth = opdRecords.filter((o: any) => (o.visitDate || o.createdAt)?.startsWith(thisMonth)).length;
            const finalizedOPD = opdRecords.filter((o: any) => o.isFinalized).length;
            const pendingOPD = opdRecords.length - finalizedOPD;

            // Process Queue
            const queueData = queueSnap.exists() ? queueSnap.val() : {};
            let tokensToday = 0;
            let completedToday = 0;
            let inConsultation = 0;

            for (const dateKey in queueData) {
                const tokens = Object.values(queueData[dateKey]);
                if (dateKey === today.replace(/-/g, '')) {
                    tokensToday = tokens.length;
                    completedToday = tokens.filter((t: any) => t.status === 'completed').length;
                    inConsultation = tokens.filter((t: any) => t.status === 'in-consultation').length;
                }
            }

            // Process Reports
            const reports = reportsSnap.exists() ? Object.values(reportsSnap.val()) : [];
            const reportsToday = reports.filter((r: any) => r.createdAt?.startsWith(today)).length;
            const reportsThisMonth = reports.filter((r: any) => r.createdAt?.startsWith(thisMonth)).length;

            // Process Samples
            const samples = reportsSnap.exists() ? Object.values(reportsSnap.val()).map((r: any) => r.samples || []).flat() : [];
            const pendingSamples = samples.filter((s: any) => s?.status === 'Pending').length;
            const completedSamples = samples.filter((s: any) => s?.status === 'Completed').length;

            // Process Appointments
            const appointmentsRaw = appointmentsSnap.exists() ? appointmentsSnap.val() : {};
            // Flatten structure: appointments -> date -> appointmentList
            const appointments = Object.values(appointmentsRaw)
                .map((dateObj: any) => Object.values(dateObj))
                .flat();

            const upcomingAppointments = appointments.filter((a: any) => {
                if (!a?.date) return false;
                const aptDate = new Date(a.date);
                return aptDate >= new Date();
            }).length;
            const completedAppointments = appointments.filter((a: any) => a?.status === 'completed').length;
            const cancelledAppointments = appointments.filter((a: any) => a?.status === 'cancelled').length;

            // Process Doctors
            const doctors = doctorsSnap.exists() ? Object.values(doctorsSnap.val()) : [];

            // Process Invoices for Revenue
            const invoices = invoicesSnap.exists() ? Object.values(invoicesSnap.val()) : [];
            const totalRevenue: number = invoices.reduce((sum: number, inv: any) => sum + (parseFloat(inv.total) || 0), 0);
            const revenueToday: number = invoices.filter((inv: any) => inv.createdAt?.startsWith(today)).reduce((sum: number, inv: any) => sum + (parseFloat(inv.total) || 0), 0);
            const revenueThisMonth: number = invoices.filter((inv: any) => inv.createdAt?.startsWith(thisMonth)).reduce((sum: number, inv: any) => sum + (parseFloat(inv.total) || 0), 0);

            // Calculate Doctor Fee Revenue (Internal)
            const doctorFeeRevenue: number = opdRecords.reduce((sum: number, opd: any) => {
                const doctor: any = doctors.find((d: any) => d.id === opd.assignedDoctorId || d.name === opd.doctorName);
                return sum + (parseFloat(doctor?.consultationFee || '0') || 0);
            }, 0);

            const doctorFeeRevenueToday: number = opdRecords
                .filter((opd: any) => (opd.visitDate || opd.createdAt)?.startsWith(today))
                .reduce((sum: number, opd: any) => {
                    const doctor: any = doctors.find((d: any) => d.id === opd.assignedDoctorId || d.name === opd.doctorName);
                    return sum + (parseFloat(doctor?.consultationFee || '0') || 0);
                }, 0);

            const doctorFeeRevenueThisMonth: number = opdRecords
                .filter((opd: any) => (opd.visitDate || opd.createdAt)?.startsWith(thisMonth))
                .reduce((sum: number, opd: any) => {
                    const doctor: any = doctors.find((d: any) => d.id === opd.assignedDoctorId || d.name === opd.doctorName);
                    return sum + (parseFloat(doctor?.consultationFee || '0') || 0);
                }, 0);

            // Process Doctor Stats with Revenue
            const doctorStats: any = {};
            opdRecords.forEach((opd: any) => {
                const docId = opd.consultingDoctorId || opd.consultingDoctor;
                if (docId) {
                    if (!doctorStats[docId]) {
                        const doctor: any = doctors.find((d: any) => d.id === opd.assignedDoctorId || d.name === opd.doctorName || d.name === opd.consultingDoctor);
                        doctorStats[docId] = {
                            name: opd.consultingDoctor || 'Unknown',
                            count: 0,
                            finalized: 0,
                            revenue: 0,
                            consultationFee: parseFloat(doctor?.consultationFee || '0') || 0
                        };
                    }
                    doctorStats[docId].count++;
                    if (opd.isFinalized) doctorStats[docId].finalized++;
                    // Add revenue
                    const doctor: any = doctors.find((d: any) => d.id === opd.assignedDoctorId || d.name === opd.doctorName || d.name === opd.consultingDoctor);
                    doctorStats[docId].revenue += parseFloat(doctor?.consultationFee || '0') || 0;
                }
            });

            // Create detailed doctor revenue data for modal
            const detailedDoctorRevenue = Object.values(doctorStats).map((stat: any) => ({
                ...stat,
                revenueWeekly: 0,
                revenueMonthly: 0
            }));

            // Calculate weekly and monthly revenue per doctor
            opdRecords.forEach((opd: any) => {
                const docId = opd.consultingDoctorId || opd.consultingDoctor;
                if (docId) {
                    const doctor: any = doctors.find((d: any) => d.id === opd.assignedDoctorId || d.name === opd.doctorName || d.name === opd.consultingDoctor);
                    const fee = parseFloat(doctor?.consultationFee || '0') || 0;
                    const doctorStat = detailedDoctorRevenue.find((d: any) => d.name === (opd.consultingDoctor || 'Unknown'));

                    if (doctorStat) {
                        // Weekly
                        if ((opd.visitDate || opd.createdAt) >= oneWeekAgo) {
                            doctorStat.revenueWeekly += fee;
                        }
                        // Monthly
                        if ((opd.visitDate || opd.createdAt)?.startsWith(thisMonth)) {
                            doctorStat.revenueMonthly += fee;
                        }
                    }
                }
            });

            setDoctorRevenueData(detailedDoctorRevenue.sort((a: any, b: any) => b.revenue - a.revenue));

            const topDoctors = Object.values(doctorStats)
                .sort((a: any, b: any) => b.count - a.count)
                .slice(0, 5);

            // Process Test Stats
            const testStats: any = {};
            reports.forEach((report: any) => {
                const testName = report.testName || 'Unknown';
                testStats[testName] = (testStats[testName] || 0) + 1;
            });

            const topTests = Object.entries(testStats)
                .map(([name, count]) => ({ name, count }))
                .sort((a: any, b: any) => b.count - a.count)
                .slice(0, 5);

            // Generate trend data (last 7 days)
            const last7Days: string[] = [];
            for (let i = 6; i >= 0; i--) {
                const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
                last7Days.push(date.toISOString().split('T')[0]);
            }

            const opdTrend = last7Days.map(date =>
                opdRecords.filter((o: any) =>
                    (o.visitDate || o.createdAt)?.startsWith(date)
                ).length
            );

            const reportsTrend = last7Days.map(date =>
                reports.filter((r: any) =>
                    r.createdAt?.startsWith(date)
                ).length
            );

            setOpdTrendData({
                labels: last7Days.map(d => new Date(d).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })),
                datasets: [
                    {
                        label: 'OPD Visits',
                        data: opdTrend,
                        borderColor: 'rgb(99, 102, 241)',
                        backgroundColor: 'rgba(99, 102, 241, 0.1)',
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: 'Lab Reports',
                        data: reportsTrend,
                        borderColor: 'rgb(34, 197, 94)',
                        backgroundColor: 'rgba(34, 197, 94, 0.1)',
                        tension: 0.4,
                        fill: true
                    }
                ]
            });

            setDepartmentData({
                labels: ['OPD', 'Lab', 'Pharmacy'],
                datasets: [{
                    data: [opdRecords.length, reports.length, finalizedOPD],
                    backgroundColor: [
                        'rgba(99, 102, 241, 0.8)',
                        'rgba(34, 197, 94, 0.8)',
                        'rgba(251, 146, 60, 0.8)'
                    ],
                    borderWidth: 0
                }]
            });

            setTopDoctorsData(topDoctors);
            setTopTestsData(topTests);

            // Set all metrics
            setMetrics({
                totalPatients: patients.length,
                newPatientsToday,
                newPatientsThisMonth,
                activePatients: patients.filter((p: any) => {
                    const hasRecentVisit = opdRecords.some((o: any) =>
                        o.patientId === p.id && (o.visitDate || o.createdAt) >= oneWeekAgo
                    );
                    return hasRecentVisit;
                }).length,

                totalOPDVisits: opdRecords.length,
                opdToday,
                opdThisWeek,
                opdThisMonth,
                pendingOPD,
                finalizedOPD,
                avgOPDPerDay: opdRecords.length > 0 ? (opdRecords.length / 30).toFixed(1) as any : 0,

                tokensToday,
                avgWaitTime: 0, // Can calculate from queue data
                completedToday,
                inConsultation,

                totalReports: reports.length,
                reportsToday,
                reportsThisMonth,
                pendingSamples: 0, // From samples node
                completedSamples: reports.length,

                totalAppointments: appointments.length,
                upcomingAppointments,
                completedAppointments,
                cancelledAppointments,

                totalPrescriptions: finalizedOPD,
                prescriptionsToday: opdRecords.filter((o: any) =>
                    o.isFinalized && (o.visitDate || o.createdAt)?.startsWith(today)
                ).length,

                totalDoctors: doctors.length,
                activeDoctorsToday: new Set(opdRecords
                    .filter((o: any) => (o.visitDate || o.createdAt)?.startsWith(today))
                    .map((o: any) => o.consultingDoctorId)
                ).size,

                totalRevenue: totalRevenue as number,
                revenueToday: revenueToday as number,
                revenueThisMonth: revenueThisMonth as number,
                doctorRevenue: doctorFeeRevenue as number,
                doctorRevenueToday: doctorFeeRevenueToday as number,
                doctorRevenueThisMonth: doctorFeeRevenueThisMonth as number
            });

        } catch (error) {
            console.error('Error fetching analytics:', error);
        }
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="text-center md:text-left">
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
                        <i className="fas fa-chart-line text-blue-600 mr-3"></i>
                        Comprehensive Analytics
                    </h1>
                    <p className="text-gray-600 mt-1">Complete hospital performance metrics & insights</p>
                </div>

                {/* Timeframe Selector */}
                <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 justify-center md:justify-end">
                    <button
                        onClick={handleGenerateAI}
                        disabled={generatingAI}
                        className="px-4 py-2 rounded-lg font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:shadow-lg transition flex items-center gap-2 whitespace-nowrap disabled:opacity-70"
                    >
                        {generatingAI ? (
                            <><i className="fas fa-spinner fa-spin"></i> Analyzing...</>
                        ) : (
                            <><i className="fas fa-robot"></i> AI Insights</>
                        )}
                    </button>
                    {['today', 'week', 'month', 'all'].map((tf) => (
                        <button
                            key={tf}
                            onClick={() => setTimeframe(tf as any)}
                            className={`px-4 py-2 rounded-lg font-semibold capitalize transition whitespace-nowrap ${timeframe === tf
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            {tf}
                        </button>
                    ))}
                </div>
            </div>




            {/* AI Insights Card (Owner Only) */}
            {
                aiInsights && userProfile?.role !== 'receptionist' && (
                    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg shadow-md border border-indigo-100 p-4 animate-fadeIn">
                        <h2 className="text-lg font-bold text-indigo-900 mb-3 flex items-center gap-2">
                            <i className="fas fa-lightbulb text-yellow-500"></i>
                            AI Business Insights
                        </h2>

                        <div className="text-gray-700 font-medium mb-4 italic p-3 bg-white/50 rounded-lg border border-indigo-50">
                            "{aiInsights.summary}"
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-white/60 rounded-lg p-3 border border-indigo-50">
                                <h3 className="font-bold text-green-700 mb-2 text-sm uppercase flex items-center gap-2">
                                    <i className="fas fa-chart-line"></i> Key Highlights
                                </h3>
                                <ul className="space-y-2">
                                    {aiInsights.highlights?.map((h: string, i: number) => (
                                        <li key={i} className="text-sm flex items-start gap-2">
                                            <i className="fas fa-check-circle text-green-500 mt-0.5"></i>
                                            <span className="text-gray-700">{h}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div className="bg-white/60 rounded-lg p-3 border border-indigo-50">
                                <h3 className="font-bold text-blue-700 mb-2 text-sm uppercase flex items-center gap-2">
                                    <i className="fas fa-bullseye"></i> Recommendations
                                </h3>
                                <ul className="space-y-2">
                                    {aiInsights.recommendations?.map((r: string, i: number) => (
                                        <li key={i} className="text-sm flex items-start gap-2">
                                            <i className="fas fa-arrow-circle-right text-blue-500 mt-0.5"></i>
                                            <span className="text-gray-700">{r}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Quick Stats Overview - COMPACT */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-4 rounded-lg shadow text-center">
                    <i className="fas fa-users text-2xl opacity-80 mb-1"></i>
                    <h3 className="text-3xl font-bold">{metrics.totalPatients}</h3>
                    <p className="text-blue-100 text-xs">Patients</p>
                    <p className="text-white/80 text-xs mt-1">+{metrics.newPatientsToday} today</p>
                </div>

                <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-4 rounded-lg shadow text-center">
                    <i className="fas fa-stethoscope text-2xl opacity-80 mb-1"></i>
                    <h3 className="text-3xl font-bold">{metrics.totalOPDVisits}</h3>
                    <p className="text-purple-100 text-xs">Consultations</p>
                    <p className="text-white/80 text-xs mt-1">{metrics.opdToday} today</p>
                </div>

                <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-4 rounded-lg shadow text-center">
                    <i className="fas fa-flask text-2xl opacity-80 mb-1"></i>
                    <h3 className="text-3xl font-bold">{metrics.totalReports}</h3>
                    <p className="text-green-100 text-xs">Lab Reports</p>
                    <p className="text-white/80 text-xs mt-1">{metrics.reportsToday} today</p>
                </div>

                <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-4 rounded-lg shadow text-center">
                    <i className="fas fa-calendar-check text-2xl opacity-80 mb-1"></i>
                    <h3 className="text-3xl font-bold">{metrics.totalAppointments}</h3>
                    <p className="text-orange-100 text-xs">Appointments</p>
                    <p className="text-white/80 text-xs mt-1">{metrics.upcomingAppointments} upcoming</p>
                </div>
            </div>

            {/* Revenue Stats Card - Lab + Doctors (Single Line) */}
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-lg shadow-lg p-6">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <i className="fas fa-rupee-sign"></i>
                    Revenue Analytics
                </h2>

                <div className="grid grid-cols-6 gap-3">
                    {/* Lab Revenue - 3 cards */}
                    <div className="text-center p-3 bg-white/20 rounded-lg backdrop-blur-sm">
                        <p className="text-xs opacity-80 mb-1">💊 Lab Total</p>
                        <p className="text-lg font-bold">₹{metrics.totalRevenue.toLocaleString('en-IN')}</p>
                    </div>
                    <div className="text-center p-3 bg-white/20 rounded-lg backdrop-blur-sm">
                        <p className="text-xs opacity-80 mb-1">💊 Today</p>
                        <p className="text-lg font-bold">₹{metrics.revenueToday.toLocaleString('en-IN')}</p>
                    </div>
                    <div className="text-center p-3 bg-white/20 rounded-lg backdrop-blur-sm">
                        <p className="text-xs opacity-80 mb-1">💊 Month</p>
                        <p className="text-lg font-bold">₹{metrics.revenueThisMonth.toLocaleString('en-IN')}</p>
                    </div>

                    {/* Doctor Revenue - 3 cards */}
                    <div className="text-center p-3 bg-white/20 rounded-lg backdrop-blur-sm">
                        <p className="text-xs opacity-80 mb-1">👨‍⚕️ Dr Total</p>
                        <p className="text-lg font-bold">₹{metrics.doctorRevenue.toLocaleString('en-IN')}</p>
                    </div>
                    <div className="text-center p-3 bg-white/20 rounded-lg backdrop-blur-sm">
                        <p className="text-xs opacity-80 mb-1">👨‍⚕️ Today</p>
                        <p className="text-lg font-bold">₹{metrics.doctorRevenueToday.toLocaleString('en-IN')}</p>
                    </div>
                    <div className="text-center p-3 bg-white/20 rounded-lg backdrop-blur-sm">
                        <p className="text-xs opacity-80 mb-1">👨‍⚕️ Month</p>
                        <p className="text-lg font-bold">₹{metrics.doctorRevenueThisMonth.toLocaleString('en-IN')}</p>
                    </div>
                </div>
            </div>

            {/* OPD Metrics Grid - COMPACT */}
            <div className="bg-white rounded-lg shadow p-4">
                <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                    <i className="fas fa-hospital text-purple-600"></i>
                    OPD Performance
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="text-center p-3 bg-purple-50 rounded-lg">
                        <p className="text-xs text-gray-600 font-semibold mb-1">Today</p>
                        <p className="text-2xl font-bold text-purple-600">{metrics.opdToday}</p>
                    </div>
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                        <p className="text-xs text-gray-600 font-semibold mb-1">Week</p>
                        <p className="text-2xl font-bold text-blue-600">{metrics.opdThisWeek}</p>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                        <p className="text-xs text-gray-600 font-semibold mb-1">Finalized</p>
                        <p className="text-3xl font-bold text-green-600">{metrics.finalizedOPD}</p>
                    </div>
                    <div className="text-center p-4 bg-yellow-50 rounded-lg">
                        <p className="text-sm text-gray-600 font-semibold mb-1">Pending</p>
                        <p className="text-3xl font-bold text-yellow-600">{metrics.pendingOPD}</p>
                    </div>
                    <div className="text-center p-4 bg-indigo-50 rounded-lg">
                        <p className="text-sm text-gray-600 font-semibold mb-1">Avg/Day</p>
                        <p className="text-3xl font-bold text-indigo-600">{metrics.avgOPDPerDay}</p>
                    </div>
                    <div className="text-center p-4 bg-pink-50 rounded-lg">
                        <p className="text-sm text-gray-600 font-semibold mb-1">In Consultation</p>
                        <p className="text-3xl font-bold text-pink-600">{metrics.inConsultation}</p>
                    </div>
                    <div className="text-center p-4 bg-teal-50 rounded-lg">
                        <p className="text-sm text-gray-600 font-semibold mb-1">Tokens Today</p>
                        <p className="text-3xl font-bold text-teal-600">{metrics.tokensToday}</p>
                    </div>
                    <div className="text-center p-4 bg-cyan-50 rounded-lg">
                        <p className="text-sm text-gray-600 font-semibold mb-1">Completed Today</p>
                        <p className="text-3xl font-bold text-cyan-600">{metrics.completedToday}</p>
                    </div>
                </div>
            </div>


            {/* TOP ROW: 4 Stats + Top Doctors + Top Tests - ALL INLINE */}
            <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                {/* Patient Metrics */}
                <div className="bg-white rounded-lg shadow p-3">
                    <h3 className="text-xs font-bold text-gray-800 mb-2 flex items-center gap-1">
                        <i className="fas fa-user-friends text-blue-600 text-sm"></i>
                        Patients
                    </h3>
                    <div className="space-y-1.5">
                        <div className="flex justify-between items-center p-1.5 bg-blue-50 rounded text-xs">
                            <span className="text-gray-700">Total</span>
                            <span className="font-bold text-blue-600">{metrics.totalPatients}</span>
                        </div>
                        <div className="flex justify-between items-center p-1.5 bg-green-50 rounded text-xs">
                            <span className="text-gray-700">Today</span>
                            <span className="font-bold text-green-600">{metrics.newPatientsToday}</span>
                        </div>
                        <div className="flex justify-between items-center p-1.5 bg-purple-50 rounded text-xs">
                            <span className="text-gray-700">Month</span>
                            <span className="font-bold text-purple-600">{metrics.newPatientsThisMonth}</span>
                        </div>
                    </div>
                </div>

                {/* Appointment Metrics */}
                <div className="bg-white rounded-lg shadow p-3">
                    <h3 className="text-xs font-bold text-gray-800 mb-2 flex items-center gap-1">
                        <i className="fas fa-calendar-alt text-orange-600 text-sm"></i>
                        Appointments
                    </h3>
                    <div className="space-y-1.5">
                        <div className="flex justify-between items-center p-1.5 bg-gray-50 rounded text-xs">
                            <span className="text-gray-700">Total</span>
                            <span className="font-bold text-gray-800">{metrics.totalAppointments}</span>
                        </div>
                        <div className="flex justify-between items-center p-1.5 bg-blue-50 rounded text-xs">
                            <span className="text-gray-700">Upcoming</span>
                            <span className="font-bold text-blue-600">{metrics.upcomingAppointments}</span>
                        </div>
                        <div className="flex justify-between items-center p-1.5 bg-green-50 rounded text-xs">
                            <span className="text-gray-700">Done</span>
                            <span className="font-bold text-green-600">{metrics.completedAppointments}</span>
                        </div>
                    </div>
                </div>

                {/* Lab Metrics */}
                <div className="bg-white rounded-lg shadow p-3">
                    <h3 className="text-xs font-bold text-gray-800 mb-2 flex items-center gap-1">
                        <i className="fas fa-microscope text-green-600 text-sm"></i>
                        Laboratory
                    </h3>
                    <div className="space-y-1.5">
                        <div className="flex justify-between items-center p-1.5 bg-green-50 rounded text-xs">
                            <span className="text-gray-700">Reports</span>
                            <span className="font-bold text-green-600">{metrics.totalReports}</span>
                        </div>
                        <div className="flex justify-between items-center p-1.5 bg-blue-50 rounded text-xs">
                            <span className="text-gray-700">Today</span>
                            <span className="font-bold text-blue-600">{metrics.reportsToday}</span>
                        </div>
                        <div className="flex justify-between items-center p-1.5 bg-purple-50 rounded text-xs">
                            <span className="text-gray-700">Month</span>
                            <span className="font-bold text-purple-600">{metrics.reportsThisMonth}</span>
                        </div>
                    </div>
                </div>

                {/* Pharmacy Metrics */}
                <div className="bg-white rounded-lg shadow p-3">
                    <h3 className="text-xs font-bold text-gray-800 mb-2 flex items-center gap-1">
                        <i className="fas fa-pills text-pink-600 text-sm"></i>
                        Pharmacy
                    </h3>
                    <div className="space-y-1.5">
                        <div className="flex justify-between items-center p-1.5 bg-pink-50 rounded text-xs">
                            <span className="text-gray-700">Rx Total</span>
                            <span className="font-bold text-pink-600">{metrics.totalOPDVisits}</span>
                        </div>
                        <div className="flex justify-between items-center p-1.5 bg-purple-50 rounded text-xs">
                            <span className="text-gray-700">Finalized</span>
                            <span className="font-bold text-purple-600">{metrics.finalizedOPD}</span>
                        </div>
                        <div className="flex justify-between items-center p-1.5 bg-blue-50 rounded text-xs">
                            <span className="text-gray-700">Doctors</span>
                            <span className="font-bold text-blue-600">{metrics.totalDoctors}</span>
                        </div>
                    </div>
                </div>

                {/* Top Doctors */}
                <div className="bg-white rounded-lg shadow p-3">
                    <h3 className="text-xs font-bold text-gray-800 mb-2 flex items-center justify-between">
                        <span className="flex items-center gap-1">
                            <i className="fas fa-trophy text-yellow-500 text-sm"></i>
                            Top Doctors
                        </span>
                        <button
                            onClick={() => setShowDoctorStatsModal(true)}
                            className="text-xs text-blue-600 hover:text-blue-800 font-semibold hover:underline"
                        >
                            View All →
                        </button>
                    </h3>
                    <div className="space-y-1.5">
                        {topDoctorsData.slice(0, 3).map((doc: any, idx) => (
                            <div key={idx} className="flex items-center justify-between p-1.5 bg-gray-50 rounded text-xs">
                                <div className="flex items-center gap-2">
                                    <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-white text-xs ${idx === 0 ? 'bg-yellow-500' : idx === 1 ? 'bg-gray-400' : 'bg-orange-600'}`}>
                                        {idx + 1}
                                    </span>
                                    <span className="font-semibold text-gray-800">{doc.name}</span>
                                </div>
                                <span className="font-bold text-blue-600">{doc.count}</span>
                            </div>
                        ))}
                        {topDoctorsData.length === 0 && (
                            <p className="text-center text-gray-500 py-2 text-xs">No data</p>
                        )}
                    </div>
                </div>

                {/* Top Tests */}
                <div className="bg-white rounded-lg shadow p-3">
                    <h3 className="text-xs font-bold text-gray-800 mb-2 flex items-center gap-1">
                        <i className="fas fa-chart-bar text-green-500 text-sm"></i>
                        Top Tests
                    </h3>
                    <div className="space-y-1.5">
                        {topTestsData.slice(0, 3).map((test: any, idx) => (
                            <div key={idx} className="flex items-center justify-between p-1.5 bg-gray-50 rounded text-xs">
                                <div className="flex items-center gap-2">
                                    <span className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center font-bold text-white text-xs">
                                        {idx + 1}
                                    </span>
                                    <span className="font-semibold text-gray-800">{test.name}</span>
                                </div>
                                <span className="font-bold text-green-600">{test.count}</span>
                            </div>
                        ))}
                        {topTestsData.length === 0 && (
                            <p className="text-center text-gray-500 py-2 text-xs">No data</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Analytics Summary + Charts - 3 COLUMNS INLINE */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Analytics Summary as Pie Chart */}
                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-lg shadow p-4">
                    <h3 className="text-sm font-bold mb-3 text-center">📊 Summary</h3>
                    <div className="grid grid-cols-2 gap-2 text-center">
                        <div className="bg-white/20 rounded p-2">
                            <p className="text-xs opacity-90">Patients</p>
                            <p className="text-lg font-bold">{metrics.totalPatients}</p>
                        </div>
                        <div className="bg-white/20 rounded p-2">
                            <p className="text-xs opacity-90">OPD</p>
                            <p className="text-lg font-bold">{metrics.totalOPDVisits}</p>
                        </div>
                        <div className="bg-white/20 rounded p-2">
                            <p className="text-xs opacity-90">Reports</p>
                            <p className="text-lg font-bold">{metrics.totalReports}</p>
                        </div>
                        <div className="bg-white/20 rounded p-2">
                            <p className="text-xs opacity-90">Appts</p>
                            <p className="text-lg font-bold">{metrics.totalAppointments}</p>
                        </div>
                    </div>
                </div>

                {/* 7-Day Trend Chart */}
                <div className="bg-white rounded-lg shadow p-4">
                    <h3 className="text-sm font-bold text-gray-800 mb-2">7-Day Trend</h3>
                    {opdTrendData && (
                        <Line
                            data={opdTrendData}
                            options={{
                                responsive: true,
                                maintainAspectRatio: true,
                                aspectRatio: 2.5,
                                plugins: {
                                    legend: { display: false }
                                },
                                scales: {
                                    y: { beginAtZero: true, ticks: { font: { size: 9 } } },
                                    x: { ticks: { font: { size: 9 } } }
                                }
                            }}
                        />
                    )}
                </div>

                {/* Department Distribution Donut */}
                <div className="bg-white rounded-lg shadow p-4">
                    <h3 className="text-sm font-bold text-gray-800 mb-2">Departments</h3>
                    {departmentData && (
                        <Doughnut
                            data={departmentData}
                            options={{
                                responsive: true,
                                maintainAspectRatio: true,
                                aspectRatio: 2.5,
                                plugins: {
                                    legend: { position: 'bottom', labels: { font: { size: 9 }, boxWidth: 10, padding: 8 } }
                                }
                            }}
                        />
                    )}
                </div>
            </div>

            {/* Doctor Stats Modal */}
            {
                showDoctorStatsModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
                            {/* Modal Header */}
                            <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-2xl font-bold flex items-center gap-2">
                                        <i className="fas fa-user-md"></i>
                                        Doctor Revenue Stats
                                    </h2>
                                    <button
                                        onClick={() => setShowDoctorStatsModal(false)}
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
                                {doctorRevenueData.length === 0 ? (
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
                )
            }
        </div >
    );
}
