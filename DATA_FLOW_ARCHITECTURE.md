# 🔄 Perfect Data Flow Architecture

## Core Concept: Unified Patient Management

### **Patient Tab = Master Patient Registry**
- Single source of truth for ALL patients (Lab + OPD)
- Patients can have:
  - Lab tests only
  - OPD visits only
  - Both lab tests AND OPD visits
  - Neither (just registered)

---

## 📋 Data Flow Logic

### **1. Patient Registration (Patients Tab)**
```
Patient Created → Stored in Firebase: patients/{userId}/{patientId}
Fields:
  - id
  - name
  - age
  - gender
  - mobile
  - address
  - refDoctor
  - createdAt
  - hasLabTests: false (initially)
  - hasOPDVisits: false (initially)
```

### **2. Sample Collection (Samples Tab)**
```
REQUIREMENT: Patient must exist in Patients Tab

Flow:
1. Select existing patient from dropdown
2. Generate sample ID (SPOT-NNNNNN or CUSTOM-NNNNNN)
3. Create sample record
4. Update patient: hasLabTests = true

Sample Record:
  - id
  - sampleNumber (SPOT-000001)
  - patientId (reference to patient)
  - sampleType
  - date
  - status (Pending/Processing/Completed)
  - createdAt
```

### **3. Quick Report (Dashboard Quick Action)**
```
REQUIREMENT: 
  - Patient must exist in Patients Tab
  - Sample is OPTIONAL (can create sample on-the-fly OR select existing)

Flow:
1. Select existing patient (NO new patient option)
2. Choose: 
   a) Select existing sample (if available)
   b) Create new sample automatically
3. Select tests
4. Enter results
5. Generate report

Report Record:
  - id
  - reportId (SPOT-000001)
  - patientId
  - sampleId (if applicable)
  - tests
  - results
  - createdAt
```

### **4. OPD Visit (OPD Tab / Quick OPD)**
```
REQUIREMENT: Patient must exist in Patients Tab

Flow:
1. Select existing patient (NO new patient option)
2. Enter vitals, diagnosis, medicines
3. Generate prescription
4. Update patient: hasOPDVisits = true

OPD Record:
  - id
  - rxId (SPOT-000001)
  - patientId (reference to patient)
  - vitals
  - diagnosis
  - medicines
  - createdAt
```

---

## 🗑️ Deletion Logic (Cascading Deletes)

### **Delete Patient from Patients Tab**
```
CRITICAL: This is a MASTER DELETE

When patient is deleted:
1. Delete patient record
2. CASCADE DELETE all related data:
   ✅ All samples of this patient
   ✅ All reports of this patient
   ✅ All OPD visits of this patient

Confirmation Dialog:
"⚠️ Delete Patient: {name}?

This will permanently delete:
- Patient record
- {X} lab samples
- {Y} lab reports
- {Z} OPD visits

This action cannot be undone!"
```

### **Delete Sample from Samples Tab**
```
PARTIAL DELETE: Only removes sample, NOT patient

When sample is deleted:
1. Delete sample record
2. Delete associated reports (if any)
3. Check if patient has other samples:
   - If NO other samples: Update patient.hasLabTests = false
   - If other samples exist: Keep patient.hasLabTests = true
4. Patient record remains intact

Confirmation:
"Delete Sample: {sampleNumber}?
This will also delete any reports linked to this sample."
```

### **Delete Report from Reports Tab**
```
PARTIAL DELETE: Only removes report, NOT patient or sample

When report is deleted:
1. Delete report record
2. Sample remains intact
3. Patient remains intact

Confirmation:
"Delete Report: {reportId}?"
```

### **Delete OPD Visit from OPD Tab**
```
PARTIAL DELETE: Only removes OPD visit, NOT patient

When OPD visit is deleted:
1. Delete OPD visit record
2. Check if patient has other OPD visits:
   - If NO other visits: Update patient.hasOPDVisits = false
   - If other visits exist: Keep patient.hasOPDVisits = true
3. Patient record remains intact

Confirmation:
"Delete OPD Visit: {rxId}?"
```

---

## 🔐 Business Rules

### **Patient Creation**
- ✅ Can be created from Patients Tab only
- ❌ Cannot create new patient from Quick Report
- ❌ Cannot create new patient from Quick OPD
- ❌ Cannot create new patient from Samples Tab
- **Reason:** Maintain single source of truth, prevent duplicates

### **Sample Creation**
- ✅ Can be created from Samples Tab (manual)
- ✅ Can be auto-created from Quick Report (if no sample selected)
- ❌ Must have existing patient
- **Reason:** Samples need patient context

### **Report Generation**
- ✅ Can be created from Quick Report modal
- ✅ Can be created from Reports → Create Report page
- ❌ Must have existing patient
- ⚠️ Sample is optional (auto-created if needed)
- **Reason:** Some labs do direct reporting without sample tracking

### **OPD Visit**
- ✅ Can be created from Quick OPD modal
- ✅ Can be created from OPD Tab → New Visit
- ❌ Must have existing patient
- ❌ No lab tests required
- **Reason:** OPD is independent of lab tests

---

## 📊 Patient Status Indicators

### **In Patients Tab, show:**
```typescript
Patient Card/Row displays:
- Name, Age, Gender
- Mobile, Address
- Ref. Doctor
- Status Badges:
  🧪 Lab Patient (if hasLabTests = true)
  💊 OPD Patient (if hasOPDVisits = true)
  
Examples:
- "John Doe" [🧪] - Lab patient only
- "Jane Smith" [💊] - OPD patient only
- "Bob Wilson" [🧪💊] - Both lab and OPD
- "Alice Brown" - Registered but no services yet
```

---

## 🔄 Sequential ID Generation

### **All IDs follow format: PREFIX-NNNNNN**

```typescript
Free Users:
- Report ID: SPOT-000001, SPOT-000002, ...
- Sample ID: SPOT-000001, SPOT-000002, ...
- Rx ID: SPOT-000001, SPOT-000002, ...

Premium Users (with custom branding):
- Lab Name: "Akhil Diagnostics"
- Prefix: AKHI (first 4 letters)
- Report ID: AKHI-000001, AKHI-000002, ...
- Sample ID: AKHI-000001, AKHI-000002, ...
- Rx ID: AKHI-000001, AKHI-000002, ...

Counters stored in Firebase:
counters/{userId}/report: 1, 2, 3, ...
counters/{userId}/sample: 1, 2, 3, ...
counters/{userId}/rx: 1, 2, 3, ...
```

---

## 🎯 Implementation Checklist

### **Phase 1: Update Quick Report Modal**
- [ ] Remove "New Patient" option
- [ ] Only show existing patients dropdown
- [ ] Make sample selection optional
- [ ] Auto-create sample if none selected
- [ ] Use sequential ID generator

### **Phase 2: Update Quick OPD Modal**
- [ ] Remove "New Patient" option
- [ ] Only show existing patients dropdown
- [ ] Use sequential ID generator

### **Phase 3: Update Samples Page**
- [ ] Only show existing patients dropdown
- [ ] Use sequential ID generator
- [ ] Update delete logic (check for related reports)

### **Phase 4: Update Patients Page**
- [ ] Add status badges (Lab/OPD indicators)
- [ ] Implement cascade delete with confirmation
- [ ] Show count of related records in delete dialog

### **Phase 5: Update All ID Generators**
- [ ] Replace all Date.now() based IDs
- [ ] Implement sequential counter system
- [ ] Add premium/free user logic
- [ ] Fetch branding data for prefix

### **Phase 6: Delete Logic**
- [ ] Patient delete → cascade delete all related data
- [ ] Sample delete → delete related reports, update patient flags
- [ ] Report delete → simple delete
- [ ] OPD delete → update patient flags

---

## 🚀 Benefits of This Architecture

1. **No Duplicate Patients** - Single source of truth
2. **Clean Data** - Cascade deletes prevent orphaned records
3. **Flexible** - Supports lab-only, OPD-only, or both
4. **Professional IDs** - Sequential, branded, trackable
5. **Scalable** - Easy to add new features
6. **User-Friendly** - Clear workflow, no confusion

---

## 📝 User Workflow Examples

### **Scenario 1: Lab-Only Patient**
```
1. Add patient "John Doe" in Patients Tab
2. Create sample in Samples Tab
3. Generate report via Quick Report
Result: Patient has [🧪] badge
```

### **Scenario 2: OPD-Only Patient**
```
1. Add patient "Jane Smith" in Patients Tab
2. Create OPD visit via Quick OPD
Result: Patient has [💊] badge
```

### **Scenario 3: Both Lab & OPD**
```
1. Add patient "Bob Wilson" in Patients Tab
2. Create sample + report (Lab)
3. Create OPD visit
Result: Patient has [🧪💊] badges
```

### **Scenario 4: Delete Patient**
```
1. Patient "Alice Brown" has:
   - 3 samples
   - 5 reports
   - 2 OPD visits
2. Delete patient from Patients Tab
3. System shows confirmation with counts
4. User confirms
5. All 10 related records deleted
Result: Complete cleanup, no orphaned data
```

---

This architecture ensures data integrity, prevents confusion, and provides a professional workflow! 🎉
