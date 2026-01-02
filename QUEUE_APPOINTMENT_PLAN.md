# Queue & Appointment System Enhancement Plan

## Requirements Summary

### 1. Queue Creation Enhancements
- ✅ Show tags for: LAB, OPD, OL (Online), WEB
- ✅ Display scheduled time/date for web appointments
- ✅ Show chosen doctor for web appointments
- ✅ Default list: Today's added patients
- ✅ Date filter for previously registered patients
- ✅ Web appointments only show on scheduled date (not before)

### 2. Patient Management
- ✅ Prevent duplicate credentials for same mobile number
- ✅ One patient = one dashboard (filter by mobile)
- ✅ Web appointment patients added to queue on scheduled date only

### 3. Appointment Cleanup
- ✅ Delete web appointment when Rx created by doctor
- ✅ Remove completed appointments from patient dashboard after Rx creation

### 4. Patient Dashboard Additions
- ✅ Rx history with view-only access
- ✅ Report history with view and download

## Implementation Steps

### Step 1: Update Queue Creation Page
**File:** `src/app/dashboard/queue/page.tsx`
- Add patient source tags (LAB/OPD/OL/WEB)
- Show web appointment details (date, time, doctor)
- Filter today's patients by default
- Add date filter for historical patients
- Filter web appointments by scheduled date

### Step 2: Patient Addition Logic
**File:** `src/app/dashboard/patients/page.tsx` or API
- Check mobile number before creating credentials
- Link existing patient if mobile exists
- Prevent duplicate dashboard creation

### Step 3: Rx Creation Cleanup
**File:** `src/app/dashboard/opd/page.tsx` (or Rx creation component)
- Delete web appointment after Rx creation
- Update patient appointment status

### Step 4: Patient Dashboard Enhancements
**File:** `src/app/patient/dashboard/page.tsx`
- Add Rx history section
- Add report history section (already exists, enhance if needed)
- View-only Rx display
- Report view and download

### Step 5: Web Appointment Filtering
**Logic:** Filter appointments by scheduled date
- Only show in queue on/after scheduled date
- Hide before scheduled date

## Database Structure

### Patient Record
```
patients/{ownerId}/{patientId}
  - mobile (unique identifier)
  - credentials (if created)
  - source: "lab" | "opd" | "online" | "web"
```

### Web Appointments
```
appointments/{ownerId}/{date}/{appointmentId}
  - patientMobile
  - scheduledDate
  - scheduledTime
  - doctorName
  - status: "confirmed" | "completed" | "cancelled"
```

### Rx Records
```
prescriptions/{ownerId}/{rxId}
  - patientId
  - patientMobile
  - createdAt
  - doctorName
```

## Priority Order
1. Queue creation page updates (tags, filters)
2. Patient duplicate prevention
3. Rx creation cleanup
4. Patient dashboard Rx history
5. Web appointment date filtering

---
**Status:** Planning Complete - Ready for Implementation
