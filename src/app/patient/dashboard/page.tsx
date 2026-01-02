'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ref, onValue, push } from 'firebase/database';
import { database } from '@/lib/firebase';
import Link from 'next/link';
import NotificationBell from '@/components/NotificationBell';
import { useToast } from '@/contexts/ToastContext';

export default function PatientDashboard() {
    const router = useRouter();
    const { showToast } = useToast();
    const [patientData, setPatientData] = useState<any>(null);
    const [reports, setReports] = useState<any[]>([]);
    const [prescriptions, setPrescriptions] = useState<any[]>([]);
    const [appointments, setAppointments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'reports' | 'prescriptions' | 'appointments' | 'history'>('reports');
    const [mounted, setMounted] = useState(false);

    // Booking modal states
    const [showBookModal, setShowBookModal] = useState(false);
    const [labs, setLabs] = useState<any[]>([]);
    const [doctors, setDoctors] = useState<any[]>([]);
    const [selectedLab, setSelectedLab] = useState('');
    const [selectedDoctor, setSelectedDoctor] = useState('');
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedSlot, setSelectedSlot] = useState('');
    const [bookingLoading, setBookingLoading] = useState(false);
    const [bookingPatientData, setBookingPatientData] = useState({
        name: '',
        mobile: '',
        age: '',
        gender: '',
        address: '',
        serviceType: 'opd' as 'opd' | 'lab' | 'both'
    });

    const timeSlots = [
        '09:00 AM - 09:30 AM',
        '09:30 AM - 10:00 AM',
        '10:00 AM - 10:30 AM',
        '10:30 AM - 11:00 AM',
        '11:00 AM - 11:30 AM',
        '11:30 AM - 12:00 PM',
        '12:00 PM - 12:30 PM',
        '02:00 PM - 02:30 PM',
        '02:30 PM - 03:00 PM',
        '03:00 PM - 03:30 PM',
        '03:30 PM - 04:00 PM',
        '04:00 PM - 04:30 PM',
        '04:30 PM - 05:00 PM',
        '05:00 PM - 05:30 PM',
    ];

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!mounted) return;

        const mobile = localStorage.getItem('patient_mobile');
        const patientId = localStorage.getItem('patient_id');
        const ownerId = localStorage.getItem('patient_owner_id');

        if (!mobile) {
            router.push('/patient');
            return;
        }

        if (ownerId && ownerId !== 'null') {
            // Fetch patient data from correct path
            const patientRef = ref(database, `patients/${ownerId}/${patientId}`);
            onValue(patientRef, (snapshot) => {
                if (snapshot.exists()) {
                    setPatientData(snapshot.val());
                }
                setLoading(false);
            });

            // Fetch reports
            fetchReports(ownerId, patientId);
            // Fetch prescriptions
            fetchPrescriptions(ownerId, patientId);
        } else {
            // Self registered or unlinked
            setPatientData({
                name: localStorage.getItem('patient_name') || 'Guest',
                mobile: mobile
            });
            setLoading(false);

            // Check if patient has been added to any lab since last login (Sync)
            const checkLink = async () => {
                try {
                    const res = await fetch('/api/patient/check-link', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ mobile })
                    });
                    const data = await res.json();

                    if (data.success && data.found) {
                        console.log("Found linked lab record, syncing...");
                        localStorage.setItem('patient_owner_id', data.ownerId);
                        localStorage.setItem('patient_id', data.patientId);
                        window.location.reload();
                    }
                } catch (err) {
                    console.error("Sync check failed", err);
                }
            };
            checkLink();
        }

        // Fetch appointments (works by mobile, so owner irrelevant)
        fetchAppointments(mobile);
    }, [mounted, router]);

    // Fetch labs when booking modal opens
    useEffect(() => {
        if (showBookModal) {
            fetchAvailableLabs();

            // Pre-fill patient data
            const name = localStorage.getItem('patient_name');
            const mobile = localStorage.getItem('patient_mobile');
            if (name && mobile) {
                setBookingPatientData(prev => ({
                    ...prev,
                    name,
                    mobile
                }));
            }
        }
    }, [showBookModal]);

    const fetchReports = (labId: string, patientId: string) => {
        const reportsRef = ref(database, `reports/${labId}`);
        onValue(reportsRef, (snapshot) => {
            if (snapshot.exists()) {
                const allReports = snapshot.val();
                const patientReports: any[] = [];

                for (const reportId in allReports) {
                    if (allReports[reportId].patientId === patientId) {
                        patientReports.push({
                            id: reportId,
                            ...allReports[reportId]
                        });
                    }
                }

                // Sort by date (newest first)
                patientReports.sort((a, b) =>
                    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                );

                setReports(patientReports);
            }
        });
    };

    const fetchPrescriptions = (labId: string, patientId: string) => {
        const opdRef = ref(database, `opd/${labId}`);
        onValue(opdRef, (snapshot) => {
            if (snapshot.exists()) {
                const allOpd = snapshot.val();
                const patientPrescriptions: any[] = [];

                for (const visitId in allOpd) {
                    if (allOpd[visitId].patientId === patientId) {
                        patientPrescriptions.push({
                            id: visitId,
                            ...allOpd[visitId]
                        });
                    }
                }

                // Sort by date (newest first)
                patientPrescriptions.sort((a, b) =>
                    new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime()
                );

                setPrescriptions(patientPrescriptions);
            }
        });
    };

    const fetchAppointments = (mobile: string) => {
        const apptRef = ref(database, 'appointments');
        onValue(apptRef, (snapshot) => {
            if (snapshot.exists()) {
                const allAppointments = snapshot.val();
                const patientAppointments: any[] = [];

                for (const labId in allAppointments) {
                    for (const date in allAppointments[labId]) {
                        for (const apptId in allAppointments[labId][date]) {
                            const appt = allAppointments[labId][date][apptId];
                            if (appt.patientMobile === mobile) {
                                patientAppointments.push({
                                    id: apptId,
                                    ...appt
                                });
                            }
                        }
                    }
                }

                // Sort by date
                patientAppointments.sort((a, b) =>
                    new Date(b.date).getTime() - new Date(a.date).getTime()
                );

            }
        });
    };

    const fetchAvailableLabs = () => {
        const usersRef = ref(database, 'users');
        onValue(usersRef, (snapshot) => {
            if (snapshot.exists()) {
                const users = snapshot.val();
                const labsList: any[] = [];

                for (const uid in users) {
                    if (users[uid].profile) {
                        const brandingRef = ref(database, `branding/${uid}`);
                        onValue(brandingRef, (brandSnap) => {
                            if (brandSnap.exists()) {
                                const branding = brandSnap.val();
                                labsList.push({
                                    id: uid,
                                    name: branding.labName || users[uid].profile.name,
                                    address: branding.address,
                                    contact: branding.contact
                                });
                                setLabs([...labsList]);
                            }
                        });
                    }
                }
            }
        });
    };

    const fetchDoctorsForLab = (labId: string) => {
        const doctorsRef = ref(database, `doctors/${labId}`);
        onValue(doctorsRef, (snapshot) => {
            if (snapshot.exists()) {
                const doctorsData = snapshot.val();
                const doctorsList: any[] = [];

                for (const docId in doctorsData) {
                    doctorsList.push({
                        id: docId,
                        ...doctorsData[docId]
                    });
                }

                setDoctors(doctorsList);
            } else {
                setDoctors([]);
            }
        });
    };

    const handleLabChange = (labId: string) => {
        setSelectedLab(labId);
        setSelectedDoctor('');
        if (labId) {
            fetchDoctorsForLab(labId);
        } else {
            setDoctors([]);
        }
    };

    const handleBookAppointment = async () => {
        if (bookingLoading) return;

        if (!selectedLab || !selectedDoctor || !selectedDate || !selectedSlot) {
            showToast('Please fill all appointment details', 'warning');
            return;
        }

        if (!bookingPatientData.name || !bookingPatientData.mobile || !bookingPatientData.age || !bookingPatientData.gender || !bookingPatientData.address) {
            showToast('Please fill all patient details including address', 'warning');
            return;
        }

        setBookingLoading(true);

        try {
            const doctor = doctors.find(d => d.id === selectedDoctor);

            const appointmentData = {
                patientData: {
                    name: bookingPatientData.name,
                    mobile: bookingPatientData.mobile,
                    age: parseInt(bookingPatientData.age),
                    gender: bookingPatientData.gender,
                    address: bookingPatientData.address || '',
                    serviceType: bookingPatientData.serviceType
                },
                doctorId: selectedDoctor,
                doctorName: doctor?.name || 'Doctor',
                date: selectedDate,
                timeSlot: selectedSlot,
                status: 'pending',
                source: 'WEB',
                bookedAt: new Date().toISOString(),
                labId: selectedLab,
                patientName: bookingPatientData.name,
                patientMobile: bookingPatientData.mobile
            };

            const apptRef = ref(database, `appointments/${selectedLab}/${selectedDate}`);
            await push(apptRef, appointmentData);

            showToast('Appointment booked successfully! The clinic will confirm shortly.', 'success');
            setShowBookModal(false);

            // Reset form
            setSelectedLab('');
            setSelectedDoctor('');
            setSelectedDate('');
            setSelectedSlot('');
            setBookingPatientData(prev => ({
                ...prev,
                age: '',
                gender: '',
                address: '',
                serviceType: 'opd'
            }));

            // Refresh appointments
            const mobile = localStorage.getItem('patient_mobile');
            if (mobile) fetchAppointments(mobile);

        } catch (error) {
            console.error('Booking error:', error);
            showToast('Failed to book appointment. Please try again.', 'error');
        } finally {
            setBookingLoading(false);
        }
    };

    const handleLogout = async () => {
        try {
            // Remove session from Firebase
            const sessionId = localStorage.getItem('patient_session_id');
            if (sessionId) {
                const { ref, remove } = await import('firebase/database');
                await remove(ref(database, `patientSessions/${sessionId}`));
            }

            // Sign out
            const { signOut } = await import('firebase/auth');
            const { auth } = await import('@/lib/firebase');
            await signOut(auth);
        } catch (e) {
            console.error('Logout error:', e);
        }

        localStorage.removeItem('patient_mobile');
        localStorage.removeItem('patient_name');
        localStorage.removeItem('patient_id');
        localStorage.removeItem('patient_owner_id');
        localStorage.removeItem('patient_session_id');
        router.push('/patient');
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <i className="fas fa-spinner fa-spin text-4xl text-green-600 mb-4"></i>
                    <p className="text-gray-600">Loading your dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-gradient-to-r from-green-600 to-blue-600 text-white p-6 shadow-lg">
                <div className="max-w-6xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                            <i className="fas fa-hospital-user text-2xl"></i>
                        </div>
                        <div>
                            <h1 className="text-xl font-bold">Spotnet MedOS</h1>
                            <p className="text-sm opacity-90">Patient Portal</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <NotificationBell />
                        <div className="text-right hidden sm:block mr-2">
                            <p className="font-bold">{patientData?.name}</p>
                            <p className="text-xs opacity-80">Username: spot@{patientData?.mobile}</p>
                        </div>
                        <button
                            onClick={() => setShowBookModal(true)}
                            className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition flex items-center gap-2"
                        >
                            <i className="fas fa-calendar-plus"></i>
                            <span className="hidden md:inline">Book Appointment</span>
                        </button>
                        <button
                            onClick={handleLogout}
                            className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition"
                        >
                            <i className="fas fa-sign-out-alt mr-2"></i>
                            Logout
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto p-6">
                {/* Tabbed Interface */}
                <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                    {/* Tab Headers */}
                    {/* Tab Headers - Mobile Optimized with Scroll */}
                    <div className="flex border-b overflow-x-auto whitespace-nowrap scrollbar-hide">
                        <button
                            onClick={() => setActiveTab('reports')}
                            className={`flex-1 min-w-[120px] px-4 sm:px-6 py-4 font-semibold transition text-sm sm:text-base ${activeTab === 'reports'
                                ? 'bg-green-50 text-green-700 border-b-2 border-green-600'
                                : 'text-gray-600 hover:bg-gray-50'
                                }`}
                        >
                            <i className="fas fa-file-medical mr-2"></i>
                            Reports ({reports.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('prescriptions')}
                            className={`flex-1 min-w-[120px] px-4 sm:px-6 py-4 font-semibold transition text-sm sm:text-base ${activeTab === 'prescriptions'
                                ? 'bg-purple-50 text-purple-700 border-b-2 border-purple-600'
                                : 'text-gray-600 hover:bg-gray-50'
                                }`}
                        >
                            <i className="fas fa-prescription mr-2"></i>
                            Rx ({prescriptions.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('appointments')}
                            className={`flex-1 min-w-[120px] px-4 sm:px-6 py-4 font-semibold transition text-sm sm:text-base ${activeTab === 'appointments'
                                ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                                : 'text-gray-600 hover:bg-gray-50'
                                }`}
                        >
                            <i className="fas fa-calendar-check mr-2"></i>
                            Appts ({appointments.filter(a => a.status === 'confirmed').length})
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`flex-1 min-w-[100px] px-4 sm:px-6 py-4 font-semibold transition text-sm sm:text-base ${activeTab === 'history'
                                ? 'bg-gray-100 text-gray-800 border-b-2 border-gray-600'
                                : 'text-gray-600 hover:bg-gray-50'
                                }`}
                        >
                            <i className="fas fa-history mr-2"></i>
                            History
                        </button>
                    </div>

                    {/* Tab Content */}
                    <div className="p-6">
                        {/* Reports Tab */}
                        {activeTab === 'reports' && (
                            <div>
                                {reports.length === 0 ? (
                                    <div className="text-center py-12">
                                        <i className="fas fa-file-medical text-6xl text-gray-300 mb-4"></i>
                                        <h3 className="text-xl font-bold text-gray-800 mb-2">No Reports Yet</h3>
                                        <p className="text-gray-600">Your lab reports will appear here</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {reports.map((report) => (
                                            <div key={report.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <h4 className="font-bold text-gray-800">{report.testName}</h4>
                                                        <p className="text-sm text-gray-600 mt-1">
                                                            Report ID: {report.reportId}
                                                        </p>
                                                        <p className="text-xs text-gray-500 mt-1">
                                                            {new Date(report.createdAt).toLocaleDateString('en-IN')}
                                                        </p>
                                                    </div>
                                                    <a
                                                        href={`/print/report/${report.id}?patient=true`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
                                                    >
                                                        <i className="fas fa-download mr-2"></i>
                                                        Download
                                                    </a>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Prescriptions Tab */}
                        {activeTab === 'prescriptions' && (
                            <div>
                                {prescriptions.length === 0 ? (
                                    <div className="text-center py-12">
                                        <i className="fas fa-prescription text-6xl text-gray-300 mb-4"></i>
                                        <h3 className="text-xl font-bold text-gray-800 mb-2">No Prescriptions Yet</h3>
                                        <p className="text-gray-600">Your doctor prescriptions will appear here</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {prescriptions.map((px) => (
                                            <div key={px.id} className="border border-purple-200 rounded-lg p-4 bg-purple-50 hover:bg-purple-100 transition">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <h4 className="font-bold text-gray-800">Dr. {px.doctorName}</h4>
                                                        <p className="text-sm text-gray-600">Rx ID: {px.rxId}</p>
                                                        <p className="text-xs text-gray-500 mt-1">
                                                            {new Date(px.visitDate).toLocaleDateString('en-IN')}
                                                        </p>
                                                    </div>
                                                    <a
                                                        href={`/print/opd/${px.rxId}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
                                                    >
                                                        <i className="fas fa-eye mr-2"></i>
                                                        View Rx
                                                    </a>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Appointments Tab */}
                        {activeTab === 'appointments' && (
                            <div>
                                {appointments.length === 0 ? (
                                    <div className="text-center py-12">
                                        <i className="fas fa-calendar-times text-6xl text-gray-300 mb-4"></i>
                                        <h3 className="text-xl font-bold text-gray-800 mb-2">No Appointments</h3>
                                        <p className="text-gray-600">Click "Book Appointment" in the header to schedule</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {appointments.map((appt) => {
                                            const getStatusColor = () => {
                                                switch (appt.status) {
                                                    case 'confirmed': return 'bg-blue-600';
                                                    case 'pending': return 'bg-yellow-600';
                                                    case 'completed': return 'bg-green-600';
                                                    case 'cancelled': return 'bg-red-600';
                                                    default: return 'bg-gray-600';
                                                }
                                            };

                                            const getStatusText = () => {
                                                switch (appt.status) {
                                                    case 'confirmed': return 'Confirmed';
                                                    case 'pending': return 'Pending Confirmation';
                                                    case 'completed': return 'Completed';
                                                    case 'cancelled': return 'Cancelled';
                                                    default: return appt.status;
                                                }
                                            };

                                            return (
                                                <div key={appt.id} className="border border-blue-200 rounded-lg p-4 bg-blue-50">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <h4 className="font-bold text-gray-800">{appt.doctorName}</h4>
                                                            <p className="text-sm text-gray-600 mt-1">
                                                                <i className="fas fa-calendar mr-2"></i>
                                                                {new Date(appt.date).toLocaleDateString('en-IN')}
                                                            </p>
                                                            <p className="text-sm text-gray-600">
                                                                <i className="fas fa-clock mr-2"></i>
                                                                {appt.timeSlot}
                                                            </p>
                                                        </div>
                                                        <span className={`${getStatusColor()} text-white px-3 py-1 rounded-full text-xs font-bold`}>
                                                            {getStatusText()}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* History Tab */}
                        {activeTab === 'history' && (
                            <div>
                                {(() => {
                                    // Combine all events for history
                                    const historyEvents = [
                                        ...reports.map(r => ({ ...r, type: 'report', date: r.createdAt })),
                                        ...prescriptions.map(p => ({ ...p, type: 'prescription', date: p.visitDate })),
                                        ...appointments.filter(a => a.status === 'completed' || a.status === 'cancelled').map(a => ({ ...a, type: 'appointment', date: a.date }))
                                    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                                    if (historyEvents.length === 0) {
                                        return (
                                            <div className="text-center py-12">
                                                <i className="fas fa-history text-6xl text-gray-300 mb-4"></i>
                                                <h3 className="text-xl font-bold text-gray-800 mb-2">No History Yet</h3>
                                                <p className="text-gray-600">Your medical timeline will appear here</p>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div className="relative border-l-2 border-gray-200 ml-3 space-y-6 pl-6 py-2">
                                            {historyEvents.map((event, idx) => (
                                                <div key={`${event.type}-${event.id}`} className="relative">
                                                    {/* Timeline Dot */}
                                                    <div className={`absolute -left-[31px] w-4 h-4 rounded-full border-2 border-white shadow-sm ${event.type === 'report' ? 'bg-green-500' :
                                                        event.type === 'prescription' ? 'bg-purple-500' :
                                                            event.status === 'cancelled' ? 'bg-red-500' : 'bg-blue-500'
                                                        }`}></div>

                                                    <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm hover:shadow-md transition">
                                                        <div className="flex justify-between items-start">
                                                            <div>
                                                                <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded ${event.type === 'report' ? 'bg-green-100 text-green-700' :
                                                                    event.type === 'prescription' ? 'bg-purple-100 text-purple-700' :
                                                                        event.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                                                                    }`}>
                                                                    {event.type === 'appointment' ? event.status : event.type}
                                                                </span>

                                                                <p className="font-bold text-gray-800 mt-2">
                                                                    {event.type === 'report' ? event.testName :
                                                                        event.type === 'prescription' ? `Prescription by Dr. ${event.doctorName}` :
                                                                            `Appointment with Dr. ${event.doctorName}`}
                                                                </p>

                                                                <p className="text-sm text-gray-500 mt-1">
                                                                    <i className="far fa-clock mr-1"></i>
                                                                    {new Date(event.date).toLocaleDateString('en-IN', {
                                                                        weekday: 'long',
                                                                        year: 'numeric',
                                                                        month: 'long',
                                                                        day: 'numeric'
                                                                    })}
                                                                </p>
                                                            </div>

                                                            {/* Actions */}
                                                            {event.type === 'report' && (
                                                                <a href={`/print/report/${event.id}?patient=true`} target="_blank" className="text-green-600 hover:text-green-700 bg-green-50 hover:bg-green-100 p-2 rounded-lg transition">
                                                                    <i className="fas fa-download"></i>
                                                                </a>
                                                            )}
                                                            {event.type === 'prescription' && (
                                                                <a href={`/print/opd/${event.rxId}`} target="_blank" className="text-purple-600 hover:text-purple-700 bg-purple-50 hover:bg-purple-100 p-2 rounded-lg transition">
                                                                    <i className="fas fa-eye"></i>
                                                                </a>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Book Appointment Modal */}
            {showBookModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-t-2xl">
                            <h2 className="text-2xl font-bold">Book New Appointment</h2>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* Patient Details Section */}
                            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                                <h3 className="font-bold text-blue-900 mb-3">
                                    <i className="fas fa-user mr-2"></i>
                                    Patient Details
                                </h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="col-span-2">
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                                            Full Name *
                                        </label>
                                        <input
                                            type="text"
                                            value={bookingPatientData.name}
                                            onChange={(e) => setBookingPatientData({ ...bookingPatientData, name: e.target.value })}
                                            className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                                            placeholder="Enter full name"
                                            required
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                                            Mobile Number *
                                        </label>
                                        <input
                                            type="tel"
                                            value={bookingPatientData.mobile}
                                            onChange={(e) => setBookingPatientData({ ...bookingPatientData, mobile: e.target.value })}
                                            className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                                            placeholder="+91 9876543210"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                                            Age *
                                        </label>
                                        <input
                                            type="number"
                                            value={bookingPatientData.age}
                                            onChange={(e) => setBookingPatientData({ ...bookingPatientData, age: e.target.value })}
                                            className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                                            placeholder="Age"
                                            min="1"
                                            max="150"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                                            Gender *
                                        </label>
                                        <select
                                            value={bookingPatientData.gender}
                                            onChange={(e) => setBookingPatientData({ ...bookingPatientData, gender: e.target.value })}
                                            className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                                            required
                                        >
                                            <option value="">Select</option>
                                            <option value="Male">Male</option>
                                            <option value="Female">Female</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                                            Address *
                                        </label>
                                        <textarea
                                            value={bookingPatientData.address}
                                            onChange={(e) => setBookingPatientData({ ...bookingPatientData, address: e.target.value })}
                                            className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                                            placeholder="Enter full address"
                                            rows={2}
                                            required
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            Service Required *
                                        </label>
                                        <div className="flex gap-4">
                                            <label className="flex items-center cursor-pointer">
                                                <input
                                                    type="radio"
                                                    checked={bookingPatientData.serviceType === 'opd'}
                                                    onChange={() => setBookingPatientData({ ...bookingPatientData, serviceType: 'opd' })}
                                                    className="mr-2"
                                                />
                                                <span className="text-sm">OPD Consultation</span>
                                            </label>
                                            <label className="flex items-center cursor-pointer">
                                                <input
                                                    type="radio"
                                                    checked={bookingPatientData.serviceType === 'lab'}
                                                    onChange={() => setBookingPatientData({ ...bookingPatientData, serviceType: 'lab' })}
                                                    className="mr-2"
                                                />
                                                <span className="text-sm">Lab Test</span>
                                            </label>
                                            <label className="flex items-center cursor-pointer">
                                                <input
                                                    type="radio"
                                                    checked={bookingPatientData.serviceType === 'both'}
                                                    onChange={() => setBookingPatientData({ ...bookingPatientData, serviceType: 'both' })}
                                                    className="mr-2"
                                                />
                                                <span className="text-sm">Both</span>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Select Lab/Clinic */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Select Clinic/Lab *
                                </label>
                                <select
                                    value={selectedLab}
                                    onChange={(e) => handleLabChange(e.target.value)}
                                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                                    required
                                >
                                    <option value="">Choose a clinic...</option>
                                    {labs.map((lab) => (
                                        <option key={lab.id} value={lab.id}>
                                            {lab.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Select Doctor */}
                            {selectedLab && (
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Select Doctor *
                                    </label>
                                    <select
                                        value={selectedDoctor}
                                        onChange={(e) => setSelectedDoctor(e.target.value)}
                                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                                        required
                                    >
                                        <option value="">Choose a doctor...</option>
                                        {doctors.map((doc) => (
                                            <option key={doc.id} value={doc.id}>
                                                {doc.name} - {doc.specialization || 'General'}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Select Date */}
                            {selectedDoctor && (
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Select Date *
                                    </label>
                                    <input
                                        type="date"
                                        value={selectedDate}
                                        onChange={(e) => setSelectedDate(e.target.value)}
                                        min={new Date().toISOString().split('T')[0]}
                                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                                        required
                                    />
                                </div>
                            )}

                            {/* Select Time Slot */}
                            {selectedDate && (
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Select Time Slot *
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {timeSlots.map((slot) => (
                                            <button
                                                key={slot}
                                                type="button"
                                                onClick={() => setSelectedSlot(slot)}
                                                className={`px-4 py-3 rounded-lg border-2 font-semibold transition ${selectedSlot === slot
                                                    ? 'bg-blue-600 text-white border-blue-600'
                                                    : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                                                    }`}
                                            >
                                                {slot}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Buttons */}
                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={handleBookAppointment}
                                    disabled={bookingLoading || !selectedSlot}
                                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold transition disabled:opacity-50"
                                >
                                    {bookingLoading ? (
                                        <>
                                            <i className="fas fa-spinner fa-spin mr-2"></i>
                                            Booking...
                                        </>
                                    ) : (
                                        'Confirm Booking'
                                    )}
                                </button>
                                <button
                                    onClick={() => setShowBookModal(false)}
                                    className="px-6 bg-gray-300 hover:bg-gray-400 text-gray-800 py-3 rounded-lg font-bold transition"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
