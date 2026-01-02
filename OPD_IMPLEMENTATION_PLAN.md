# OPD & Doctors Module Implementation Plan

## Overview
Complete OPD (Outpatient Department) system with colorful Rx prescription PDF printing and hospital doctors management.

## Features to Implement

### 1. Doctors Management Module
- **Global Variables**: `doctorsData = []`, `filteredDoctors = []`
- **Firebase Path**: `doctors/${userId}/`
- **Doctor Fields**:
  - `name` - Doctor's full name
  - `qualification` - MBBS, MD, MS, etc.
  - `specialization` - General Medicine, Orthopedics, etc.
  - `registrationNumber` - Medical council registration
  - `mobile` - Contact number
  - `email` - Email address
  - `signature` - Base64 signature image (optional)
  - `isDefault` - Boolean for default doctor selection

### 2. OPD Visits/Prescriptions Module
- **Global Variables**: `opdData = []`, `filteredOPD = []`
- **Firebase Path**: `opd/${userId}/`
- **OPD Visit Fields**:
  - `id` - Unique prescription ID (LAB-RX-timestamp)
  - `patientId` - Link to patient
  - `patientName`, `patientAge`, `patientGender`, `patientMobile`
  - `doctorId` - Selected doctor
  - `doctorName`, `doctorQualification`, `doctorRegistration`
  - `visitDate` - Date of visit
  - `visitType` - New/Follow-up
  - `vitals`:
    - `bp` - Blood Pressure (systolic/diastolic)
    - `pulse` - Heart rate
    - `temperature` - Body temperature
    - `weight` - Patient weight
    - `height` - Patient height
    - `spo2` - Oxygen saturation
  - `chiefComplaints` - Main symptoms
  - `clinicalHistory` - Past medical history
  - `examination` - Clinical examination findings
  - `diagnosis` - Primary and secondary diagnosis
  - `medicines[]` - Array of prescribed medicines:
    - `name` - Medicine name
    - `dosage` - Dose (e.g., 500mg)
    - `frequency` - OD, BD, TDS, QID, SOS, etc.
    - `duration` - Number of days
    - `timing` - Before food, After food, etc.
    - `instructions` - Special instructions
  - `investigations` - Recommended tests
  - `advice` - General advice/instructions
  - `followUp` - Follow-up date
  - `createdAt` - Timestamp
  - `labBranding` - Lab/Hospital branding

### 3. HTML Structure Changes
- Add "OPD" and "Doctors" tabs in navigation
- Create OPD visits table content
- Create Doctors management table content

### 4. Rx Prescription PDF
- Colorful header with hospital branding
- Patient details section
- Vitals display
- Rx symbol (℞) with medicine list
- Diagnosis and advice sections
- Doctor signature and details
- Footer with hospital info

### 5. Enhanced Analytics
- OPD visits count (today/weekly/monthly)
- Doctor-wise patient distribution
- Common diagnoses chart
- Medicine frequency analysis
- OPD revenue (if applicable)

## Implementation Order
1. Add global variables for doctors and OPD
2. Add tabs in HTML navigation
3. Add tab content sections in HTML
4. Implement doctors CRUD functions
5. Implement OPD CRUD functions
6. Implement Rx PDF generation
7. Update analytics
8. Update dashboard stats
