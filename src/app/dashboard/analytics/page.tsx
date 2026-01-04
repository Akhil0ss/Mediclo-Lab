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

    // Lab Core Metrics with Growth
    const [metrics, setMetrics] = useState({
        revenue: { value: 0, growth: 0 },
        reports: { value: 0, growth: 0 },
        patients: { value: 0, growth: 0 },
        avgTAT: { value: 0, unit: 'hrs' },
        pending: 0,
        totalRevenue: 0,
        outstanding: 0
    });

    // Charts & Lists Data
    const [trendData, setTrendData] = useState<any>(null);
    const [categoryData, setCategoryData] = useState<any>(null);
    const [topTestsData, setTopTestsData] = useState<any[]>([]);
    const [topRevenueTests, setTopRevenueTests] = useState<any[]>([]);
    const [topTestsChartData, setTopTestsChartData] = useState<any>(null);
    const [topDoctorsData, setTopDoctorsData] = useState<any[]>([]);
    const [doctorPage, setDoctorPage] = useState(1);
    const docsPerPage = 5;
    const [paymentStats, setPaymentStats] = useState<any[]>([]);
    const [genderStats, setGenderStats] = useState<any>({ Male: 0, Female: 0, Other: 0 });

    const [aiInsights, setAiInsights] = useState<any>(null);
    const [generatingAI, setGeneratingAI] = useState(false);

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
        const getDatesForTimeframe = (tf: string) => {
            const end = new Date();
            const start = new Date();
            const prevStart = new Date();
            const prevEnd = new Date();

            if (tf === 'today') {
                start.setHours(0, 0, 0, 0);
                prevStart.setDate(start.getDate() - 1);
                prevStart.setHours(0, 0, 0, 0);
                prevEnd.setHours(0, 0, 0, 0);
                prevEnd.setMilliseconds(-1);
            } else if (tf === 'week') {
                start.setDate(now.getDate() - 7);
                prevStart.setDate(start.getDate() - 7);
                prevEnd.setDate(start.getDate());
            } else {
                start.setDate(now.getDate() - 30);
                prevStart.setDate(start.getDate() - 30);
                prevEnd.setDate(start.getDate());
            }
            return { start, end, prevStart, prevEnd };
        };

        const { start, end, prevStart, prevEnd } = getDatesForTimeframe(timeframe);

        try {
            const results = await Promise.all([
                get(ref(database, `patients/${dataSourceId}`)),
                get(ref(database, `reports/${dataSourceId}`)),
                get(ref(database, `invoices/${dataSourceId}`)),
                get(ref(database, `samples/${dataSourceId}`)),
                get(ref(database, `doctors/${dataSourceId}`)),
                get(ref(database, `externalDoctors/${dataSourceId}`)),
                get(ref(database, `templates/${dataSourceId}`))
            ]);

            const patientsSnap = results[0];
            const reportsSnap = results[1];
            const invoicesSnap = results[2];
            const samplesSnap = results[3];
            const doctorsSnap = results[4];
            const externalDoctorsSnap = results[5];
            const templatesSnap = results[6];

            const patients = patientsSnap.exists() ? Object.values(patientsSnap.val()) : [];
            const reports = reportsSnap.exists() ? Object.values(reportsSnap.val()) : [];
            const invoices: any[] = invoicesSnap.exists() ? Object.values(invoicesSnap.val()) : [];
            const samples = samplesSnap.exists() ? Object.values(samplesSnap.val()) : [];
            const templates = templatesSnap.exists() ? Object.values(templatesSnap.val()) : [];

            const filterByRange = (data: any[], s: Date, e: Date) =>
                data.filter(item => {
                    const d = new Date(item.createdAt);
                    return d >= s && d <= e;
                });

            // Current Period Data
            const currPatients = filterByRange(patients, start, end);
            const currReports = filterByRange(reports, start, end);
            const currInvoices = filterByRange(invoices, start, end);

            // Previous Period Data (for growth)
            const prevPatients = filterByRange(patients, prevStart, prevEnd);
            const prevReports = filterByRange(reports, prevStart, prevEnd);
            const prevInvoices = filterByRange(invoices, prevStart, prevEnd);

            const calculateGrowth = (curr: number, prev: number) => {
                if (prev === 0) return curr > 0 ? 100 : 0;
                return Math.round(((curr - prev) / prev) * 100);
            };

            const currRevenue = currInvoices.reduce((sum, inv) => sum + (parseFloat(inv.total) || 0), 0);
            const prevRevenue = prevInvoices.reduce((sum, inv) => sum + (parseFloat(inv.total) || 0), 0);

            // Turnaround Time (TAT) Calculation
            const completedSamples = samples.filter((s: any) => s.status === 'Completed' && s.completedAt && s.createdAt);
            let totalTATMinutes = 0;
            completedSamples.forEach((s: any) => {
                const created = new Date(s.createdAt).getTime();
                const completed = new Date(s.completedAt).getTime();
                totalTATMinutes += (completed - created) / (1000 * 60);
            });
            const avgTATMinutes = completedSamples.length > 0 ? totalTATMinutes / completedSamples.length : 0;
            const avgTATHours = (avgTATMinutes / 60).toFixed(1);

            // Test Popularity & Revenue Stats
            const testStats: Record<string, { count: number; revenue: number }> = {};

            // From Reports (Count)
            reports.forEach((r: any) => {
                const name = r.testName || 'Unknown';
                if (!testStats[name]) testStats[name] = { count: 0, revenue: 0 };
                testStats[name].count += 1;
            });

            // From Invoices (Revenue)
            invoices.forEach((inv: any) => {
                if (inv.items && Array.isArray(inv.items)) {
                    inv.items.forEach((item: any) => {
                        const name = item.name || 'Unknown';
                        if (!testStats[name]) testStats[name] = { count: 0, revenue: 0 };
                        testStats[name].revenue += (parseFloat(item.price) || 0);
                    });
                }
            });

            const sortedTestsByCount = Object.entries(testStats)
                .map(([name, s]) => ({ name, ...s }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5);

            const sortedTestsByRevenue = Object.entries(testStats)
                .map(([name, s]) => ({ name, ...s }))
                .sort((a, b) => b.revenue - a.revenue)
                .slice(0, 5);

            setTopTestsData(sortedTestsByCount);
            setTopRevenueTests(sortedTestsByRevenue);

            // Charts
            const chartLabels: string[] = [];
            const volData: number[] = [];
            const revData: number[] = [];
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dStr = d.toISOString().split('T')[0];
                chartLabels.push(d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }));
                volData.push(reports.filter((r: any) => r.createdAt?.startsWith(dStr)).length);
                revData.push(invoices.filter((inv: any) => inv.createdAt?.startsWith(dStr)).reduce((sum, inv) => sum + (parseFloat(inv.total) || 0), 0));
            }

            setTrendData({
                labels: chartLabels,
                datasets: [
                    {
                        label: 'Revenue (₹)',
                        data: revData,
                        borderColor: 'rgb(34, 197, 94)',
                        backgroundColor: 'rgba(34, 197, 94, 0.1)',
                        yAxisID: 'y1',
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: 'Volume (Reports)',
                        data: volData,
                        borderColor: 'rgb(59, 130, 246)',
                        backgroundColor: 'transparent',
                        yAxisID: 'y',
                        tension: 0.4,
                        borderDash: [5, 5]
                    }
                ]
            });

            setTopTestsChartData({
                labels: sortedTestsByCount.map(t => t.name),
                datasets: [{
                    data: sortedTestsByCount.map(t => t.count),
                    backgroundColor: ['#6366f1', '#a855f7', '#ec4899', '#f97316', '#22c55e'],
                    borderWidth: 0
                }]
            });

            // Category/Department Stats
            const templateMap: Record<string, string> = {};
            templates.forEach((t: any) => {
                if (t.name && t.category) templateMap[t.name] = t.category;
            });

            const catRevenue: Record<string, number> = {};
            reports.forEach((r: any) => {
                const category = r.category || templateMap[r.testName] || 'Others';
                const rDate = r.createdAt?.slice(0, 10);
                const invoice = invoices.find(inv => inv.patientId === r.patientId && inv.createdAt?.startsWith(rDate));
                if (invoice) {
                    const rev = (parseFloat(invoice.total) || 0);
                    const dayReportsCount = reports.filter((rep: any) => rep.patientId === r.patientId && rep.createdAt?.startsWith(rDate)).length;
                    catRevenue[category] = (catRevenue[category] || 0) + (rev / (dayReportsCount || 1));
                }
            });

            setCategoryData({
                labels: Object.keys(catRevenue).slice(0, 5),
                datasets: [{
                    label: 'Revenue by Dept',
                    data: Object.values(catRevenue).slice(0, 5),
                    backgroundColor: ['#6366f1', '#8b5cf6', '#d946ef', '#f43f5e', '#f59e0b'],
                    borderRadius: 12,
                    barThickness: 25
                }]
            });

            // Doctor Stats
            const docStats: Record<string, { count: number; revenue: number; info: string }> = {};
            const docInfoMap: Record<string, string> = {};
            if (doctorsSnap.exists()) Object.values(doctorsSnap.val()).forEach((d: any) => { docInfoMap[d.name] = d.specialization || 'Internal'; });
            if (externalDoctorsSnap.exists()) Object.values(externalDoctorsSnap.val()).forEach((d: any) => { docInfoMap[d.name] = d.clinicInfo || 'External'; });

            reports.forEach((r: any) => {
                const doc = r.refDoctor || r.patientRefDoctor || 'Self';
                if (!docStats[doc]) docStats[doc] = { count: 0, revenue: 0, info: docInfoMap[doc] || '' };
                docStats[doc].count += 1;
            });

            const patientToDocMap: Record<string, string> = {};
            if (patientsSnap.exists()) {
                Object.entries(patientsSnap.val()).forEach(([key, p]: [string, any]) => {
                    const doc = p.refDoctor || 'Self';
                    patientToDocMap[key] = doc;
                    if (p.patientId) patientToDocMap[p.patientId] = doc;
                });
            }

            invoices.forEach((inv: any) => {
                const doc = patientToDocMap[inv.patientId] || 'Self';
                if (!docStats[doc]) docStats[doc] = { count: 0, revenue: 0, info: docInfoMap[doc] || '' };
                docStats[doc].revenue += (parseFloat(inv.total) || 0);
            });

            setTopDoctorsData(Object.entries(docStats).map(([name, s]) => ({ name, ...s })).sort((a, b) => b.revenue - a.revenue));

            // Gender & Payment
            const gStats = { Male: 0, Female: 0, Other: 0 };
            patients.forEach((p: any) => {
                const g = (p as any).gender || 'Other';
                if (g === 'Male') gStats.Male++; else if (g === 'Female') gStats.Female++; else gStats.Other++;
            });
            setGenderStats(gStats);

            const pStats: Record<string, number> = {};
            invoices.forEach((inv: any) => {
                const mode = inv.paymentMode || 'Cash';
                pStats[mode] = (pStats[mode] || 0) + (parseFloat(inv.total) || 0);
            });
            setPaymentStats(Object.entries(pStats).map(([name, value]) => ({ name, value })));

            setMetrics({
                revenue: { value: currRevenue, growth: calculateGrowth(currRevenue, prevRevenue) },
                reports: { value: currReports.length, growth: calculateGrowth(currReports.length, prevReports.length) },
                patients: { value: currPatients.length, growth: calculateGrowth(currPatients.length, prevPatients.length) },
                avgTAT: { value: parseFloat(avgTATHours), unit: 'hrs' },
                pending: samples.filter((s: any) => s.status !== 'Completed').length,
                totalRevenue: invoices.reduce((sum, inv) => sum + (parseFloat(inv.total) || 0), 0),
                outstanding: invoices.reduce((sum, inv) => sum + (parseFloat(inv.due) || 0), 0)
            });
            setLoading(false);
        } catch (error) {
            console.error(error);
            setLoading(false);
        }
    };

    const renderGrowth = (growth: number) => {
        if (growth === 0) return null;
        const isPos = growth > 0;
        return (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isPos ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                <i className={`fas fa-caret-${isPos ? 'up' : 'down'} mr-0.5`}></i>
                {Math.abs(growth)}%
            </span>
        );
    };

    if (loading) return <div className="h-screen flex items-center justify-center"><i className="fas fa-spinner fa-spin text-3xl text-indigo-600"></i></div>;

    return (
        <div className="p-4 space-y-6 animate-in fade-in duration-500 pb-20 bg-gray-50/30">
            {/* Header */}
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 tracking-tight">Analytics Dashboard</h1>
                    <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest mt-1">Smart Lab Intelligence</p>
                </div>
                <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-100">
                    {(['today', 'week', 'month'] as const).map((tf) => (
                        <button key={tf} onClick={() => setTimeframe(tf)} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all capitalize ${timeframe === tf ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}>{tf}</button>
                    ))}
                </div>
            </div>

            {/* Row 1: Key Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 relative overflow-hidden group">
                    <div className="flex justify-between items-start mb-2">
                        <div className="p-2 bg-green-50 text-green-600 rounded-xl"><i className="fas fa-rupee-sign text-sm"></i></div>
                        {renderGrowth(metrics.revenue.growth)}
                    </div>
                    <p className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Revenue ({timeframe})</p>
                    <h3 className="text-2xl font-black text-gray-900 mt-1">₹{metrics.revenue.value.toLocaleString('en-IN')}</h3>
                </div>
                <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 relative overflow-hidden group">
                    <div className="flex justify-between items-start mb-2">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><i className="fas fa-file-medical-alt text-sm"></i></div>
                        {renderGrowth(metrics.reports.growth)}
                    </div>
                    <p className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Reports ({timeframe})</p>
                    <h3 className="text-2xl font-black text-gray-900 mt-1">{metrics.reports.value}</h3>
                </div>
                <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 relative overflow-hidden group">
                    <div className="flex justify-between items-start mb-2">
                        <div className="p-2 bg-purple-50 text-purple-600 rounded-xl"><i className="fas fa-users text-sm"></i></div>
                        {renderGrowth(metrics.patients.growth)}
                    </div>
                    <p className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">New Patients</p>
                    <h3 className="text-2xl font-black text-gray-900 mt-1">{metrics.patients.value}</h3>
                </div>
                <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 relative overflow-hidden group">
                    <div className="flex justify-between items-start mb-2">
                        <div className="p-2 bg-orange-50 text-orange-600 rounded-xl"><i className="fas fa-bolt text-sm"></i></div>
                        <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">Speed</span>
                    </div>
                    <p className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Avg TAT</p>
                    <h3 className="text-2xl font-black text-gray-900 mt-1">{metrics.avgTAT.value} <span className="text-xs font-medium text-gray-400 uppercase">{metrics.avgTAT.unit}</span></h3>
                </div>
            </div>

            {/* Row 2: Trend & Insights (Gender/Payment) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Growth Trend */}
                <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100">
                    <div className="flex justify-between items-center mb-6 px-2">
                        <h3 className="font-black text-gray-900 text-sm uppercase tracking-tight">Growth Trend</h3>
                        <div className="flex gap-4">
                            <div className="flex items-center gap-1.5 text-[9px] font-bold text-gray-400 uppercase"><div className="w-2 h-2 rounded-full bg-green-500"></div> Rev</div>
                            <div className="flex items-center gap-1.5 text-[9px] font-bold text-gray-400 uppercase"><div className="w-2 h-2 rounded-full border border-blue-500"></div> Vol</div>
                        </div>
                    </div>
                    <div className="h-[224px]">
                        {trendData && <Line data={trendData} options={{
                            maintainAspectRatio: false, scales: {
                                y: { display: false }, y1: { display: false },
                                x: { grid: { display: false }, ticks: { font: { size: 9, weight: 'bold' }, color: '#9ca3af' } }
                            }, plugins: { legend: { display: false }, tooltip: { cornerRadius: 10, padding: 12 } }
                        }} />}
                    </div>
                </div>

                {/* Patient & Payment Split */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Patient Gender Distribution */}
                    <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 flex flex-col justify-between">
                        <div>
                            <h3 className="font-black text-gray-900 text-[10px] uppercase tracking-widest mb-4">Patient Profiles</h3>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2"><i className="fas fa-mars text-blue-500 text-xs"></i> <span className="text-[10px] font-bold text-gray-500 uppercase">Male</span></div>
                                    <span className="text-xs font-black text-gray-900">{genderStats.Male}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2"><i className="fas fa-venus text-pink-500 text-xs"></i> <span className="text-[10px] font-bold text-gray-500 uppercase">Female</span></div>
                                    <span className="text-xs font-black text-gray-900">{genderStats.Female}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2"><i className="fas fa-genderless text-indigo-500 text-xs"></i> <span className="text-[10px] font-bold text-gray-500 uppercase">Other</span></div>
                                    <span className="text-xs font-black text-gray-900">{genderStats.Other}</span>
                                </div>
                            </div>
                        </div>
                        <div className="mt-4">
                            <div className="w-full h-1.5 bg-gray-100 rounded-full flex overflow-hidden">
                                <div className="h-full bg-blue-500" style={{ width: `${(genderStats.Male / (genderStats.Male + genderStats.Female + genderStats.Other || 1)) * 100}%` }}></div>
                                <div className="h-full bg-pink-500" style={{ width: `${(genderStats.Female / (genderStats.Male + genderStats.Female + genderStats.Other || 1)) * 100}%` }}></div>
                                <div className="h-full bg-indigo-500" style={{ width: `${(genderStats.Other / (genderStats.Male + genderStats.Female + genderStats.Other || 1)) * 100}%` }}></div>
                            </div>
                            <p className="text-[8px] font-bold text-gray-400 mt-2 uppercase text-center">{(genderStats.Male + genderStats.Female + genderStats.Other)} Total</p>
                        </div>
                    </div>

                    {/* Payment Accuracy */}
                    <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 flex flex-col justify-between">
                        <div>
                            <h3 className="font-black text-gray-900 text-[10px] uppercase tracking-widest mb-4">Payment Modes</h3>
                            <div className="space-y-3 text-[10px]">
                                {paymentStats.slice(0, 3).map((p, i) => (
                                    <div key={i} className="flex flex-col gap-1">
                                        <div className="flex justify-between font-bold text-gray-500"><span className="uppercase text-[9px]">{p.name}</span> <span>₹{p.value.toLocaleString()}</span></div>
                                        <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                                            <div className="h-full bg-indigo-500" style={{ width: `${(p.value / (metrics.totalRevenue || 1)) * 100}%` }}></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="bg-indigo-600 rounded-2xl p-2.5 text-white flex items-center gap-2 mt-4">
                            <i className="fas fa-chart-line text-xs"></i>
                            <div>
                                <p className="text-[7px] font-black opacity-70 uppercase tracking-tighter">Efficiency</p>
                                <p className="text-xs font-black">₹{(metrics.totalRevenue / (metrics.reports.value || 1)).toFixed(0)}/pt</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Row 3: Test Analysis */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Popularity (Visual) */}
                <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 flex flex-col">
                    <h3 className="font-black text-gray-900 text-md uppercase tracking-tight mb-6">Test Popularity (Volume)</h3>
                    <div className="flex-1 flex items-center gap-8">
                        <div className="w-1/2 h-[180px]">
                            {topTestsChartData && <Doughnut data={topTestsChartData} options={{ maintainAspectRatio: false, cutout: '75%', plugins: { legend: { display: false } } }} />}
                        </div>
                        <div className="w-1/2 space-y-3">
                            {topTestsData.map((t, i) => (
                                <div key={i} className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: topTestsChartData?.datasets[0].backgroundColor[i] }}></div>
                                        <span className="text-xs font-bold text-gray-600 truncate max-w-[100px]">{t.name}</span>
                                    </div>
                                    <span className="text-xs font-black text-gray-900">{t.count}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Profitability (Financial) */}
                <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100">
                    <h3 className="font-black text-gray-900 text-md uppercase tracking-tight mb-6">Top Revenue Generators</h3>
                    <div className="space-y-3">
                        {topRevenueTests.map((t, i) => (
                            <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl border border-gray-100 hover:scale-[1.02] transition-transform">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-xl bg-green-500 text-white flex items-center justify-center font-black text-xs">₹</div>
                                    <span className="text-xs font-bold text-gray-800">{t.name}</span>
                                </div>
                                <span className="text-sm font-black text-green-600">₹{t.revenue.toLocaleString('en-IN')}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Row 4: Doctors & Insights */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Department Performance */}
                <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100">
                    <h3 className="font-black text-gray-900 text-md uppercase tracking-tight mb-6 px-2">Dept Revenue (₹)</h3>
                    <div className="h-[240px]">
                        {categoryData && <Bar data={categoryData} options={{
                            maintainAspectRatio: false, scales: {
                                y: { display: false },
                                x: { grid: { display: false }, ticks: { font: { size: 10, weight: 'bold' }, color: '#9ca3af' } }
                            }, plugins: { legend: { display: false } }
                        }} />}
                    </div>
                </div>

                {/* Paginated Doctors */}
                <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100">
                    <h3 className="font-black text-gray-900 text-md uppercase tracking-tight mb-6">Top Referring Doctors</h3>
                    <div className="space-y-3">
                        {topDoctorsData.slice((doctorPage - 1) * docsPerPage, doctorPage * docsPerPage).map((doc, i) => (
                            <div key={i} className="flex items-center justify-between p-2 rounded-2xl hover:bg-gray-50 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center text-[10px] font-black text-gray-400">#{(doctorPage - 1) * docsPerPage + i + 1}</div>
                                    <div>
                                        <p className="text-xs font-black text-gray-800">{doc.name}</p>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase">{doc.info || 'Professional'}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-black text-indigo-600">₹{doc.revenue.toLocaleString('en-IN')}</p>
                                    <p className="text-[9px] font-bold text-gray-400 uppercase">{doc.count} Referrals</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    {topDoctorsData.length > docsPerPage && (
                        <div className="flex gap-2 mt-6 pt-4 border-t border-gray-50 justify-end">
                            <button onClick={() => setDoctorPage(p => Math.max(1, p - 1))} disabled={doctorPage === 1} className="w-8 h-8 rounded-xl border border-gray-200 flex items-center justify-center text-xs disabled:opacity-30"><i className="fas fa-chevron-left"></i></button>
                            <button onClick={() => setDoctorPage(p => Math.min(Math.ceil(topDoctorsData.length / docsPerPage), p + 1))} disabled={doctorPage >= Math.ceil(topDoctorsData.length / docsPerPage)} className="w-8 h-8 rounded-xl border border-gray-200 flex items-center justify-center text-xs disabled:opacity-30"><i className="fas fa-chevron-right"></i></button>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
