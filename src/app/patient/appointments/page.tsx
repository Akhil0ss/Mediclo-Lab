'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/contexts/ToastContext';
import { ref, onValue, push, set } from 'firebase/database';
import { database } from '@/lib/firebase';
import Link from 'next/link';

export default function PatientAppointments() {
    const router = useRouter();
    const { showToast } = useToast();
    const [appointments, setAppointments] = useState<any[]>([]);
    const [labs, setLabs] = useState<any[]>([]);
    const [doctors, setDoctors] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showBookModal, setShowBookModal] = useState(false);

    // Booking form
    const [selectedLab, setSelectedLab] = useState('');
    const [selectedDoctor, setSelectedDoctor] = useState('');
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedSlot, setSelectedSlot] = useState('');
    const [bookingLoading, setBookingLoading] = useState(false);

    // Full patient data for appointment
    const [patientData, setPatientData] = useState({
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
        const mobile = localStorage.getItem('patient_mobile');
        const name = localStorage.getItem('patient_name');

        if (!mobile) {
            router.push('/patient');
            return;
        }

        // Pre-fill patient data
        setPatientData(prev => ({
            ...prev,
            name: name || '',
            mobile: mobile || ''
        }));

        fetchPatientAppointments(mobile);
        fetchAvailableLabs();
    }, [router]);

    const fetchPatientAppointments = (mobile: string) => {
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
                                    labId,
                                    ...appt
                                });
                            }
                        }
                    }
                }

                patientAppointments.sort((a, b) =>
                    new Date(b.date).getTime() - new Date(a.date).getTime()
                );

                setAppointments(patientAppointments);
            }
            setLoading(false);
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
                        // Fetch branding data for lab name
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
        // Prevent duplicate bookings
        if (bookingLoading) {
            console.log('Booking already in progress, ignoring duplicate click');
            return;
        }

        // Validate all fields
        if (!selectedLab || !selectedDoctor || !selectedDate || !selectedSlot) {
            showToast('Please fill all appointment details', 'warning');
            return;
        }

        if (!patientData.name || !patientData.mobile || !patientData.age || !patientData.gender || !patientData.address) {
            showToast('Please fill all patient details including address', 'warning');
            return;
        }

        setBookingLoading(true);

        try {
            const doctor = doctors.find(d => d.id === selectedDoctor);

            const appointmentData = {
                // Patient Details
                patientData: {
                    name: patientData.name,
                    mobile: patientData.mobile,
                    age: parseInt(patientData.age),
                    gender: patientData.gender,
                    address: patientData.address || '',
                    serviceType: patientData.serviceType
                },

                // Appointment Details
                doctorId: selectedDoctor,
                doctorName: doctor?.name || 'Doctor',
                date: selectedDate,
                timeSlot: selectedSlot,
                status: 'pending', // Receptionist needs to confirm
                source: 'WEB', // Tag for web appointments
                bookedAt: new Date().toISOString(),
                labId: selectedLab,

                // Legacy fields for backward compatibility
                patientName: patientData.name,
                patientMobile: patientData.mobile
            };

            // Save to appointments/labId/date
            const apptRef = ref(database, `appointments/${selectedLab}/${selectedDate}`);
            await push(apptRef, appointmentData);

            showToast('Appointment booked successfully! The clinic will confirm shortly.', 'success');
            setShowBookModal(false);

            // Reset form
            setSelectedLab('');
            setSelectedDoctor('');
            setSelectedDate('');
            setSelectedSlot('');
            setPatientData(prev => ({
                ...prev,
                age: '',
                gender: '',
                address: '',
                serviceType: 'opd'
            }));

        } catch (error) {
            console.error('Booking error:', error);
            showToast('Failed to book appointment. Please try again.', 'error');
        } finally {
            setBookingLoading(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'scheduled': return 'bg-blue-100 text-blue-800';
            case 'completed': return 'bg-green-100 text-green-800';
            case 'cancelled': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <i className="fas fa-spinner fa-spin text-4xl text-blue-600"></i>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 shadow-lg">
                <div className="max-w-6xl mx-auto">
                    <Link href="/patient/dashboard" className="text-white hover:text-blue-100 mb-2 inline-block">
                        <i className="fas fa-arrow-left mr-2"></i> Back to Dashboard
                    </Link>
                    <h1 className="text-3xl font-bold">My Appointments</h1>
                    <p className="text-blue-100 mt-1">Book and manage your doctor appointments</p>
                </div>
            </div>

            <div className="max-w-6xl mx-auto p-6">
                {/* Book New Appointment Button */}
                <div className="mb-6">
                    <button
                        onClick={() => setShowBookModal(true)}
                        className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg font-bold hover:from-blue-700 hover:to-purple-700 transition shadow-lg"
                    >
                        <i className="fas fa-plus mr-2"></i>
                        Book New Appointment
                    </button>
                </div>

                {/* Appointments List */}
                {appointments.length === 0 ? (
                    <div className="bg-white rounded-xl shadow p-12 text-center">
                        <i className="fas fa-calendar-times text-6xl text-gray-300 mb-4"></i>
                        <h3 className="text-xl font-bold text-gray-800 mb-2">No Appointments Yet</h3>
                        <p className="text-gray-600">Click the "Book New Appointment" button above to get started</p>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {appointments.map((appt) => (
                            <div
                                key={appt.id}
                                className="bg-white rounded-xl shadow p-6"
                            >
                                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-start gap-4">
                                            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                                <i className="fas fa-user-md text-blue-600 text-xl"></i>
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-bold text-gray-800 mb-1">
                                                    {appt.doctorName}
                                                </h3>
                                                <div className="space-y-1 text-sm text-gray-600">
                                                    <p>
                                                        <i className="fas fa-calendar mr-2"></i>
                                                        {new Date(appt.date).toLocaleDateString('en-IN', {
                                                            weekday: 'long',
                                                            year: 'numeric',
                                                            month: 'long',
                                                            day: 'numeric'
                                                        })}
                                                    </p>
                                                    <p>
                                                        <i className="fas fa-clock mr-2"></i>
                                                        {appt.timeSlot}
                                                    </p>
                                                    <p className="text-xs text-gray-500">
                                                        Booked on {new Date(appt.bookedAt).toLocaleDateString('en-IN')}
                                                    </p>
                                                    {appt.queueNumber && (
                                                        <p className="text-sm font-bold text-green-600 mt-2">
                                                            <i className="fas fa-hashtag mr-1"></i>
                                                            Queue: {appt.queueNumber}
                                                        </p>
                                                    )}
                                                    {appt.sampleId && (
                                                        <p className="text-sm font-bold text-blue-600 mt-2">
                                                            <i className="fas fa-vial mr-1"></i>
                                                            Sample: {appt.sampleId}
                                                        </p>
                                                    )}
                                                    {appt.token && (
                                                        <p className="text-sm font-bold text-purple-600 mt-2">
                                                            <i className="fas fa-ticket-alt mr-1"></i>
                                                            Token: {appt.token}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <span className={`px-4 py-2 rounded-full text-sm font-bold ${getStatusColor(appt.status)}`}>
                                            {appt.status.charAt(0).toUpperCase() + appt.status.slice(1)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
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
                                            value={patientData.name}
                                            onChange={(e) => setPatientData({ ...patientData, name: e.target.value })}
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
                                            value={patientData.mobile}
                                            onChange={(e) => setPatientData({ ...patientData, mobile: e.target.value })}
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
                                            value={patientData.age}
                                            onChange={(e) => setPatientData({ ...patientData, age: e.target.value })}
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
                                            value={patientData.gender}
                                            onChange={(e) => setPatientData({ ...patientData, gender: e.target.value })}
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
                                            value={patientData.address}
                                            onChange={(e) => setPatientData({ ...patientData, address: e.target.value })}
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
                                                    checked={patientData.serviceType === 'opd'}
                                                    onChange={() => setPatientData({ ...patientData, serviceType: 'opd' })}
                                                    className="mr-2"
                                                />
                                                <span className="text-sm">OPD Consultation</span>
                                            </label>
                                            <label className="flex items-center cursor-pointer">
                                                <input
                                                    type="radio"
                                                    checked={patientData.serviceType === 'lab'}
                                                    onChange={() => setPatientData({ ...patientData, serviceType: 'lab' })}
                                                    className="mr-2"
                                                />
                                                <span className="text-sm">Lab Test</span>
                                            </label>
                                            <label className="flex items-center cursor-pointer">
                                                <input
                                                    type="radio"
                                                    checked={patientData.serviceType === 'both'}
                                                    onChange={() => setPatientData({ ...patientData, serviceType: 'both' })}
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
