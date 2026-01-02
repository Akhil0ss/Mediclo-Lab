# Doctor RX Flow - Complete Implementation Guide

## Overview
Complete doctor workflow from assigned queue to RX creation with vitals preloading and patient history access.

## Changes Required

### 1. OPD Page - Preload Vitals (src/app/dashboard/opd/page.tsx)

**Replace lines 144-162** with:

```tsx
    // Handle query parameters for auto-opening modal
    useEffect(() => {
        if (typeof window === 'undefined') return;
        
        const searchParams = new URLSearchParams(window.location.search);
        const action = searchParams.get('action');
        const patientId = searchParams.get('patientId');
        const tokenId = searchParams.get('tokenId');

        if (action === 'create' && patientId && patients.length > 0) {
            // Auto-open modal with patient pre-selected
            setSelectedPatientId(patientId);
            resetForm();
            
            // Preload vitals from queue token if available
            if (tokenId) {
                const dateKey = new Date().toISOString().split('T')[0].replace(/-/g, '');
                const { ref, get } = require('firebase/database');
                const { database } = require('@/lib/firebase');
                
                get(ref(database, `opd_queue/${dataSourceId}/${dateKey}/${tokenId}`))
                    .then((snapshot: any) => {
                        if (snapshot.exists()) {
                            const tokenData = snapshot.val();
                            if (tokenData.vitals) {
                                setVisitData(prev => ({
                                    ...prev,
                                    bp: tokenData.vitals.bp || '',
                                    pulse: tokenData.vitals.pulse || '',
                                    temp: tokenData.vitals.temperature || '',
                                    weight: tokenData.vitals.weight || '',
                                    spo2: tokenData.vitals.spo2 || '',
                                    complaints: tokenData.complaints || ''
                                }));
                            }
                        }
                    })
                    .catch((error: any) => console.error('Error loading vitals:', error));
            }
            
            setShowModal(true);
            
            // Clear query params
            window.history.replaceState({}, '', '/dashboard/opd');
        }
    }, [patients, dataSourceId]);
```

### 2. Add Patient History Modal State

**Add after line 90** (after `showPatientHistory` state):

```tsx
    const [showPatientHistoryInModal, setShowPatientHistoryInModal] = useState(false);
    const [currentPatientForHistory, setCurrentPatientForHistory] = useState<any>(null);
```

### 3. Add View History Button in OPD Modal

**Find the modal form section** (around line 550-600) and add this button **after the patient selection dropdown**:

```tsx
{selectedPatientId && (
    <button
        type="button"
        onClick={() => {
            const patient = patients.find(p => p.id === selectedPatientId);
            if (patient) {
                setCurrentPatientForHistory(patient);
                setShowPatientHistoryInModal(true);
            }
        }}
        className="w-full bg-blue-100 text-blue-700 py-2 px-4 rounded-lg hover:bg-blue-200 transition flex items-center justify-center gap-2 mb-4"
    >
        <i className="fas fa-history"></i>
        View Patient History
    </button>
)}
```

### 4. Add Patient History Modal in OPD Page

**Add before the closing `</div>` at the end of the component** (around line 860):

```tsx
            {/* Patient History Modal (In OPD) */}
            <Modal isOpen={showPatientHistoryInModal} onClose={() => setShowPatientHistoryInModal(false)}>
                <h3 className="text-2xl font-bold mb-4 text-gray-800 border-b pb-3">
                    <i className="fas fa-user-circle mr-2 text-blue-600"></i>
                    Patient Complete History
                </h3>
                {currentPatientForHistory && (
                    <div className="max-h-[70vh] overflow-y-auto">
                        {/* Patient Basic Info */}
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg mb-4 border border-blue-200">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                                <div><strong className="text-gray-700">Name:</strong> <span className="text-gray-900">{currentPatientForHistory.name}</span></div>
                                <div><strong className="text-gray-700">Age/Gender:</strong> <span className="text-gray-900">{currentPatientForHistory.age} / {currentPatientForHistory.gender}</span></div>
                                <div><strong className="text-gray-700">Contact:</strong> <span className="text-gray-900">{currentPatientForHistory.mobile}</span></div>
                                <div><strong className="text-gray-700">Token:</strong> <span className="font-mono text-purple-600">{currentPatientForHistory.token || 'N/A'}</span></div>
                            </div>
                        </div>

                        {/* OPD Visits History */}
                        <div className="mb-4">
                            <h4 className="font-bold text-lg mb-2 text-green-700 flex items-center">
                                <i className="fas fa-stethoscope mr-2"></i>
                                Previous Visits ({opdVisits.filter((v: any) => v.patientId === currentPatientForHistory.id).length})
                            </h4>
                            {opdVisits.filter((v: any) => v.patientId === currentPatientForHistory.id).length === 0 ? (
                                <p className="text-gray-500 text-sm italic pl-6">No previous visits</p>
                            ) : (
                                <div className="space-y-3 max-h-80 overflow-y-auto">
                                    {opdVisits
                                        .filter((v: any) => v.patientId === currentPatientForHistory.id)
                                        .sort((a: any, b: any) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime())
                                        .map((visit: any) => (
                                            <div key={visit.id} className="bg-white border border-green-200 rounded-lg p-4 hover:shadow-md transition">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <div className="font-semibold text-green-600">RX ID: {visit.rxId}</div>
                                                        <div className="text-sm text-gray-600">Dr. {visit.doctorName}</div>
                                                        <div className="text-xs text-gray-500">
                                                            {new Date(visit.visitDate).toLocaleDateString('en-IN')}
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                {/* Vitals */}
                                                {visit.vitals && (
                                                    <div className="bg-blue-50 p-2 rounded mb-2">
                                                        <div className="text-xs font-semibold text-blue-700 mb-1">Vitals:</div>
                                                        <div className="grid grid-cols-3 gap-2 text-xs">
                                                            {visit.vitals.bp && <div><strong>BP:</strong> {visit.vitals.bp}</div>}
                                                            {visit.vitals.pulse && <div><strong>Pulse:</strong> {visit.vitals.pulse}</div>}
                                                            {visit.vitals.temp && <div><strong>Temp:</strong> {visit.vitals.temp}</div>}
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
                                            </div>
                                        ))}
                                </div>
                            )}
                        </div>

                        {/* Lab Samples */}
                        <div className="mb-4">
                            <h4 className="font-bold text-lg mb-2 text-orange-700 flex items-center">
                                <i className="fas fa-vial mr-2"></i>
                                Lab Samples ({samples.filter((s: any) => s.patientId === currentPatientForHistory.id).length})
                            </h4>
                            {samples.filter((s: any) => s.patientId === currentPatientForHistory.id).length === 0 ? (
                                <p className="text-gray-500 text-sm italic pl-6">No samples found</p>
                            ) : (
                                <div className="space-y-2 max-h-40 overflow-y-auto">
                                    {samples
                                        .filter((s: any) => s.patientId === currentPatientForHistory.id)
                                        .map((sample: any) => (
                                            <div key={sample.id} className="bg-white border border-orange-200 rounded-lg p-2 text-sm">
                                                <div className="flex justify-between">
                                                    <span className="font-semibold text-orange-600">Sample: {sample.sampleNumber}</span>
                                                    <span className="text-xs text-gray-500">
                                                        {new Date(sample.createdAt).toLocaleDateString('en-IN')}
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
                    onClick={() => setShowPatientHistoryInModal(false)}
                    className="w-full bg-gradient-to-r from-gray-500 to-gray-600 text-white py-3 rounded-lg hover:from-gray-600 hover:to-gray-700 transition font-semibold mt-4"
                >
                    <i className="fas fa-times mr-2"></i>
                    Close
                </button>
            </Modal>
```

### 5. Update Queue Status After RX Save

**In the `handleSubmit` function** (around line 350-400), **after saving the RX**, add:

```tsx
// Update queue token status to completed
if (tokenId) {
    const dateKey = new Date().toISOString().split('T')[0].replace(/-/g, '');
    await update(ref(database, `opd_queue/${dataSourceId}/${dateKey}/${tokenId}`), {
        status: 'completed',
        completedAt: new Date().toISOString()
    });
}
```

## Doctor Flow Summary

### Complete Workflow:

1. **Doctor Dashboard (Assigned Queue Tab)**
   - Doctor sees assigned patients
   - Clicks "Create RX" button

2. **Navigate to RX Tab**
   - Modal auto-opens
   - Patient pre-selected
   - **Vitals preloaded from queue**
   - **Complaints preloaded**

3. **View History Button**
   - Click "View Patient History" in modal
   - See complete patient history:
     - Previous visits
     - Previous vitals
     - Previous complaints & diagnosis
     - Lab samples

4. **Create RX**
   - Fill prescription details
   - Add medicines
   - Click "Save" (Pending status)
   - OR Click "Finalize" (Finalized status)

5. **After Save/Finalize**
   - Modal closes
   - If finalized: Queue token marked as completed
   - If only saved: RX appears in RX tab with "Pending" tag
   - Doctor returns to queue tab

6. **RX Tab View**
   - Shows all doctor's RX
   - Pending RX: Yellow badge, "Create RX" button to continue
   - Finalized RX: Green badge, View/Print only

7. **Patients Tab**
   - Shows only assigned patients
   - Click patient name → View complete history

## Implementation Steps

1. Update `src/app/dashboard/opd/page.tsx`:
   - Replace vitals preloading logic (lines 144-162)
   - Add patient history modal states
   - Add "View History" button in RX modal
   - Add patient history modal component
   - Update queue status after RX save

2. Test the complete flow:
   - Login as doctor
   - See assigned queue
   - Click "Create RX"
   - Verify vitals are preloaded
   - Click "View History" button
   - Create and save RX
   - Verify it appears in RX tab

## Files Modified
- `src/app/dashboard/page.tsx` - Doctor queue with Create RX button ✅
- `src/app/dashboard/opd/page.tsx` - RX modal with vitals preload & history (needs manual update)
- `src/app/dashboard/patients/page.tsx` - Patient filtering ✅
- `src/app/dashboard/layout.tsx` - Doctor tabs ✅

## Status
- ✅ Doctor queue filtering
- ✅ Patient filtering  
- ✅ Navigation to RX tab
- ⏳ Vitals preloading (code ready, needs manual paste)
- ⏳ View History button (code ready, needs manual paste)
- ⏳ Patient history modal in OPD (code ready, needs manual paste)
