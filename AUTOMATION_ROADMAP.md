# MedOS Automation Implementation Roadmap
## Sequential Implementation: Features 1-10

---

## ✅ FEATURE 1: Auto Patient ID Generation
**Status:** READY TO IMPLEMENT
**Priority:** ⭐⭐⭐ CRITICAL
**Estimated Time:** 2-3 hours

### Current System:
- Manual patient ID entry
- Risk of duplicates
- No standard format

### New System:
```
Format: {CLINIC_CODE}-{YYYYMM}-{SEQUENCE}
Example: SPOT-202512-0001
```

### Implementation Steps:
1. Create `generatePatientId()` function
2. Get clinic code from branding (first 4 letters)
3. Get current month counter from Firebase
4. Auto-increment sequence
5. Update patient registration form
6. Remove manual ID field

### Database Structure:
```
counters/
  {ownerId}/
    patientIds/
      202512: 1
      202601: 1
```

### Files to Modify:
- `src/app/dashboard/patients/page.tsx` - Registration form
- `src/lib/idGenerator.ts` - NEW FILE (ID generation logic)

### Testing Checklist:
- [ ] First patient of month gets -0001
- [ ] Sequential increment works
- [ ] No duplicates possible
- [ ] Clinic code updates from branding
- [ ] Counter resets each month

---

## ✅ FEATURE 2: Auto RX ID Generation
**Status:** PENDING (After Feature 1)
**Priority:** ⭐⭐⭐ CRITICAL
**Estimated Time:** 1-2 hours

### Current System:
- Timestamp-based RX IDs
- Hard to reference
- No daily sequence

### New System:
```
Format: RX-{YYYYMMDD}-{SEQUENCE}
Example: RX-20251223-001
```

### Implementation Steps:
1. Use same `idGenerator.ts` library
2. Create `generateRxId()` function
3. Daily counter (resets at midnight)
4. Update OPD visit creation
5. Update offline RX creation

### Database Structure:
```
counters/
  {ownerId}/
    rxIds/
      20251223: 1
      20251224: 1
```

### Files to Modify:
- `src/app/dashboard/opd/page.tsx` - OPD creation
- `src/lib/idGenerator.ts` - Add RX function

### Testing Checklist:
- [ ] First RX of day gets -001
- [ ] Sequential increment works
- [ ] Resets at midnight
- [ ] Works for both online/offline RX
- [ ] No duplicates

---

## ✅ FEATURE 3: Auto Report ID Generation
**Status:** PENDING (After Feature 2)
**Priority:** ⭐⭐⭐ CRITICAL
**Estimated Time:** 1-2 hours

### Current System:
- LAB-timestamp format
- Not sequential
- Hard to track

### New System:
```
Format: LAB-{YYYYMMDD}-{SEQUENCE}
Example: LAB-20251223-001
```

### Implementation Steps:
1. Use same `idGenerator.ts` library
2. Create `generateReportId()` function
3. Daily counter
4. Update report creation
5. Update sample-to-report flow

### Database Structure:
```
counters/
  {ownerId}/
    reportIds/
      20251223: 1
```

### Files to Modify:
- `src/app/dashboard/reports/create/page.tsx`
- `src/lib/idGenerator.ts`

### Testing Checklist:
- [ ] Sequential daily IDs
- [ ] Barcode-friendly format
- [ ] Works with sample flow
- [ ] No duplicates

---

## ✅ FEATURE 4: Auto Sample ID Generation
**Status:** PENDING (After Feature 3)
**Priority:** ⭐⭐⭐ CRITICAL
**Estimated Time:** 1-2 hours

### Current System:
- SMP-timestamp
- Not sequential

### New System:
```
Format: SMP-{YYYYMMDD}-{SEQUENCE}
Example: SMP-20251223-001
```

### Implementation Steps:
1. Use `idGenerator.ts`
2. Create `generateSampleId()` function
3. Update sample collection
4. Barcode generation ready

### Database Structure:
```
counters/
  {ownerId}/
    sampleIds/
      20251223: 1
```

### Files to Modify:
- `src/app/dashboard/samples/page.tsx`
- `src/lib/idGenerator.ts`

### Testing Checklist:
- [ ] Sequential IDs
- [ ] Barcode compatible
- [ ] Links to report correctly

---

## ✅ FEATURE 5: Auto Token System
**Status:** PENDING (After Feature 4)
**Priority:** ⭐⭐⭐ CRITICAL
**Estimated Time:** 3-4 hours

### Current System:
- Manual token entry
- No auto-reset
- No queue display

### New System:
```
Features:
- Auto-increment per patient
- Reset at midnight
- Display current token
- Show queue position
```

### Implementation Steps:
1. Create token counter system
2. Auto-increment on patient registration
3. Midnight reset using Cloud Function
4. Add token display to dashboard
5. Queue management UI

### Database Structure:
```
tokens/
  {ownerId}/
    {date}/
      current: 5
      total: 10
      queue: [...]
```

### Files to Modify:
- `src/app/dashboard/patients/page.tsx`
- `src/app/dashboard/opd-queue/page.tsx`
- `src/lib/tokenManager.ts` - NEW FILE

### Testing Checklist:
- [ ] Auto-increment works
- [ ] Resets at midnight
- [ ] Queue display accurate
- [ ] Token shows on visit

---

## ✅ FEATURE 6: Auto Age Calculation
**Status:** PENDING (After Feature 5)
**Priority:** ⭐⭐ HIGH
**Estimated Time:** 1-2 hours

### Current System:
- Manual age entry
- No auto-update
- Becomes outdated

### New System:
```
Input: Date of Birth
Output: Age (Years/Months/Days)
Auto-calculate on every visit
```

### Implementation Steps:
1. Add DOB field to patient registration
2. Create `calculateAge()` function
3. Auto-calculate on form load
4. Show age in Y/M/D format
5. Update on every visit

### Database Structure:
```
patients/
  {ownerId}/
    {patientId}/
      dob: "2000-01-15"
      age: 24 (calculated)
```

### Files to Modify:
- `src/app/dashboard/patients/page.tsx`
- `src/lib/ageCalculator.ts` - NEW FILE

### Testing Checklist:
- [ ] Accurate calculation
- [ ] Shows Y/M/D for infants
- [ ] Auto-updates on visit
- [ ] Works with existing patients

---

## ✅ FEATURE 7: Auto Follow-up Detection
**Status:** PENDING (After Feature 6)
**Priority:** ⭐⭐ HIGH
**Estimated Time:** 2-3 hours

### Current System:
- Manual follow-up checkbox
- No smart detection
- Miss previous data

### New System:
```
Auto-detect if:
- Same patient within 7 days
- Same complaint/diagnosis
- Show previous visit data
- Auto-mark as follow-up
```

### Implementation Steps:
1. Check patient's last visit date
2. If within 7 days, auto-mark follow-up
3. Load previous complaints/diagnosis
4. Show previous prescription
5. Allow override if needed

### Database Query:
```javascript
// Get patient's last visit
const lastVisit = await getLastVisit(patientId);
const daysSince = calculateDays(lastVisit.date, today);
if (daysSince <= 7) {
  setIsFollowUp(true);
  loadPreviousData(lastVisit);
}
```

### Files to Modify:
- `src/app/dashboard/opd/page.tsx`
- `src/lib/followUpDetector.ts` - NEW FILE

### Testing Checklist:
- [ ] Detects 7-day window
- [ ] Loads previous data
- [ ] Manual override works
- [ ] Shows follow-up badge

---

## ✅ FEATURE 8: Auto Billing & Invoice
**Status:** PENDING (After Feature 7)
**Priority:** ⭐⭐⭐ CRITICAL
**Estimated Time:** 4-5 hours

### Current System:
- Manual calculation
- No GST
- No invoice generation

### New System:
```
Features:
- Auto-calculate totals
- GST calculation (18%)
- Invoice generation
- Payment tracking
- Receipt printing
```

### Implementation Steps:
1. Create billing calculator
2. Add GST configuration
3. Generate invoice PDF
4. Track payments
5. Due amount management
6. Receipt generation

### Database Structure:
```
invoices/
  {ownerId}/
    {invoiceId}/
      items: []
      subtotal: 1000
      gst: 180
      total: 1180
      paid: 500
      due: 680
      status: "partial"
```

### Files to Modify:
- `src/app/dashboard/billing/page.tsx` - NEW PAGE
- `src/lib/billingCalculator.ts` - NEW FILE
- `src/app/print/invoice/[id]/page.tsx` - NEW FILE

### Testing Checklist:
- [ ] Accurate calculations
- [ ] GST correct
- [ ] Invoice prints properly
- [ ] Payment tracking works
- [ ] Due amount accurate

---

## ✅ FEATURE 9: Auto Critical Alerts
**Status:** PENDING (After Feature 8)
**Priority:** ⭐⭐⭐ CRITICAL
**Estimated Time:** 3-4 hours

### Current System:
- No automatic alerts
- Doctor may miss critical values
- No patient notification

### New System:
```
When critical value detected:
- Instant notification to doctor
- Patient portal notification
- Flag in dashboard
- Require acknowledgment
```

### Implementation Steps:
1. Define critical thresholds
2. Check values on report save
3. Create notification system
4. Patient portal notifications
5. Doctor dashboard alerts
6. Acknowledgment tracking

### Database Structure:
```
notifications/
  {userId}/
    {notificationId}/
      type: "critical_alert"
      reportId: "LAB-20251223-001"
      parameter: "Hemoglobin"
      value: "5.2"
      threshold: "< 7.0"
      read: false
      acknowledged: false
      createdAt: timestamp
```

### Files to Modify:
- `src/app/dashboard/reports/create/page.tsx`
- `src/app/patient/dashboard/page.tsx`
- `src/lib/notificationManager.ts` - NEW FILE
- `src/components/NotificationBell.tsx` - NEW FILE

### Testing Checklist:
- [ ] Detects critical values
- [ ] Doctor gets notification
- [ ] Patient portal shows alert
- [ ] Acknowledgment works
- [ ] History maintained

---

## ✅ FEATURE 10: Auto Backup System
**Status:** PENDING (After Feature 9)
**Priority:** ⭐⭐⭐ CRITICAL
**Estimated Time:** 2-3 hours

### Current System:
- Manual backup
- Inconsistent
- Risk of data loss

### New System:
```
Schedule:
- Daily at 2 AM
- Weekly full backup
- Monthly archive
- Auto-upload to cloud
```

### Implementation Steps:
1. Create backup function
2. Schedule with Cloud Functions
3. Export all data to JSON
4. Upload to Firebase Storage
5. Maintain backup history
6. Auto-delete old backups (>90 days)

### Database Structure:
```
backups/
  {ownerId}/
    daily/
      2025-12-23.json
    weekly/
      2025-W51.json
    monthly/
      2025-12.json
```

### Files to Modify:
- `src/app/admin/backup/page.tsx` - Update UI
- `functions/scheduledBackup.ts` - NEW FILE (Cloud Function)
- `src/lib/backupManager.ts` - NEW FILE

### Testing Checklist:
- [ ] Daily backup runs at 2 AM
- [ ] All data exported
- [ ] Upload successful
- [ ] Old backups deleted
- [ ] Restore works

---

## 📊 Implementation Timeline

### Week 1: ID Generation (Features 1-4)
- Day 1-2: Auto Patient ID
- Day 3: Auto RX ID
- Day 4: Auto Report ID
- Day 5: Auto Sample ID
- Day 6-7: Testing & Bug fixes

### Week 2: Smart Features (Features 5-7)
- Day 1-2: Auto Token System
- Day 3: Auto Age Calculation
- Day 4-5: Auto Follow-up Detection
- Day 6-7: Testing & Integration

### Week 3: Critical Features (Features 8-10)
- Day 1-3: Auto Billing & Invoice
- Day 4-5: Auto Critical Alerts
- Day 6-7: Auto Backup System

### Week 4: Testing & Deployment
- Day 1-3: End-to-end testing
- Day 4-5: User acceptance testing
- Day 6-7: Production deployment

---

## 🎯 Success Metrics

After implementing all 10 features:

### Time Savings:
- ✅ 80% reduction in ID generation time
- ✅ 60% reduction in data entry
- ✅ 50% faster patient registration
- ✅ 70% faster billing

### Error Reduction:
- ✅ 100% elimination of duplicate IDs
- ✅ 95% reduction in calculation errors
- ✅ 90% reduction in missed critical alerts
- ✅ 100% data backup guarantee

### Patient Experience:
- ✅ Faster service
- ✅ Professional IDs
- ✅ Instant critical alerts
- ✅ Portal notifications

---

## 🚀 Ready to Start?

**Feature 1: Auto Patient ID Generation**
- Estimated Time: 2-3 hours
- Files to create: `src/lib/idGenerator.ts`
- Files to modify: `src/app/dashboard/patients/page.tsx`

**Shall we begin with Feature 1?** 🎯
