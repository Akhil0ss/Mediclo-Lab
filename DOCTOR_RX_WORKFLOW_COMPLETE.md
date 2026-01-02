# Doctor RX Workflow - Complete Implementation

## Overview
Implemented complete RX creation workflow for doctors with modal-based prescription creation and proper filtering.

## Changes Made

### 1. Dashboard Page (page.tsx)
**Updated Create RX Button:**
- Changed from `window.location.href` to `router.push` for smoother navigation
- Added `action=create` query parameter to trigger auto-open modal
- Passes `patientId` and `tokenId` as query parameters
- Added `useRouter` import from `next/navigation`

**Button Logic:**
```tsx
router.push(`/dashboard/opd?action=create&patientId=${token.patientId}&tokenId=${token.id}`);
```

### 2. OPD Page (opd/page.tsx)
**Auto-Open Modal Functionality:**
- Added `useEffect` to detect query parameters
- Auto-opens modal when `action=create` is present
- Pre-selects patient based on `patientId` parameter
- Clears query params after opening modal

**Hide Add Button for Doctors:**
- Wrapped "Add OPD / Rx" button in role check
- Button only visible for non-doctor roles
- Doctors create RX exclusively from assigned queue

**Existing Doctor Filtering (Already Implemented):**
- OPD visits filtered by `assignedDoctorId` or `doctorName`
- Doctors see only their own prescriptions

### 3. Workflow

**Doctor Flow:**
```
Assigned Queue Tab
    ↓
Click "Create RX" Button
    ↓
Navigate to RX Tab with Query Params
    ↓
Modal Auto-Opens with Patient Pre-Selected
    ↓
Fill Prescription Details
    ↓
Save (Pending Status)
    ↓
Finalize RX
    ↓
    ├─→ Reception OPD Tab (View/Print)
    └─→ Pharmacy Tab (View Only)
```

**Reception Flow:**
```
OPD/RX Tab
    ↓
Click "Add OPD / Rx" Button (Visible)
    ↓
Create Prescription
    ↓
View All RX (Finalized + Pending)
```

**Pharmacy Flow:**
```
Pharmacy Dashboard/Tab
    ↓
View Finalized RX Only
    ↓
Deliver Medicines
```

## RX Tab Behavior by Role

### Doctor
- **Can See:** Only their own RX (pending + finalized)
- **Can Do:** Create, Edit (own RX), Finalize
- **Cannot See:** "Add OPD / Rx" button (creates from queue only)

### Reception
- **Can See:** All RX (all doctors, pending + finalized)
- **Can Do:** Create, View, Print finalized RX
- **Can See:** "Add OPD / Rx" button

### Pharmacy
- **Can See:** Finalized RX only (all doctors)
- **Can Do:** View only (for medicine delivery)
- **Cannot Do:** Create, Edit, or access pending RX

## Status Tags

### Pending RX
- **Badge:** Yellow/Orange
- **Text:** "Pending" or "Draft"
- **Visible To:** Doctor (creator), Reception
- **Actions:** Edit, Finalize, Delete

### Finalized RX
- **Badge:** Green
- **Text:** "Finalized"
- **Visible To:** Doctor, Reception, Pharmacy
- **Actions:** View, Print (Reception only)

## Technical Implementation

### Query Parameter Handling
```typescript
useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const action = searchParams.get('action');
    const patientId = searchParams.get('patientId');

    if (action === 'create' && patientId && patients.length > 0) {
        setSelectedPatientId(patientId);
        resetForm();
        setShowModal(true);
        window.history.replaceState({}, '', '/dashboard/opd');
    }
}, [patients]);
```

### Role-Based Button Visibility
```typescript
{userProfile?.role !== 'doctor' && (
    <button onClick={() => setShowModal(true)}>
        Add OPD / Rx
    </button>
)}
```

### Doctor RX Filtering (Existing)
```typescript
if (userProfile?.role === 'doctor' && userProfile.doctorId) {
    const myData = data.filter(d =>
        d.assignedDoctorId === userProfile.doctorId ||
        d.doctorName === userProfile.name
    );
    setOpdVisits(myData);
}
```

## Features Implemented

### ✅ Modal Auto-Open
- Seamless transition from queue to RX creation
- Patient context preserved
- Clean URL after modal opens

### ✅ Role-Based Access
- Doctors: Create from queue only
- Reception: Full access with Add button
- Pharmacy: View finalized only

### ✅ Status Management
- Pending vs Finalized distinction
- Visual badges for status
- Proper filtering by status

### ✅ Data Flow
- Doctor creates → Pending
- Doctor finalizes → Visible to all
- Reception can view/print finalized
- Pharmacy can view finalized for delivery

## Notes
- Modal opens automatically when navigating from queue
- Query parameters are cleared after modal opens (clean URL)
- Doctor filtering already existed, now integrated with workflow
- "Add OPD / Rx" button hidden for doctors (queue-based workflow)
- All RX data uses `ownerId` for multi-tenancy support
