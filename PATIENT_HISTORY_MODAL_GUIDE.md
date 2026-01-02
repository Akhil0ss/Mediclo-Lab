# Patient History Modal - Implementation Guide

## Issue Fixed
1. **Doctor Patient Filtering**: Updated to check `doctorId`, `assignedDoctorId`, and `doctorName` fields
2. **Patient History Modal**: Enhanced view modal to show complete patient history

## Changes Made to patients/page.tsx

### 1. Fixed Doctor Filtering (Lines 116-130)
```tsx
if (userProfile?.role === 'doctor') {
    const doctorId = userProfile?.doctorId || user?.uid;
    const doctorName = userProfile?.name;
    
    // Get unique patient IDs from OPD visits where this doctor consulted
    const assignedPatientIds = new Set(
        opdVisits
            .filter(opd => 
                opd.doctorId === doctorId || 
                opd.assignedDoctorId === doctorId ||
                (doctorName && opd.doctorName === doctorName)
            )
            .map(opd => opd.patientId)
    );
    basePatients = patients.filter(p => assignedPatientIds.has(p.id));
}
```

### 2. Enhanced View Modal (Lines 764-789)
Replace the existing simple view modal with comprehensive history modal showing:

**Patient Basic Info:**
- Name, Age/Gender, Contact, Token, Ref Doctor, Address

**Lab Reports Section:**
- Report ID, Sample ID, Date, Threat Level
- Sorted by date (newest first)
- Color-coded threat levels (Critical=Red, High=Orange, Medium=Yellow, Normal=Green)

**OPD Visits Section:**
- RX ID, Doctor Name, Visit Date, Status (Finalized/Pending)
- **Vitals**: BP, Pulse, Temperature, Weight, SpO2
- **Complaints**: Patient complaints
- **Diagnosis**: Doctor's diagnosis
- **Follow-up Date**: If scheduled

**Lab Samples Section:**
- Sample Number, Date, Status (Completed/Pending)

## Complete Modal Code

Replace lines 764-789 in `src/app/dashboard/patients/page.tsx` with:

```tsx
{/* View Patient History Modal */}
<Modal isOpen={showViewModal} onClose={() => setShowViewModal(false)}>
    <h3 className="text-2xl font-bold mb-4 text-gray-800 border-b pb-3">
        <i className="fas fa-user-circle mr-2 text-blue-600"></i>
        Patient Complete History
    </h3>
    {selectedPatient && (
        <div className="max-h-[70vh] overflow-y-auto">
            {/* Patient Basic Info */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg mb-4 border border-blue-200">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                    <div><strong className="text-gray-700">Name:</strong> <span className="text-gray-900">{selectedPatient.name}</span></div>
                    <div><strong className="text-gray-700">Age/Gender:</strong> <span className="text-gray-900">{selectedPatient.age} / {selectedPatient.gender}</span></div>
                    <div><strong className="text-gray-700">Contact:</strong> <span className="text-gray-900">{selectedPatient.mobile}</span></div>
                    <div><strong className="text-gray-700">Token:</strong> <span className="font-mono text-purple-600">{selectedPatient.token || 'N/A'}</span></div>
                    <div><strong className="text-gray-700">Ref. Doctor:</strong> <span className="text-gray-900">{selectedPatient.refDoctor || 'N/A'}</span></div>
                    <div><strong className="text-gray-700">Address:</strong> <span className="text-gray-900">{selectedPatient.address || 'N/A'}</span></div>
                </div>
            </div>

            {/* Lab Reports History */}
            <div className="mb-4">
                <h4 className="font-bold text-lg mb-2 text-purple-700 flex items-center">
                    <i className="fas fa-file-medical mr-2"></i>
                    Lab Reports ({reports.filter(r => r.patientId === selectedPatient.id).length})
                </h4>
                {reports.filter(r => r.patientId === selectedPatient.id).length === 0 ? (
                    <p className="text-gray-500 text-sm italic pl-6">No lab reports found</p>
                ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                        {reports
                            .filter(r => r.patientId === selectedPatient.id)
                            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                            .map(report => (
                                <div key={report.id} className="bg-white border border-purple-200 rounded-lg p-3 hover:shadow-md transition">
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1">
                                            <div className="font-semibold text-purple-600">Report ID: {report.reportId}</div>
                                            <div className="text-sm text-gray-600">Sample: {report.sampleId}</div>
                                            <div className="text-xs text-gray-500 mt-1">
                                                {new Date(report.createdAt).toLocaleString('en-IN')}
                                            </div>
                                        </div>
                                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                            report.threatLevel === 'Critical' ? 'bg-red-100 text-red-700' :
                                            report.threatLevel === 'High' ? 'bg-orange-100 text-orange-700' :
                                            report.threatLevel === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                                            'bg-green-100 text-green-700'
                                        }`}>
                                            {report.threatLevel || 'Normal'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                    </div>
                )}
            </div>

            {/* OPD Visits History */}
            <div className="mb-4">
                <h4 className="font-bold text-lg mb-2 text-green-700 flex items-center">
                    <i className="fas fa-stethoscope mr-2"></i>
                    OPD Visits & Prescriptions ({opdVisits.filter(v => v.patientId === selectedPatient.id).length})
                </h4>
                {opdVisits.filter(v => v.patientId === selectedPatient.id).length === 0 ? (
                    <p className="text-gray-500 text-sm italic pl-6">No OPD visits found</p>
                ) : (
                    <div className="space-y-3 max-h-80 overflow-y-auto">
                        {opdVisits
                            .filter(v => v.patientId === selectedPatient.id)
                            .sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime())
                            .map(visit => (
                                <div key={visit.id} className="bg-white border border-green-200 rounded-lg p-4 hover:shadow-md transition">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <div className="font-semibold text-green-600">RX ID: {visit.rxId}</div>
                                            <div className="text-sm text-gray-600">Dr. {visit.doctorName}</div>
                                            <div className="text-xs text-gray-500">
                                                {new Date(visit.visitDate).toLocaleDateString('en-IN')}
                                            </div>
                                        </div>
                                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                            visit.isFinal ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                                        }`}>
                                            {visit.isFinal ? 'Finalized' : 'Pending'}
                                        </span>
                                    </div>
                                    
                                    {/* Vitals */}
                                    {visit.vitals && (
                                        <div className="bg-blue-50 p-2 rounded mb-2">
                                            <div className="text-xs font-semibold text-blue-700 mb-1">Vitals:</div>
                                            <div className="grid grid-cols-3 gap-2 text-xs">
                                                {visit.vitals.bp && <div><strong>BP:</strong> {visit.vitals.bp}</div>}
                                                {visit.vitals.pulse && <div><strong>Pulse:</strong> {visit.vitals.pulse}</div>}
                                                {visit.vitals.temp && <div><strong>Temp:</strong> {visit.vitals.temp}</div>}
                                                {visit.vitals.weight && <div><strong>Weight:</strong> {visit.vitals.weight}</div>}
                                                {visit.vitals.spo2 && <div><strong>SpO2:</strong> {visit.vitals.spo2}</div>}
                                            </div>
                                        </div>
                                    )}

                                    {/* Complaints & Diagnosis */}
                                    {visit.complaints && (
                                        <div className="mb-2">
                                            <div className="text-xs font-semibold text-gray-700">Complaints:</div>
                                            <div className="text-sm text-gray-600">{visit.complaints}</div>
                                        </div>
                                    )}
                                    {visit.diagnosis && (
                                        <div className="mb-2">
                                            <div className="text-xs font-semibold text-gray-700">Diagnosis:</div>
                                            <div className="text-sm text-gray-600">{visit.diagnosis}</div>
                                        </div>
                                    )}

                                    {/* Follow-up */}
                                    {visit.followUpDate && (
                                        <div className="text-xs text-orange-600 mt-2">
                                            <i className="fas fa-calendar-check mr-1"></i>
                                            Follow-up: {new Date(visit.followUpDate).toLocaleDateString('en-IN')}
                                        </div>
                                    )}
                                </div>
                            ))}
                    </div>
                )}
            </div>

            {/* Samples History */}
            <div className="mb-4">
                <h4 className="font-bold text-lg mb-2 text-orange-700 flex items-center">
                    <i className="fas fa-vial mr-2"></i>
                    Lab Samples ({samples.filter(s => s.patientId === selectedPatient.id).length})
                </h4>
                {samples.filter(s => s.patientId === selectedPatient.id).length === 0 ? (
                    <p className="text-gray-500 text-sm italic pl-6">No samples found</p>
                ) : (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                        {samples
                            .filter(s => s.patientId === selectedPatient.id)
                            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                            .map(sample => (
                                <div key={sample.id} className="bg-white border border-orange-200 rounded-lg p-2 text-sm">
                                    <div className="flex justify-between">
                                        <div>
                                            <span className="font-semibold text-orange-600">Sample: {sample.sampleNumber}</span>
                                            <div className="text-xs text-gray-500">
                                                {new Date(sample.createdAt).toLocaleDateString('en-IN')}
                                            </div>
                                        </div>
                                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                            sample.status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                                        }`}>
                                            {sample.status}
                                        </span>
                                    </div>
                                </div>
                            ))}
                    </div>
                )}
            </div>
        </div>
    )}
    <button
        onClick={() => setShowViewModal(false)}
        className="w-full bg-gradient-to-r from-gray-500 to-gray-600 text-white py-3 rounded-lg hover:from-gray-600 hover:to-gray-700 transition font-semibold mt-4"
    >
        <i className="fas fa-times mr-2"></i>
        Close
    </button>
</Modal>
```

## Features Implemented

### ✅ Doctor Patient Filtering
- Checks `doctorId`, `assignedDoctorId`, and `doctorName`
- Shows only patients the doctor has consulted
- Works with all OPD data structures

### ✅ Comprehensive Patient History
- **Basic Info**: All patient demographics
- **Lab Reports**: Complete report history with threat levels
- **OPD Visits**: Full consultation history including:
  - Vitals (BP, Pulse, Temp, Weight, SpO2)
  - Complaints
  - Diagnosis
  - Follow-up dates
- **Samples**: Lab sample tracking
- **Sorted**: All data sorted by date (newest first)
- **Scrollable**: Sections have max-height with scroll
- **Color-Coded**: Status badges for easy identification

## Testing
1. Login as doctor
2. Navigate to Patients tab
3. Should see only assigned patients
4. Click eye icon on any patient
5. View complete history with all data
