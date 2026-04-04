'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ref, get } from 'firebase/database';
import { database } from '@/lib/firebase';
import { mergeTemplates, getPriceMap } from '@/lib/templateUtils';
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

    // Combined Core Metrics
    const [metrics, setMetrics] = useState({
        netCollections: { value: 0, growth: 0 },
        grossRevenue: { value: 0 },
        labRevenue: { value: 0, growth: 0 },
        opdRevenue: { value: 0, growth: 0 },
        totalPatients: { value: 0 },
        labVolume: 0,
        opdVolume: 0,
        activeLabLoad: 0,
        activeOpdQueue: 0,
        emergencyToday: 0,
        avgTAT: { value: 0, unit: 'hrs' },
        outstanding: 0,
        efficiency: 0,
        onlineAppts: { total: 0, pending: 0, today: 0, growth: 0 }
    });


    // Charts & Lists Data
    const [trendData, setTrendData] = useState<any>(null);
    const [categoryData, setCategoryData] = useState<any>(null);
    const [testVolumeData, setTestVolumeData] = useState<any>(null);
    const [opdStatusData, setOpdStatusData] = useState<any>(null);
    const [clinicalLoadData, setClinicalLoadData] = useState<any>(null);
    const [ageGroupData, setAgeGroupData] = useState<any>(null);
    const [physicianPerformance, setPhysicianPerformance] = useState<any[]>([]);
    const [topTestsData, setTopTestsData] = useState<any[]>([]);
    const [genderStats, setGenderStats] = useState<any>({ Male: 0, Female: 0, Other: 0 });
    const [paymentStats, setPaymentStats] = useState<any[]>([]);
    const [appointmentStatusData, setAppointmentStatusData] = useState<any>(null);
    const [appointmentTrendData, setAppointmentTrendData] = useState<any>(null);
    const [topRequestedDocs, setTopRequestedDocs] = useState<any[]>([]);

    const [doctorPage, setDoctorPage] = useState(1);
    const docsPerPage = 4;

    useEffect(() => {
        if (!user?.uid || !dataSourceId) {
            if (!user?.uid) setLoading(false);
            return;
        }
        fetchAnalytics();
    }, [user, userProfile, timeframe, dataSourceId]);

    const fetchAnalytics = async () => {
        if (!user?.uid) return;
        setLoading(true);

        const now = new Date();
        const getDatesForTimeframe = (tf: string) => {
            const end = new Date();
            const start = new Date();
            const prevStart = new Date();
            const prevEnd = new Date();

            end.setHours(23, 59, 59, 999); // End of today

            if (tf === 'today') {
                start.setHours(0, 0, 0, 0);
                prevStart.setDate(start.getDate() - 1);
                prevStart.setHours(0, 0, 0, 0);
                prevEnd.setDate(start.getDate() - 1);
                prevEnd.setHours(23, 59, 59, 999);
            } else if (tf === 'week') {
                start.setDate(now.getDate() - 7);
                start.setHours(0, 0, 0, 0);
                prevStart.setDate(start.getDate() - 7);
                prevStart.setHours(0, 0, 0, 0);
                prevEnd.setDate(start.getDate());
                prevEnd.setHours(23, 59, 59, 999);
            } else {
                start.setDate(now.getDate() - 30);
                start.setHours(0, 0, 0, 0);
                prevStart.setDate(start.getDate() - 30);
                prevStart.setHours(0, 0, 0, 0);
                prevEnd.setDate(start.getDate());
                prevEnd.setHours(23, 59, 59, 999);
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
                get(ref(database, `templates/${dataSourceId}`)),
                get(ref(database, `common_templates`)),
                get(ref(database, `opd/${dataSourceId}`)),
                get(ref(database, `users/${dataSourceId}/auth/staff`)),
                get(ref(database, `appointments/${dataSourceId}`))
            ]);

            const patients = results[0].exists() ? Object.values(results[0].val() as object) as any[] : [];
            const reports = results[1].exists() ? Object.values(results[1].val() as object) as any[] : [];
            const invoices: any[] = results[2].exists() ? Object.values(results[2].val() as object) as any[] : [];
            const samples = results[3].exists() ? Object.values(results[3].val() as object) as any[] : [];
            const doctors = results[4].exists() ? Object.values(results[4].val() as object) as any[] : [];
            const externalDoctors = results[5].exists() ? Object.values(results[5].val() as object) as any[] : [];
            
            const userT = results[6].exists() ? Object.values(results[6].val() as object) as any[] : [];
            const commonT = results[7].exists() ? Object.values(results[7].val() as object) as any[] : [];
            const mergedTemplates = mergeTemplates(userT, commonT);

            const opdRaw = results[8].exists() ? Object.values(results[8].val() as object) : [];
            const staffRaw = results[9].exists() ? results[9].val() as Record<string, any> : {};
            const appointments = results[10].exists() ? Object.values(results[10].val() as object) : [];

            // Staff & Template Maps for Instant Lookup (Using Keys for Mapping)
            const staffFeeMap: Record<string, number> = {};
            Object.entries(staffRaw).forEach(([id, s]: [string, any]) => { 
                if (s.fee) staffFeeMap[id] = parseFloat(s.fee) || 0; 
            });
            
            const templatePriceMap = getPriceMap(mergedTemplates);

            const filterByRange = (data: any[], s: Date, e: Date) =>
                data.filter(item => {
                    const dateStr = item.createdAt || item.visitDate || item.date;
                    if (!dateStr) return false;
                    const d = new Date(dateStr);
                    // Handle simple date strings (YYYY-MM-DD) by ensuring they aren't hit by UTC shifts
                    if (dateStr.length === 10) d.setHours(12, 0, 0, 0); 
                    return d >= s && d <= e;
                });

            const currInvoices = filterByRange(invoices, start, end);
            const prevInvoices = filterByRange(invoices, prevStart, prevEnd);
            const currOpd = filterByRange(opdRaw, start, end);
            const prevOpd = filterByRange(opdRaw, prevStart, prevEnd);
            const currSamples = filterByRange(samples, start, end);
            const prevSamples = filterByRange(samples, prevStart, prevEnd);
            const currReports = filterByRange(reports, start, end);
            const currAppts = filterByRange(appointments, start, end);
            const prevAppts = filterByRange(appointments, prevStart, prevEnd);
            const todayAppts = filterByRange(appointments, new Date(new Date().setHours(0,0,0,0)), new Date(new Date().setHours(23,59,59,999)));

            // CLINICAL-FIRST REVENUE AUDIT (Workload based)
            // Lab Gross = All test prices from Samples (even if unbilled)
            const calculateSampleGross = (samps: any[]) => samps.reduce((sum, s) => {
                let sSum = 0;
                if (s.tests && Array.isArray(s.tests)) {
                    s.tests.forEach(tn => (sSum += (templatePriceMap[tn.toLowerCase().trim()] || 0)));
                }
                return sum + sSum;
            }, 0);

            const currLabGross = calculateSampleGross(currSamples);
            const prevLabGross = calculateSampleGross(prevSamples);

            // OPD Gross = All Consultation Fees (regardless of status)
            const currOpdBilled = currOpd.reduce((sum, v) => sum + (staffFeeMap[v.doctorId] || 0), 0);
            const prevOpdBilled = prevOpd.reduce((sum, v) => sum + (staffFeeMap[v.doctorId] || 0), 0);

            // Actual Collections (Paid amount from invoices)
            const totalCurrPaid = currInvoices.reduce((sum, inv) => sum + (parseFloat(inv.paid) || 0), 0);
            const totalPrevPaid = prevInvoices.reduce((sum, inv) => sum + (parseFloat(inv.paid) || 0), 0);
 
            const totalCurrGross = currLabGross + currOpdBilled;
            const totalPrevGross = prevLabGross + prevOpdBilled;

            const calculateGrowth = (curr: number, prev: number) => {
                if (prev === 0) return curr > 0 ? 100 : 0;
                return Math.round(((curr - prev) / prev) * 100);
            };


            // Unique Patients
            const uniquePatientIds = new Set([
                ...filterByRange(patients, start, end).map((p: any) => p.id || p.patientId),
                ...currOpd.map((v: any) => v.patientId)
            ]);

            // Trend Data
            const chartLabels: string[] = [];
            const labRevTrend: number[] = [];
            const opdRevTrend: number[] = [];
            const volTrend: number[] = [];

            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dStr = d.toISOString().split('T')[0];
                chartLabels.push(d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }));
                
                const daySamples = samples.filter((s: any) => (s.createdAt || s.date)?.startsWith(dStr));
                const dayOpd = opdRaw.filter((v: any) => (v.createdAt || v.visitDate)?.startsWith(dStr));
                
                labRevTrend.push(calculateSampleGross(daySamples));
                opdRevTrend.push(dayOpd.reduce((sum, v) => sum + (staffFeeMap[v.doctorId] || 0), 0));
                volTrend.push(daySamples.length + dayOpd.length);
            }

            setTrendData({
                labels: chartLabels,
                datasets: [
                    { label: 'Lab Rev', data: labRevTrend, borderColor: '#10b981', tension: 0.4, borderWidth: 2, pointRadius: 2 },
                    { label: 'OPD Rev', data: opdRevTrend, borderColor: '#6366f1', tension: 0.4, borderWidth: 2, pointRadius: 2 },
                    { label: 'Total Visits', data: volTrend, borderColor: '#94a3b8', backgroundColor: 'rgba(148, 163, 184, 0.05)', tension: 0.4, fill: true, borderDash: [5, 5], yAxisID: 'y1' }
                ]
            });

            // OPD Status, Physician & Clinical Load
            const opdStatus = { pending: 0, completed: 0, referred: 0 };
            const docPerf: Record<string, { visits: number, revenue: number }> = {};
            let emergencyCount = 0;

            currOpd.forEach((v: any) => {
                const s = (v.status || 'pending').toLowerCase();
                if (s === 'pending') opdStatus.pending++;
                else if (s === 'completed') opdStatus.completed++;
                else if (s === 'referred') opdStatus.referred++;

                if (v.isEmergency) emergencyCount++;

                const dName = v.doctorName || 'Unknown';
                if (!docPerf[dName]) docPerf[dName] = { visits: 0, revenue: 0 };
                docPerf[dName].visits++;
                docPerf[dName].revenue += (staffFeeMap[v.doctorId] || 0); // Gross revenue per doctor
            });

            setOpdStatusData({
                labels: ['Pending', 'Completed', 'Referred'],
                datasets: [{ data: [opdStatus.pending, opdStatus.completed, opdStatus.referred], backgroundColor: ['#f59e0b', '#10b981', '#6366f1'], borderWidth: 0 }]
            });
            
            setClinicalLoadData({
                labels: ['Emergency', 'Routine'],
                datasets: [{ data: [emergencyCount, currOpd.length - emergencyCount], backgroundColor: ['#ef4444', '#e2e8f0'], borderWidth: 0 }]
            });

            setPhysicianPerformance(Object.entries(docPerf).map(([name, s]) => ({ name, ...s })).sort((a, b) => b.revenue - a.revenue));

            // Lab Specifics & Age Groups
            const ageGroups = { child: 0, adult: 0, senior: 0 };
            const processAge = (age: any) => {
                const a = parseInt(age);
                if (isNaN(a)) return;
                if (a < 18) ageGroups.child++;
                else if (a < 60) ageGroups.adult++;
                else ageGroups.senior++;
            };
            patients.forEach(p => processAge(p.age));
            currOpd.forEach(v => processAge(v.patientAge));

            setAgeGroupData({
                labels: ['Child', 'Adult', 'Senior'],
                datasets: [{ 
                    label: 'Age Distribution', 
                    data: [ageGroups.child, ageGroups.adult, ageGroups.senior], 
                    backgroundColor: ['#38bdf8', '#818cf8', '#c084fc'],
                    borderRadius: 4,
                    barThickness: 12
                }]
            });
            const catRevenue: Record<string, number> = {};
            const testVol: Record<string, number> = {};

            currSamples.forEach((s: any) => {
                if (s.tests && Array.isArray(s.tests)) {
                    s.tests.forEach((tn: string) => {
                        const template = mergedTemplates.find(mt => 
                            mt.name.toLowerCase().trim() === tn.toLowerCase().trim() || 
                            mt.subtests?.some(st => (st.name || st.testName || '').toLowerCase().trim() === tn.toLowerCase().trim())
                        );
                        const cat = template?.category || 'Others';
                        const price = templatePriceMap[tn.toLowerCase().trim()] || 0;
                        catRevenue[cat] = (catRevenue[cat] || 0) + price;
                    });
                }
            });
            currReports.forEach((r: any) => {
                const name = r.testName || 'Unknown';
                testVol[name] = (testVol[name] || 0) + 1;
            });

            const topCategories = Object.entries(catRevenue).sort(([, a], [, b]) => b - a).slice(0, 5);
            setCategoryData({
                labels: topCategories.map(([cat]) => cat),
                datasets: [{ label: 'Revenue', data: topCategories.map(([, v]) => v), backgroundColor: '#6366f1', borderRadius: 4, barThickness: 12 }]
            });

            const topTests = Object.entries(testVol).sort(([, a], [, b]) => b - a).slice(0, 5);
            setTestVolumeData({
                labels: topTests.map(([name]) => name),
                datasets: [{ data: topTests.map(([, v]) => v), backgroundColor: ['#6366f1', '#a855f7', '#ec4899', '#f97316', '#22c55e'], borderWidth: 0 }]
            });
            setTopTestsData(topTests.map(([name, count]) => ({ name, count })));

            // Demographics & Payment
            const gStats = { Male: 0, Female: 0, Other: 0 };
            const pStats: Record<string, number> = {};
            patients.forEach((p: any) => {
                const g = p.gender || 'Other';
                if (g === 'Male') gStats.Male++; else if (g === 'Female') gStats.Female++; else gStats.Other++;
            });
            invoices.forEach((inv: any) => {
                const mode = inv.paymentMode || 'Cash';
                pStats[mode] = (pStats[mode] || 0) + (parseFloat(inv.total) || 0);
            });
            setGenderStats(gStats);
            setPaymentStats(Object.entries(pStats).map(([name, value]) => ({ name, value })));

            // TAT
            const compSamples = samples.filter((s: any) => s.status === 'Completed' && s.completedAt && s.createdAt);
            const totalTAT = compSamples.reduce((sum, s: any) => sum + (new Date(s.completedAt).getTime() - new Date(s.createdAt).getTime()), 0);
            const avgTAT = compSamples.length > 0 ? (totalTAT / compSamples.length / (1000 * 3600)).toFixed(1) : 0;

            setMetrics({
                netCollections: { value: totalCurrPaid, growth: calculateGrowth(totalCurrPaid, totalPrevPaid) },
                grossRevenue: { value: totalCurrGross },
                labRevenue: { value: currLabGross, growth: calculateGrowth(currLabGross, prevLabGross) },
                opdRevenue: { value: currOpdBilled, growth: calculateGrowth(currOpdBilled, prevOpdBilled) },
                totalPatients: { value: uniquePatientIds.size },
                labVolume: currSamples.length,
                opdVolume: currOpd.length,
                activeLabLoad: currSamples.filter((s: any) => s.status !== 'Completed').length,
                activeOpdQueue: currOpd.filter((v: any) => (v.status || 'pending').toLowerCase() === 'pending').length,
                emergencyToday: currOpd.filter((v: any) => v.isEmergency).length,
                onlineAppts: { 
                    total: currAppts.length, 
                    pending: currAppts.filter(a => (a.status || 'pending') === 'pending').length,
                    today: todayAppts.length,
                    growth: calculateGrowth(currAppts.length, prevAppts.length)
                },
                avgTAT: { value: Number(avgTAT), unit: 'hrs' },
                outstanding: totalCurrGross - totalCurrPaid,
                efficiency: totalCurrGross > 0 ? Math.round((totalCurrPaid / totalCurrGross) * 100) : 100
            });

            // Online Appt Insights
            const apptStatus = { pending: 0, approved: 0, rejected: 0 };
            const apptDocPerf: Record<string, number> = {};
            const apptDays: Record<string, number> = {};

            currAppts.forEach(a => {
                const s = (a.status || 'pending').toLowerCase();
                if (s === 'pending') apptStatus.pending++;
                else if (s === 'approved' || s === 'confirmed') apptStatus.approved++;
                else if (s === 'rejected' || s === 'cancelled') apptStatus.rejected++;

                const dName = a.doctorName || 'General';
                apptDocPerf[dName] = (apptDocPerf[dName] || 0) + 1;
            });

            setAppointmentStatusData({
                labels: ['Pending', 'Approved', 'Rejected'],
                datasets: [{ data: [apptStatus.pending, apptStatus.approved, apptStatus.rejected], backgroundColor: ['#6366f1', '#10b981', '#ef4444'], borderWidth: 0 }]
            });

            const topApptDocs = Object.entries(apptDocPerf).sort(([, a], [, b]) => b - a).slice(0, 5);
            setTopRequestedDocs(topApptDocs.map(([name, count]) => ({ name, count })));

            // Appt Trend
            const apptChartLabels: string[] = [];
            const apptVolTrend: number[] = [];
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dStr = d.toISOString().split('T')[0];
                apptChartLabels.push(d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }));
                apptVolTrend.push(appointments.filter((a: any) => (a.date === dStr || a.createdAt?.startsWith(dStr))).length);
            }
            setAppointmentTrendData({
                labels: apptChartLabels,
                datasets: [{ label: 'Online Bookings', data: apptVolTrend, borderColor: '#6366f1', backgroundColor: 'rgba(99, 102, 241, 0.1)', fill: true, tension: 0.4, borderWidth: 2, pointRadius: 3 }]
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
                {isPos ? '+' : ''}{growth}%
            </span>
        );
    };

    if (loading) return <div className="h-screen flex items-center justify-center bg-gray-50"><i className="fas fa-spinner fa-spin text-3xl text-indigo-600"></i></div>;

    return (
        <div className="p-3 space-y-4 bg-gray-50/50 min-h-screen pb-10">
            {/* Header - Compact */}
            <div className="flex justify-between items-center bg-white p-3 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <h1 className="text-lg font-black text-gray-900 leading-none">Intelligence Dashboard</h1>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Cross-Module Analytics</p>
                </div>
                <div className="flex bg-gray-100 p-1 rounded-xl">
                    {(['today', 'week', 'month'] as const).map((tf) => (
                        <button key={tf} onClick={() => setTimeframe(tf)} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all capitalize ${timeframe === tf ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400'}`}>{tf}</button>
                    ))}
                </div>
            </div>

            {/* Metrics Grid - Compact Row */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <MetricCard 
                    title="Revenue" 
                    value={`₹${metrics.grossRevenue.value.toLocaleString()}`} 
                    growth={metrics.netCollections.growth} 
                    icon="fas fa-coins" 
                    color="emerald" 
                    subtitle={`Collected: ₹${metrics.netCollections.value.toLocaleString()}`}
                />
                <MetricCard 
                    title="Net Collections" 
                    value={`₹${metrics.netCollections.value.toLocaleString()}`} 
                    growth={metrics.netCollections.growth} 
                    icon="fas fa-wallet" 
                    color="sky" 
                    subtitle={`Efficiency: ${metrics.efficiency}%`}
                />
                <MetricCard title="OPD Revenue" value={`₹${metrics.opdRevenue.value.toLocaleString()}`} growth={metrics.opdRevenue.growth} icon="fas fa-user-md" color="indigo" />
                
                <MetricCard 
                    title="Total Reports" 
                    value={metrics.labVolume.toString()} 
                    icon="fas fa-file-medical" 
                    color="amber" 
                />
                <MetricCard 
                    title="OPD Visits" 
                    value={metrics.opdVolume.toString()} 
                    icon="fas fa-stethoscope" 
                    color="rose" 
                />
                <MetricCard 
                    title="Online Appts" 
                    value={metrics.onlineAppts.total.toString()} 
                    growth={metrics.onlineAppts.growth} 
                    icon="fas fa-calendar-check" 
                    color="sky" 
                    subtitle={`${metrics.onlineAppts.pending} Pending | ${metrics.onlineAppts.today} Today`}
                />
            </div>



            {/* Main Content Grid */}
            <div className="grid grid-cols-12 gap-4">
                {/* Row 2: Trend & Demographics */}
                <div className="col-span-12 lg:col-span-8 bg-white p-4 rounded-[2rem] shadow-sm border border-gray-100 min-h-[300px] flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xs font-black uppercase tracking-tight text-gray-400">Revenue & Visit Trends</h3>
                        <div className="flex gap-3 text-[9px] font-black uppercase text-gray-400">
                            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500" /> Lab</span>
                            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-indigo-500" /> OPD</span>
                        </div>
                    </div>
                    <div className="flex-1 h-[220px]">
                        {trendData && <Line data={trendData} options={chartOptions} />}
                    </div>
                </div>

                <div className="col-span-12 lg:col-span-4 bg-white p-4 rounded-[2rem] shadow-sm border border-gray-100 min-h-[300px] flex flex-col justify-between">
                    <div className="space-y-4">
                        <div>
                            <h3 className="text-xs font-black uppercase tracking-tight text-gray-400 mb-3">Gender Distribution</h3>
                            <div className="space-y-2">
                                <DemoRow label="Male" value={genderStats.Male} total={genderStats.Male + genderStats.Female + genderStats.Other} color="bg-blue-500" />
                                <DemoRow label="Female" value={genderStats.Female} total={genderStats.Male + genderStats.Female + genderStats.Other} color="bg-pink-500" />
                            </div>
                        </div>
                        <div>
                            <h3 className="text-xs font-black uppercase tracking-tight text-gray-400 mb-2">Age Groups</h3>
                            <div className="h-[100px]">
                                {ageGroupData && <Bar data={ageGroupData} options={barOptions} />}
                            </div>
                        </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase">Avg TAT</p>
                            <p className="text-lg font-black text-indigo-600 leading-none">{metrics.avgTAT.value} hrs</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-black text-gray-400 uppercase">Outstanding</p>
                            <p className="text-lg font-black text-rose-500 leading-none">₹{metrics.outstanding.toLocaleString()}</p>
                        </div>
                    </div>
                </div>

                {/* Row 3: Online Appointments & OPD Insights (Balanced 6:6) */}
                <div className="col-span-12 lg:col-span-6 bg-white p-4 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xs font-black uppercase tracking-tight text-gray-400 flex items-center gap-2">
                            <i className="fas fa-globe text-indigo-500" /> Online Appointment Insights
                        </h3>
                        <div className="bg-indigo-50 px-2 py-1 rounded-lg">
                            <p className="text-[10px] font-black text-indigo-600">
                                {metrics.onlineAppts.total > 0 ? Math.round(((metrics.onlineAppts.total - metrics.onlineAppts.pending) / metrics.onlineAppts.total) * 100) : 0}% Conv.
                            </p>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 flex-1">
                        <div className="flex flex-col">
                            <p className="text-[8px] font-black text-gray-400 uppercase mb-2">Booking Status</p>
                            <div className="flex-1 h-[120px] relative">
                                {appointmentStatusData && <Doughnut data={appointmentStatusData} options={{ cutout: '70%', plugins: { legend: { display: false } }, maintainAspectRatio: false }} />}
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                    <p className="text-lg font-black text-gray-900 leading-none">{metrics.onlineAppts.total}</p>
                                    <p className="text-[7px] font-bold text-gray-400 uppercase">Total</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <p className="text-[8px] font-black text-gray-400 uppercase mb-2">Top Requested Docs</p>
                            <div className="space-y-1.5 overflow-hidden">
                                {topRequestedDocs.slice(0, 3).map((doc, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-1.5 bg-gray-50 rounded-lg border border-gray-100">
                                        <span className="text-[9px] font-bold text-gray-600 truncate max-w-[80px]">{doc.name}</span>
                                        <span className="text-[9px] font-black text-indigo-600">{doc.count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="mt-4 h-[100px]">
                        {appointmentTrendData && <Line data={appointmentTrendData} options={{...chartOptions, scales: { ...chartOptions.scales, x: { ...chartOptions.scales.x, display: false } } }} />}
                    </div>
                </div>

                <div className="col-span-12 lg:col-span-6 bg-gradient-to-br from-indigo-50/50 to-white p-4 rounded-[2rem] shadow-sm border border-indigo-100 flex flex-col">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-4 flex items-center gap-2">
                        <i className="fas fa-stethoscope text-xs" /> OPD Clinical Insights
                    </h3>
                    <div className="flex gap-4 flex-1">
                        <div className="w-1/2 h-[140px] relative">
                            {opdStatusData && <Doughnut data={opdStatusData} options={{ cutout: '70%', plugins: { legend: { display: false } }, maintainAspectRatio: false }} />}
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <div className="flex flex-col items-center">
                                    <p className="text-lg font-black text-indigo-900 leading-none">{metrics.opdVolume}</p>
                                    <p className="text-[8px] font-bold text-indigo-400 uppercase">Visits</p>
                                </div>
                            </div>
                        </div>
                        <div className="w-1/2 flex flex-col justify-between">
                            <div className="space-y-1.5">
                                {physicianPerformance.slice(0, 3).map((p, i) => (
                                    <div key={i} className="bg-white p-1.5 rounded-lg shadow-sm border border-indigo-50 flex justify-between items-center">
                                        <p className="text-[9px] font-bold truncate max-w-[70px] text-gray-600">{p.name}</p>
                                        <p className="text-[9px] font-black text-indigo-600">₹{(p.revenue / 1000).toFixed(1)}k</p>
                                    </div>
                                ))}
                            </div>
                            <div className="bg-white p-1.5 rounded-xl shadow-sm border border-red-50 flex items-center justify-between mt-2">
                                <span className="text-[8px] font-black text-red-600 uppercase tracking-tighter">Emergency Load</span>
                                <div className="h-6 w-6">
                                    {clinicalLoadData && <Doughnut data={clinicalLoadData} options={{ cutout: '60%', plugins: { legend: { display: false } }, maintainAspectRatio: false }} />}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Row 4: Lab Insights & Settlements (Balanced 8:4) */}
                <div className="col-span-12 lg:col-span-8 bg-gradient-to-br from-emerald-50/50 to-white p-4 rounded-[2rem] shadow-sm border border-emerald-100 flex flex-col min-h-[250px]">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-4 flex items-center gap-2">
                        <i className="fas fa-microscope text-xs" /> Lab Diagnostic Insights
                    </h3>
                    <div className="grid grid-cols-2 gap-6 flex-1">
                        <div>
                            <h4 className="text-[9px] font-black text-gray-400 uppercase mb-2">Revenue by Dept</h4>
                            <div className="h-[150px]">
                                {categoryData && <Bar data={categoryData} options={barOptions} />}
                            </div>
                        </div>
                        <div>
                            <h4 className="text-[9px] font-black text-gray-400 uppercase mb-2">Top Performed Tests</h4>
                            <div className="grid grid-cols-1 gap-1.5">
                                {topTestsData.map((t, i) => (
                                    <div key={i} className="flex items-center justify-between gap-2 p-1.5 bg-white rounded-lg border border-emerald-50">
                                        <span className="text-[9px] font-bold text-gray-600 truncate flex-1">{t.name}</span>
                                        <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">{t.count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-span-12 lg:col-span-4 bg-white p-4 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col justify-between min-h-[250px]">
                    <h3 className="text-xs font-black uppercase tracking-tight text-gray-400 mb-3">Finance & Settlments</h3>
                    <div className="space-y-3 flex-1 overflow-y-auto">
                        {paymentStats.map((p, i) => (
                            <div key={i}>
                                <div className="flex justify-between text-[10px] font-black uppercase text-gray-500 mb-1">
                                    <span>{p.name}</span>
                                    <span>₹{p.value.toLocaleString()}</span>
                                </div>
                                <div className="w-full h-1 bg-gray-50 rounded-full overflow-hidden">
                                    <div className="h-full bg-slate-800" style={{ width: `${(p.value / (metrics.netCollections.value || 1)) * 100}%` }} />
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-4 bg-slate-900 p-3 rounded-2xl text-white">
                        <div className="flex justify-between items-end">
                            <div>
                                <p className="text-[8px] font-black opacity-70 uppercase tracking-widest">Revenue Impact</p>
                                <p className="text-lg font-black">₹{(metrics.netCollections.value / (metrics.totalPatients.value || 1)).toFixed(0)} <span className="text-[10px] font-bold opacity-60">/ PATIENT</span></p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-black text-emerald-400 leading-none">{metrics.efficiency}%</p>
                                <p className="text-[7px] font-bold opacity-60 uppercase">Settled</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Helper Components
function MetricCard({ title, value, growth, icon, color, subtitle }: any) {
    const colors: any = {
        emerald: 'from-emerald-50 to-green-50 text-emerald-700 bg-emerald-500 border-emerald-100',
        sky: 'from-sky-50 to-blue-50 text-sky-700 bg-sky-500 border-sky-100',
        indigo: 'from-indigo-50 to-violet-50 text-indigo-700 bg-indigo-500 border-indigo-100',
        purple: 'from-purple-50 to-fuchsia-50 text-purple-700 bg-purple-500 border-purple-100',
        amber: 'from-amber-50 to-orange-50 text-amber-700 bg-amber-500 border-amber-100',
        rose: 'from-rose-50 to-red-50 text-rose-700 bg-rose-500 border-rose-100',
    };

    return (
        <div className={`bg-gradient-to-br ${colors[color].split(' text-')[0]} px-3 py-2.5 rounded-2xl shadow-sm border ${colors[color].split(' border-')[1]} relative overflow-hidden group`}>
            <div className="flex flex-col h-full justify-between">
                <div className="flex justify-between items-start">
                    <p className={`text-[9px] font-black uppercase tracking-tight ${colors[color].split(' text-')[1].split(' bg-')[0]} opacity-70`}>{title}</p>
                    <div className={`w-6 h-6 bg-white/60 backdrop-blur-sm rounded-lg flex items-center justify-center ${colors[color].split(' text-')[1].split(' bg-')[0]} text-[10px] border border-white/50`}>
                        <i className={icon} />
                    </div>
                </div>
                
                <div className="mt-1">
                    <div className="flex items-baseline gap-2">
                        <h3 className="text-lg font-black text-gray-900 tracking-tight leading-none">{value}</h3>
                        {growth !== undefined && growth !== 0 && (
                            <span className={`text-[9px] font-black ${growth >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {growth > 0 ? '↑' : '↓'}{Math.abs(growth)}%
                            </span>
                        )}
                    </div>
                    {subtitle && <p className="text-[8px] font-black text-gray-400 uppercase mt-0.5 tracking-tighter truncate">{subtitle}</p>}
                </div>
            </div>
        </div>
    );
}

function DemoRow({ label, value, total, color }: any) {
    const pct = total > 0 ? (value / total) * 100 : 0;
    return (
        <div>
            <div className="flex justify-between text-[10px] font-black uppercase text-gray-400 mb-1">
                <span>{label}</span>
                <span className="text-gray-900">{value}</span>
            </div>
            <div className="w-full h-1 bg-gray-50 rounded-full overflow-hidden">
                <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
}

// Chart Options
const chartOptions: any = {
    maintainAspectRatio: false,
    scales: {
        y: { display: false },
        y1: { display: false, position: 'right' },
        x: { grid: { display: false }, ticks: { font: { size: 9, weight: 'bold' }, color: '#9ca3af' } }
    },
    plugins: { legend: { display: false }, tooltip: { cornerRadius: 8, padding: 10, titleFont: { size: 10 }, bodyFont: { size: 10 } } }
};

const barOptions: any = {
    maintainAspectRatio: false,
    scales: {
        y: { display: false },
        x: { grid: { display: false }, ticks: { font: { size: 8, weight: 'bold' }, color: '#9ca3af' } }
    },
    plugins: { legend: { display: false } }
};
