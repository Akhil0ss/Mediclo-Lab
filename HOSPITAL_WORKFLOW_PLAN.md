# 🏥 HOSPITAL OPD WORKFLOW - IMPLEMENTATION PLAN
**Professional Hospital Flow with Queue Management**

---

## 📋 NEW WORKFLOW

### Complete Patient Journey

```
PATIENT
  └─> Books Appointment (Web Portal)
        └─> Goes to RECEPTION QUEUE
              └─> RECEPTION handles
                    ├─> Registers patient (if new)
                    ├─> Creates OPD Token
                    ├─> Fills vitals (BP, Pulse, Weight, Temp)
                    ├─> Records complaints
                    └─> Assigns to DOCTOR
                          └─> Moves to DOCTOR QUEUE
                                └─> DOCTOR sees assigned cases
                                      ├─> Adds diagnosis
                                      ├─> Prescribes medicines
                                      ├─> Adds advice
                                      └─> FINALIZES (Locks)
                                            └─> Visible to PHARMACY & RECEPTION
                                                  ├─> PHARMACY: Dispense medicines
                                                  └─> RECEPTION: Print RX
```

### Follow-up Flow
```
PATIENT returns for follow-up
  └─> RECEPTION creates new token
        └─> Links to previous visit
              └─> Pre-fills previous diagnosis
                    └─> Assigns to DOCTOR again
```

---

## 🗂️ DATABASE STRUCTURE CHANGES

### New Nodes

```json
{
  "opd_queue": {
    "labId": {
      "YYYYMMDD": {
        "tokenId": {
          "tokenNumber": "1",
          "patientId": "P001",
          "patientName": "John Doe",
          "appointmentId": "appt123", // if from web booking
          "status": "waiting|in-consultation|completed",
          "priority": "normal|urgent",
          "vitals": {
            "bp": "120/80",
            "pulse": "72",
            "weight": "70",
            "temperature": "98.6"
          },
          "complaints": "Fever and headache",
          "assignedDoctorId": "D001",
          "assignedDoctorName": "Dr. Smith",
          "createdAt": "ISO",
          "updatedAt": "ISO",
          "createdBy": "receptionist",
          "opdRecordId": null // Links to opd/{uid}/{opdId} after doctor saves
        }
      }
    }
  },
  
  "opd": {
    "labId": {
      "opdId": {
        // Existing fields...
        "queueTokenId": "tokenId",
        "isFinalized": true, // Locked after doctor finalizes
        "finalizedAt": "ISO",
        "finalizedBy": "doctorId",
        "canEdit": false // True only if not finalized
      }
    }
  }
}
```

---

## 🔄 WORKFLOW STATES

### Queue Token States
1. **`waiting`** - Patient in reception queue, vitals being filled
2. **`assigned`** - Assigned to doctor, waiting for consultation
3. **`in-consultation`** - Doctor is currently editing
4. **`completed`** - Doctor finalized, moved to completed list

### OPD Record States
1. **`draft`** - Reception created, not finalized
2. **`finalized`** - Doctor completed, locked
3. **`printed`** - Reception printed the RX

---

## 📱 RECEPTION DASHBOARD CHANGES

### New Tabs/Sections

1. **Appointments Queue**
   - Shows web bookings
   - "Create Token" button for each appointment
   - Mark as arrived

2. **OPD Queue (Today)**
   - Token number
   - Patient name
   - Status badge
   - Vitals form (inline edit)
   - Assign to doctor dropdown
   - "Assign" button

3. **In Consultation**
   - Currently with doctor
   - Timer showing duration
   - Real-time status

4. **Completed Today**
   - Finalized cases
   - Print RX button
   - View details

5. **Follow-up Management**
   - "Create Follow-up Token" for existing patients
   - Links to previous visit
   - Pre-fills data

---

## 👨‍⚕️ DOCTOR DASHBOARD CHANGES

### New Behavior

1. **Assigned Cases Only**
   - No longer sees all OPD records
   - Only sees cases assigned by reception
   - Queue-based view

2. **Case Status**
   - "New" - Just assigned
   - "In Progress" - Doctor started editing
   - "Completed" - Doctor finalized (disappears from queue)

3. **Finalize Action**
   - "Save Draft" button (can edit later)
   - "Finalize & Lock" button (permanent, goes to pharmacy)
   - Confirmation dialog

4. **Read-Only After Finalize**
   - Can view but not edit
   - Shows "Finalized" badge
   - Print option available

---

## 🏥 IMPLEMENTATION FILES

### New Components

```
src/app/dashboard/
├── reception/
│   ├── opd-queue/
│   │   ├── page.tsx (Main queue management)
│   │   └── components/
│   │       ├── AppointmentsQueue.tsx
│   │       ├── TokenCreator.tsx
│   │       ├── VitalsForm.tsx
│   │       ├── DoctorAssignment.tsx
│   │       └── CompletedList.tsx
│   └── appointments/
│       └── page.tsx (Web appointments handler)

src/app/dashboard/doctor/
└── queue/
    ├── page.tsx (Assigned cases queue)
    └── components/
        ├── AssignedCaseCard.tsx
        └── FinalizeModal.tsx
```

### Modified Files
```
src/app/dashboard/doctor/page.tsx
  - Switch to queue-based view
  - Show only assigned cases
  - Add finalize logic

src/app/patient/appointments/page.tsx
  - Add "Checked In" status
  - Show token number after check-in

database.rules.json
  - Add opd_queue rules
```

---

## 🔧 REGISTRATION TO DOCTOR ASSIGNMENT FLOW

### Step 1: Patient Books Appointment (Web)
```typescript
// Appointment created with status: "scheduled"
appointments/{labId}/{date}/{apptId} = {
  status: "scheduled",
  checkedIn: false,
  tokenNumber: null
}
```

### Step 2: Reception Sees Appointment
```typescript
// In reception dashboard
<AppointmentsQueue>
  {appointments
    .filter(a => a.status === 'scheduled' && !a.checkedIn)
    .map(appt => (
      <AppointmentCard>
        <button onClick={() => createToken(appt)}>
          Create Token
        </button>
      </AppointmentCard>
    ))
  }
</AppointmentsQueue>
```

### Step 3: Create Token & Fill Vitals
```typescript
const createToken = async (appointment) => {
  const tokenNumber = await getNextTokenNumber(date);
  
  const tokenData = {
    tokenNumber,
    patientId: appointment.patientId,
    patientName: appointment.patientName,
    patientMobile: appointment.patientMobile,
    appointmentId: appointment.id,
    status: "waiting",
    vitals: { bp: "", pulse: "", weight: "", temperature: "" },
    complaints: "",
    assignedDoctorId: null,
    createdAt: new Date().toISOString()
  };
  
  await set(ref(database, `opd_queue/${labId}/${dateKey}/${tokenId}`), tokenData);
  
  // Update appointment
  await update(ref(database, `appointments/.../${apptId}`), {
    checkedIn: true,
    tokenNumber: tokenNumber
  });
};
```

### Step 4: Reception Fills Vitals & Assigns
```typescript
<TokenCard token={token}>
  <VitalsForm
    vitals={token.vitals}
    complaints={token.complaints}
    onSave={(data) => updateToken(token.id, data)}
  />
  
  <DoctorSelect
    value={token.assignedDoctorId}
    onChange={(doctorId) => assignToDoctor(token, doctorId)}
  />
  
  <button onClick={() => assignToDoctor(token)}>
    Assign to Doctor
  </button>
</TokenCard>
```

### Step 5: Doctor Gets Assignment
```typescript
// Doctor dashboard fetches from opd_queue
const myQueue = opdQueue.filter(token => 
  token.assignedDoctorId === currentDoctorId &&
  token.status !== 'completed'
);

// Doctor edits case
<CaseEditor token={token}>
  <VitalsDisplay vitals={token.vitals} /> // Read-only (filled by reception)
  <ComplaintsDisplay /> // Read-only
  
  <DiagnosisInput /> // Doctor fills
  <MedicinesInput /> // Doctor fills
  <AdviceInput /> // Doctor fills
  
  <button onClick={saveDraft}>Save Draft</button>
  <button onClick={finalizeCase}>Finalize & Lock</button>
</CaseEditor>
```

### Step 6: Finalize Creates OPD Record
```typescript
const finalizeCase = async (token, opdData) => {
  // Create permanent OPD record
  const opdId = await push(ref(database, `opd/${userId}`));
  
  await set(opdId, {
    ...opgData,
    queueTokenId: token.id,
    isFinalized: true,
    finalizedAt: new Date().toISOString(),
    canEdit: false
  });
  
  // Update token status
  await update(ref(database, `opd_queue/.../${token.id}`), {
    status: "completed",
    opdRecordId: opdId.key
  });
};
```

### Step 7: Pharmacy/Reception Access
```typescript
// Pharmacy sees finalized cases
const finalizedCases = opdRecords.filter(opd => opd.isFinalized);

// Reception can print
<FinalizedList>
  {finalizedCases.map(opd => (
    <CaseCard>
      <button onClick={() => printRx(opd.id)}>
        Print RX
      </button>
    </CaseCard>
  ))}
</FinalizedList>
```

---

## 🔄 FOLLOW-UP FLOW

### Reception Creates Follow-up
```typescript
const createFollowUp = async (previousOpdId) => {
  // Fetch previous OPD data
  const prevOpd = await get(ref(database, `opd/${userId}/${previousOpdId}`));
  
  // Create new token with pre-filled data
  const tokenData = {
    tokenNumber: await getNextTokenNumber(),
    patientId: prevOpd.patientId,
    patientName: prevOpd.patientName,
    isFollowUp: true,
    previousVisitId: previousOpdId,
    previousDiagnosis: prevOpd.diagnosis,
    previousMedicines: prevOpd.medicines,
    vitals: {}, // New vitals
    complaints: "", // New complaints
    status: "waiting"
  };
  
  await set(ref(database, `opd_queue/...`), tokenData);
};
```

---

## ✅ BENEFITS OF THIS FLOW

1. **Professional Queue Management** - Like real hospitals
2. **Clear Role Separation** - Reception handles logistics, doctors focus on diagnosis
3. **Better Patient Experience** - Token system, predictable wait times
4. **Data Integrity** - Vitals filled once, diagnosis by qualified doctor
5. **Audit Trail** - Track who did what and when
6. **Pharmacy Integration** - Only dispense finalized prescriptions
7. **Follow-up Tracking** - Link visits, see progression

---

## 🚀 IMPLEMENTATION ORDER

### Phase 1: Core Queue System
1. Create `opd_queue` database structure
2. Build Reception OPD Queue page
3. Add token creation logic
4. Add vitals form component

### Phase 2: Assignment System
5. Build doctor assignment dropdown
6. Create assigned queue for doctors
7. Modify doctor dashboard to show queue
8. Add "in-consultation" status

### Phase 3: Finalization
9. Add "Finalize" modal with confirmation
10. Lock OPD record after finalize
11. Move to completed queue
12. Make read-only for doctor

### Phase 4: Reception Print & Pharmacy
13. Add completed cases list for reception
14. Add print button
15. Update pharmacy to show only finalized
16. Add follow-up creation

---

*This creates a professional hospital OPD system!*
