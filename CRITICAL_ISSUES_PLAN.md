# Critical Issues - Implementation Plan

## Priority 1: Authentication & Access Control Issues

### Issue 1.1: Premium Not Unlocked for Dashboard Users
**Problem:** Premium subscription not reflected across all dashboard users
**Root Cause:** Subscription status likely stored per-user instead of organization-wide
**Fix Required:**
- [ ] Update subscription context to check organization/owner subscription
- [ ] Ensure all users under same organization inherit premium status
- [ ] Fix database structure: `subscriptions/{ownerId}` instead of `subscriptions/{userId}`

### Issue 1.2: Doctor Dashboard Login Error
**Problem:** Doctors cannot login with correct credentials
**Root Cause:** Authentication logic issue specific to doctor role
**Fix Required:**
- [ ] Debug login route for doctor role
- [ ] Check if doctor credentials are stored differently
- [ ] Verify password hashing/comparison for doctor accounts
- [ ] Check if doctor role validation is blocking login

### Issue 1.3: Quick Report Access for Lab User
**Problem:** Lab users have access to quick report creation (should be restricted)
**Fix Required:**
- [ ] Add role-based access control to QuickReportModal
- [ ] Hide/disable quick report button for lab users
- [ ] Only allow receptionist/owner to create quick reports

## Priority 2: Data Synchronization Issues

### Issue 2.1: Lab Dashboard - Patient & Sample Data Not Synced
**Problem:** Lab users cannot see patient data and samples
**Root Cause:** Lab dashboard likely reading from wrong database path or missing data sync
**Fix Required:**
- [ ] Update lab dashboard to read from correct Firebase paths
- [ ] Ensure samples are created when reports are generated
- [ ] Sync patient data to lab-accessible paths
- [ ] Fix database structure: `samples/{ownerId}/{sampleId}`

### Issue 2.2: Web Appointments Not Synced to Main App
**Problem:** Appointments from web not showing in dashboard
**Root Cause:** Different database paths or missing sync logic
**Fix Required:**
- [ ] Verify appointment creation path from web
- [ ] Ensure appointments write to: `appointments/{ownerId}/{date}/{appointmentId}`
- [ ] Update dashboard to read from correct appointment path
- [ ] Add real-time listener for new appointments

### Issue 2.3: Patient Dashboard Not Synced with Related Data
**Problem:** Patients cannot see their RX, reports, history
**Fix Required:**
- [ ] Create patient dashboard data aggregation
- [ ] Fetch RX records by patientId
- [ ] Fetch lab reports by patientId
- [ ] Fetch appointment history by patientId
- [ ] Add view-only RX display
- [ ] Add downloadable reports section
- [ ] Add visit history timeline

## Priority 3: Web Appointment Workflow Enhancement

### Issue 3.1: Patient Pre-Registration for Appointments
**Problem:** Patients should fill all details before appointment booking
**Current Flow:** Patient books appointment → Receptionist creates patient manually
**Required Flow:** 
1. Patient fills complete profile on web (name, mobile, age, gender, address, etc.)
2. Patient selects service type: OPD, Lab, or Both
3. Patient books appointment slot
4. Appointment appears in receptionist dashboard with "WEB" tag
5. Receptionist can modify time/date from available slots
6. On appointment confirmation, patient is auto-created in system with timestamp

**Fix Required:**
- [ ] Update web appointment form to collect full patient details
- [ ] Add service type selection (OPD/Lab/Both)
- [ ] Store complete patient data with appointment
- [ ] Add "WEB" tag to web appointments
- [ ] Create patient record when receptionist confirms appointment
- [ ] Use appointment booking time as patient creation timestamp

### Issue 3.2: Receptionist Control Over Web Appointments
**Problem:** Receptionist cannot modify web appointment time/date
**Fix Required:**
- [ ] Add appointment management UI in receptionist dashboard
- [ ] Show available time slots
- [ ] Allow time/date modification
- [ ] Update appointment status (pending/confirmed/cancelled)
- [ ] Auto-create patient on confirmation with updated time

## Priority 4: Patient Dashboard Features

### Issue 4.1: Patient Dashboard - View RX
**Fix Required:**
- [ ] Create RX list view (read-only)
- [ ] Show prescription details, medicines, diagnosis
- [ ] Add date, doctor name, visit details
- [ ] No edit capability

### Issue 4.2: Patient Dashboard - Download Reports
**Fix Required:**
- [ ] Create reports list view
- [ ] Add download button for each report
- [ ] Generate PDF on-demand
- [ ] Show report date, test name, status

### Issue 4.3: Patient Dashboard - Visit History
**Fix Required:**
- [ ] Create timeline view of all visits
- [ ] Show OPD visits with date, doctor, diagnosis
- [ ] Show lab visits with date, tests, status
- [ ] Show appointment history

## Priority 5: Auto Patient Dashboard Creation

### Issue 5.1: Auto-Create Patient Dashboard on Walk-in Registration
**Current:** Patients registered via walk-in have no dashboard access
**Required:** Auto-create patient account with credentials

**Implementation:**
1. When receptionist adds new patient:
   - Generate unique username (e.g., `PAT{mobile}` or `PAT{UHID}`)
   - Generate random password (6-8 chars)
   - Create Firebase Auth account
   - Store credentials in database
   - Print credentials on RX footer
   - Print credentials on report footer

**Fix Required:**
- [ ] Add auto-account creation logic in patient registration
- [ ] Generate username: `PAT{mobile}` or custom format
- [ ] Generate secure random password
- [ ] Create Firebase Auth user
- [ ] Store in `patients/{ownerId}/{patientId}/credentials`
- [ ] Update RX PDF template to include credentials in footer
- [ ] Update Report PDF template to include credentials in footer
- [ ] Add "Your Login Credentials" section in footer

### Issue 5.2: Credentials Display Format
**Footer Template:**
```
─────────────────────────────────────────────────
Your Patient Portal Access:
Username: PAT9876543210
Password: Abc@1234
Login at: medos.spotnet.in/login
─────────────────────────────────────────────────
```

## Implementation Order

### Phase 1 (Critical - Day 1)
1. Fix doctor login issue
2. Fix premium subscription sync
3. Remove quick report access from lab users

### Phase 2 (High Priority - Day 2)
4. Fix lab dashboard data sync (patients & samples)
5. Fix web appointment sync to main app
6. Add receptionist appointment management

### Phase 3 (Medium Priority - Day 3)
7. Implement patient dashboard features (RX, Reports, History)
8. Update web appointment form for full patient details
9. Add service type selection (OPD/Lab/Both)

### Phase 4 (Enhancement - Day 4)
10. Implement auto patient dashboard creation
11. Update RX PDF with credentials footer
12. Update Report PDF with credentials footer
13. Add "WEB" tag to web appointments

## Database Structure Updates Required

```
users/
  {ownerId}/
    subscription: { status, plan, expiresAt }
    
patients/
  {ownerId}/
    {patientId}/
      credentials: { username, password, createdAt }
      
appointments/
  {ownerId}/
    {date}/
      {appointmentId}/
        source: "web" | "dashboard"
        patientData: { full patient details }
        serviceType: "opd" | "lab" | "both"
        status: "pending" | "confirmed" | "cancelled"
        
samples/
  {ownerId}/
    {sampleId}/
      patientId, reportId, status, etc.
```

## Testing Checklist

- [ ] Doctor can login successfully
- [ ] Premium features work for all org users
- [ ] Lab users cannot access quick reports
- [ ] Lab dashboard shows patients and samples
- [ ] Web appointments appear in dashboard
- [ ] Receptionist can modify appointment time/date
- [ ] Patient dashboard shows RX (view-only)
- [ ] Patient dashboard shows reports (downloadable)
- [ ] Patient dashboard shows visit history
- [ ] Walk-in patient gets auto-created account
- [ ] Credentials printed on RX footer
- [ ] Credentials printed on report footer
- [ ] Web appointments have "WEB" tag
- [ ] Patient creation uses appointment booking time

## Notes
- All changes must maintain backward compatibility
- Existing data should not be affected
- Add migration scripts if database structure changes
- Test thoroughly before deploying to production
