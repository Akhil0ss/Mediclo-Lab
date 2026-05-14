# Implementation Plan - All 10 Features + Technical Debt

## Status: IN PROGRESS

### Feature 1: OPD Edit with RX Locking ✅ STARTED
**Status**: Partially implemented
**Completed**:
- ✅ Added `editMode` and `selectedVisit` state
- ✅ Added `isLockedByDoctor` and `lockedAt` fields to OPDVisit interface
- ✅ Implemented `handleEdit` function to load visit data
- ✅ Auto-lock RX when doctor opens it

**Remaining**:
- Update `handleSubmit` to handle both create and update
- Add UI indicators for locked RX
- Disable medicine fields for receptionists when RX is locked
- Allow only follow-up fields (complaints, history, examination, advice, followUpDate) for receptionists
- Reset form when closing modal

**Logic**:
```
IF doctor opens RX:
  - Set isLockedByDoctor = true
  - Doctor can edit everything
  
IF receptionist opens locked RX:
  - Can ONLY edit: complaints, history, examination, advice, followUpDate
  - CANNOT edit: medicines, diagnosis
  
IF receptionist opens unlocked RX:
  - Can edit everything (until doctor touches it)
```

---

### Feature 2: Sample Status Update After Report
**Files**: `src/components/QuickReportModal.tsx`
**Changes Needed**:
1. After successful report generation
2. Update sample status to 'Completed'
3. Add `completedAt` timestamp
4. Refresh samples list

---

### Feature 3: Premium/Subscription Features
**Files**: Multiple (QuickReportModal, QuickOPDModal, print pages, samples)
**Changes Needed**:
1. Add subscription schema to Firebase
2. Create subscription context
3. Fetch subscription status
4. Apply watermark logic based on status
5. Add upgrade flow

---

### Feature 4: Lab Tests in Patient History
**File**: `src/app/dashboard/opd/page.tsx` line 648
**Changes Needed**:
1. Fetch patient's lab samples from Firebase
2. Display in patient history modal
3. Show test names, dates, status
4. Link to report PDFs

---

### Feature 5: Pharmacy isFinal Filter
**File**: `src/app/dashboard/pharmacy/page.tsx` line 38
**Changes Needed**:
1. Add filter: `data[key].isFinal === true`
2. Show only finalized prescriptions

---

### Feature 6: Threat Level Calculation
**Files**: Lab report generation
**Changes Needed**:
1. Compare result value with reference range
2. Calculate: Normal (within range), High (above max), Low (below min)
3. Add color coding

---

### Feature 7: User Enable/Disable Toggle
**File**: `src/app/dashboard/settings/page.tsx`
**Changes Needed**:
1. Add toggle button in user table
2. Update `isActive` field in Firebase
3. Show status indicator

---

### Feature 8: Doctor Deletion with Visit Checks
**File**: `src/app/dashboard/doctors/page.tsx`
**Changes Needed**:
1. Before deletion, check for existing OPD visits
2. Show warning if visits exist
3. Option to reassign visits or cancel deletion

---

### Feature 9: Patient Edit Enhancement
**File**: `src/app/dashboard/patients/page.tsx`
**Changes Needed**:
1. Add edit history tracking
2. Store who edited and when
3. Decide on token persistence

---

### Feature 10: Analytics Dashboard
**File**: `src/app/dashboard/analytics/page.tsx`
**Changes Needed**:
1. Real-time statistics
2. Revenue tracking
3. Patient visit trends
4. Popular tests/medicines
5. Doctor performance metrics

---

## Technical Debt

### 1. CSS Linting Errors
**Status**: Low priority, works fine
**Action**: Add `/* eslint-disable */` comments if needed

### 2. Vercel Deployment
**Status**: Waiting for user
**Action**: User needs to configure Vercel project

### 3. Firebase Rules Deployment
**Status**: Waiting for user
**File**: `database.rules.json`
**Action**: User must deploy to Firebase Console

---

## Implementation Order (By Priority)

### Phase 1 - Critical (This Session):
1. ✅ OPD Edit with RX Locking (IN PROGRESS)
2. Sample Status Update
3. Pharmacy isFinal Filter
4. Lab Tests in Patient History

### Phase 2 - Important (Next):
5. Threat Level Calculation
6. User Enable/Disable
7. Doctor Deletion Checks

### Phase 3 - Enhancement (Later):
8. Premium/Subscription
9. Patient Edit History
10. Analytics Dashboard

---

**Last Updated**: December 21, 2025, 12:10 AM IST
