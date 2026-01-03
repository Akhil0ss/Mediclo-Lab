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
    const [timeframe, setTimeframe] = useState<'today' | 'week' | 'month'>('month');

    // Lab Core Metrics
    const [metrics, setMetrics] = useState({
        // Patients
        totalPatients: 0,
        newPatients: 0,

        // Lab
        totalReports: 0,
        reportsGenerated: 0, // based on timeframe
        pendingSamples: 0,

        // Revenue
        totalRevenue: 0,
        revenueCollection: 0, // based on timeframe
        outstandingDues: 0,
    });

    // Charts & Lists Data
    const [reportsTrendData, setReportsTrendData] = useState<any>(null);
    const [topTestsData, setTopTestsData] = useState<any[]>([]);
    const [topDoctorsData, setTopDoctorsData] = useState<any[]>([]);
    const [recentActivity, setRecentActivity] = useState<any[]>([]);

    const [aiInsights, setAiInsights] = useState<any>(null);
    const [generatingAI, setGeneratingAI] = useState(false);

    const handleGenerateAI = async () => {
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
        fetchLabAnalytics();
    }, [user, timeframe]);

    const fetchLabAnalytics = async () => {
        if (!user?.uid) return;

        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];

        // Calculate start date based on timeframe
        let startDate = new Date();
        if (timeframe === 'today') {
            startDate = now;
        } else if (timeframe === 'week') {
            startDate.setDate(now.getDate() - 7);
        } else if (timeframe === 'month') {
            startDate.setDate(now.getDate() - 30);
        }
        const startDateStr = startDate.toISOString().split('T')[0];

        // Helper to check if date satisfies timeframe
        const isInTimeframe = (dateStr: string) => {
            if (!dateStr) return false;
            const itemDate = dateStr.split('T')[0];
            if (timeframe === 'today') return itemDate === todayStr;
            return itemDate >= startDateStr && itemDate <= todayStr;
        };

        try {
            const [patientsSnap, reportsSnap, invoicesSnap] = await Promise.all([
                get(ref(database, `patients/${dataSourceId}`)),
                get(ref(database, `reports/${dataSourceId}`)),
                get(ref(database, `invoices/${dataSourceId}`))
            ]).catch(error => {
                console.error('Error fetching analytics data:', error);
                return [
                    { exists: () => false, val: () => ({}) },
                    { exists: () => false, val: () => ({}) },
                    { exists: () => false, val: () => ({}) }
                ];
            });

            // --- Process Patients ---
            const patients = patientsSnap.exists() ? Object.values(patientsSnap.val()) : [];
            const newPatients = patients.filter((p: any) => isInTimeframe(p.createdAt)).length;

            // --- Process Reports ---
            const reports = reportsSnap.exists() ? Object.values(reportsSnap.val()) : [];
            // Sort reports by date desc for Recent Activity
            const sortedReports = reports.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

            const reportsGenerated = reports.filter((r: any) => isInTimeframe(r.createdAt)).length;
            const pendingSamples = reports.filter((r: any) => r.status === 'Pending' || r.status === 'processing').length;

            // Test Stats
            const testStats: Record<string, number> = {};
            reports.forEach((r: any) => {
                const name = r.testName || 'Unknown';
                testStats[name] = (testStats[name] || 0) + 1;
            });
            const topTests = Object.entries(testStats)
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5);
            setTopTestsData(topTests);

            // Ref Doctor Stats
            const docStats: Record<string, number> = {};
            reports.forEach((r: any) => {
                const doc = r.patientRefDoctor || 'Self';
                docStats[doc] = (docStats[doc] || 0) + 1;
            });
            const topDoctors = Object.entries(docStats)
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5);
            setTopDoctorsData(topDoctors);

            // Recent Activity
            setRecentActivity(sortedReports.slice(0, 5));

            // --- Process Revenue ---
            const invoices: any[] = invoicesSnap.exists() ? Object.values(invoicesSnap.val()) : [];
            const totalRevenue = invoices.reduce((sum, inv) => sum + (parseFloat(inv.total) || 0), 0);
            const revenueCollection = invoices
                .filter((inv: any) => isInTimeframe(inv.createdAt))
                .reduce((sum, inv) => sum + (parseFloat(inv.total) || 0), 0);
            const outstandingDues = invoices.reduce((sum, inv) => sum + (parseFloat(inv.due) || 0), 0);

            // --- Trend Chart (Last 7 Days Fixed for visual consistence or dynamic for timeframe?) ---
            // Let's stick to a dynamic trend based on the last 7 days regardless of filter, or match filter? 
            // Matching filter is better. If month -> daily breakdown. If week -> daily. If today -> hourly (too complex).
            // Let's do Last 7 Days always for the chart for simplicity and consistency.
            const chartLabels: string[] = [];
            const chartData: number[] = [];
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dStr = d.toISOString().split('T')[0];
                chartLabels.push(d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }));
                chartData.push(reports.filter((r: any) => r.createdAt?.startsWith(dStr)).length);
            }

            setReportsTrendData({
                labels: chartLabels,
                datasets: [{
                    label: 'Reports Generated',
                    data: chartData,
                    borderColor: 'rgb(99, 102, 241)', // Indigo 500
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            });

            setMetrics({
                totalPatients: patients.length,
                newPatients,
                totalReports: reports.length,
                reportsGenerated,
                pendingSamples,
                totalRevenue,
                revenueCollection,
                outstandingDues
            });
            setLoading(false);

        } catch (error) {
            console.error('Error fetching lab analytics:', error);
            setLoading(false);
        }
    };

    return (
        <div className="p-6 space-y-8 animate-in fade-in duration-500 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="text-center md:text-left">
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-800 tracking-tight">
                        Lab Overview
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">Real-time performance metrics</p>
                </div>

                <div className="flex bg-white p-1 rounded-xl border border-gray-200 shadow-sm">
                    {(['today', 'week', 'month'] as const).map((tf) => (
                        <button
                            key={tf}
                            onClick={() => setTimeframe(tf)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize ${timeframe === tf
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'text-gray-500 hover:bg-gray-50'
                                }`}
                        >
                            {tf}
                        </button>
                    ))}
                </div>
            </div>

            {/* Core Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                {/* Revenue Card */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition pointer-events-none">
                        <i className="fas fa-rupee-sign text-6xl text-indigo-600"></i>
                    </div>
                    <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Revenue ({timeframe})</p>
                    <h3 className="text-3xl font-bold text-gray-900">₹{metrics.revenueCollection.toLocaleString('en-IN')}</h3>
                    <div className="flex items-center gap-2 mt-4 text-xs font-medium">
                        <span className="text-red-500 bg-red-50 px-2 py-1 rounded-full">
                            Due: ₹{metrics.outstandingDues.toLocaleString('en-IN')}
                        </span>
                        <span className="text-gray-400">Total: ₹{metrics.totalRevenue.toLocaleString('en-IN')}</span>
                    </div>
                </div>

                {/* Reports Card */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition pointer-events-none">
                        <i className="fas fa-file-medical-alt text-6xl text-blue-600"></i>
                    </div>
                    <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Reports ({timeframe})</p>
                    <h3 className="text-3xl font-bold text-gray-900">{metrics.reportsGenerated}</h3>
                    <div className="flex items-center gap-2 mt-4 text-xs font-medium">
                        <span className="text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                            Total: {metrics.totalReports}
                        </span>
                    </div>
                </div>

                {/* Patients Card */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition pointer-events-none">
                        <i className="fas fa-users text-6xl text-purple-600"></i>
                    </div>
                    <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">New Patients ({timeframe})</p>
                    <h3 className="text-3xl font-bold text-gray-900">{metrics.newPatients}</h3>
                    <div className="flex items-center gap-2 mt-4 text-xs font-medium">
                        <span className="text-purple-600 bg-purple-50 px-2 py-1 rounded-full">
                            Database: {metrics.totalPatients}
                        </span>
                    </div>
                </div>

                {/* Pending Card */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition pointer-events-none">
                        <i className="fas fa-clock text-6xl text-yellow-500"></i>
                    </div>
                    <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Pending Processing</p>
                    <h3 className="text-3xl font-bold text-gray-900">{metrics.pendingSamples}</h3>
                    <div className="flex items-center gap-2 mt-4 text-xs font-medium">
                        <span className="text-yellow-600 bg-yellow-50 px-2 py-1 rounded-full animate-pulse">
                            Action Required
                        </span>
                    </div>
                </div>
            </div>

            {/* AI Insights Button & Display */}
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold text-gray-800">Business Intelligence</h3>
                    <button
                        onClick={handleGenerateAI}
                        disabled={generatingAI}
                        className="px-4 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-gray-900 to-gray-800 text-white hover:shadow-lg transition flex items-center gap-2 disabled:opacity-70"
                    >
                        {generatingAI ? <><i className="fas fa-circle-notch fa-spin"></i> Analyzing Data...</> : <><i className="fas fa-sparkles text-yellow-400"></i> Generate AI Insights</>}
                    </button>
                </div>

                {aiInsights && (
                    <div className="bg-gradient-to-br from-indigo-900 to-purple-900 rounded-2xl p-6 text-white shadow-xl animate-in slide-in-from-top-4">
                        <div className="flex items-start gap-4">
                            <div className="bg-white/10 p-3 rounded-full backdrop-blur-sm">
                                <i className="fas fa-robot text-2xl"></i>
                            </div>
                            <div className="flex-1">
                                <h4 className="font-bold text-lg mb-2">AI Analysis Report</h4>
                                <p className="text-indigo-200 italic mb-6 text-sm leading-relaxed">"{aiInsights.summary}"</p>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
                                        <h5 className="font-bold text-green-300 text-xs uppercase mb-3"><i className="fas fa-chart-line mr-2"></i>Key Highlights</h5>
                                        <ul className="space-y-2">
                                            {aiInsights.highlights?.map((h: string, i: number) => (
                                                <li key={i} className="text-sm text-indigo-50 flex items-start gap-2">
                                                    <i className="fas fa-check mt-1 text-green-400"></i> {h}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                    <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
                                        <h5 className="font-bold text-blue-300 text-xs uppercase mb-3"><i className="fas fa-lightbulb mr-2"></i>Strategic Suggestions</h5>
                                        <ul className="space-y-2">
                                            {aiInsights.recommendations?.map((r: string, i: number) => (
                                                <li key={i} className="text-sm text-indigo-50 flex items-start gap-2">
                                                    <i className="fas fa-arrow-right mt-1 text-blue-400"></i> {r}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Main Trend Chart */}
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <h3 className="font-bold text-gray-800 mb-6">Test Volume (Last 7 Days)</h3>
                    <div className="h-[300px]">
                        {reportsTrendData && <Line data={reportsTrendData} options={{ maintainAspectRatio: false, scales: { y: { beginAtZero: true, grid: { color: '#f3f4f6' } }, x: { grid: { display: false } } }, plugins: { legend: { display: false } } }} />}
                    </div>
                </div>

                {/* Top Tests Donut/List */}
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col">
                    <h3 className="font-bold text-gray-800 mb-6">Popular Tests</h3>
                    <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                        {topTestsData.map((test, i) => (
                            <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition">
                                <div className="flex items-center gap-3">
                                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-200 text-gray-600'}`}>#{i + 1}</span>
                                    <span className="font-medium text-gray-700 text-sm truncate max-w-[120px]" title={test.name}>{test.name}</span>
                                </div>
                                <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md text-xs">{test.count}</span>
                            </div>
                        ))}
                        {topTestsData.length === 0 && <p className="text-center text-gray-400 text-sm py-10">No tests recorded yet</p>}
                    </div>
                </div>
            </div>

            {/* Bottom Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Referring Doctors */}
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-gray-800">Top Referring Doctors</h3>
                        <span className="text-xs font-medium text-purple-600 bg-purple-50 px-2 py-1 rounded-full">Most Referrals</span>
                    </div>
                    <div className="space-y-4">
                        {topDoctorsData.map((doc, i) => (
                            <div key={i} className="flex items-center justify-between group">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-100 transition">
                                        <i className="fas fa-user-md"></i>
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-gray-800">{doc.name}</p>
                                        <p className="text-xs text-gray-400">Rank #{i + 1}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="block font-bold text-gray-900">{doc.count}</span>
                                    <span className="text-[10px] text-gray-400 uppercase">Referrals</span>
                                </div>
                            </div>
                        ))}
                        {topDoctorsData.length === 0 && <p className="text-center text-gray-400 text-sm py-10">No doctor data available</p>}
                    </div>
                </div>

                {/* Recent Reports Log */}
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-gray-800">Recent Activity</h3>
                        <button onClick={() => window.location.href = '/dashboard/reports'} className="text-xs font-semibold text-blue-600 hover:text-blue-700">View All</button>
                    </div>
                    <div className="space-y-4">
                        {recentActivity.map((report, i) => (
                            <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-gray-50 hover:border-gray-100 hover:bg-gray-50 transition cursor-pointer">
                                <div className="flex items-center gap-3">
                                    <div className={`w-2 h-10 rounded-full ${report.status === 'Completed' ? 'bg-green-500' : report.status === 'Pending' ? 'bg-yellow-500' : 'bg-gray-300'}`}></div>
                                    <div>
                                        <p className="text-sm font-bold text-gray-800">{report.patientName}</p>
                                        <p className="text-xs text-gray-500 flex items-center gap-1">
                                            <i className="fas fa-flask text-[10px]"></i> {report.testName}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${report.status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                        {report.status}
                                    </span>
                                    <p className="text-[10px] text-gray-400 mt-1">{new Date(report.createdAt).toLocaleDateString()}</p>
                                </div>
                            </div>
                        ))}
                        {recentActivity.length === 0 && <p className="text-center text-gray-400 text-sm py-10">No recent activity</p>}
                    </div>
                </div>
            </div>
        </div>
    );
}
