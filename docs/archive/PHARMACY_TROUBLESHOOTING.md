# Pharmacy Dashboard - Troubleshooting Guide

## Issue: Changes Not Showing

If the pharmacy dashboard and prescription tab don't show the new features, try these steps:

### 1. Hard Refresh Browser
- **Windows/Linux**: Press `Ctrl + Shift + R` or `Ctrl + F5`
- **Mac**: Press `Cmd + Shift + R`
- This clears the cache and reloads the page

### 2. Clear Browser Cache
- Open DevTools (F12)
- Right-click the refresh button
- Select "Empty Cache and Hard Reload"

### 3. Restart Dev Server
```bash
# Stop the current server (Ctrl+C)
# Then restart:
npm run dev
```

### 4. Check Browser Console
- Open DevTools (F12)
- Go to Console tab
- Look for any errors (red text)
- Share any errors you see

## What Should Be Visible

### Pharmacy Dashboard Tab
✅ **At the top**:
- 2 gradient cards side by side
- Left card (Purple): "Today's Finalized" with count
- Right card (Green): "Delivered Today" with count

✅ **Below the cards**:
- Table with header "Today's Prescriptions"
- Columns: RX ID, Time, Patient, Age/Gender, Doctor, Medicines, Status, Actions
- Each row is clickable
- "Deliver" button for pending prescriptions

✅ **When you click a row**:
- Modal opens with prescription details
- Shows patient info, visit info, medicines list
- Color-coded badges for dosage, frequency, duration, timing
- "Mark as Delivered" button at bottom

### Prescription Tab (OPD)
✅ **At the top**:
- NO header text (removed)
- Search bar on the left
- Doctor filter dropdown next to search
- NO "Add OPD/RX" button for pharmacy

✅ **Table**:
- Shows all prescriptions (not just today's)
- Same columns as dashboard
- Click row to view details
- Only Print PDF button visible (no edit/finalize)

## Verification Steps

1. **Login as pharmacy user**
2. **Go to Dashboard tab**:
   - Do you see 2 gradient cards at top?
   - Do you see the new table columns (RX ID, Time, Patient, Age/Gender, etc.)?
   - Can you click on a prescription row?
   - Does a modal open when you click?

3. **Go to Prescription tab** (OPD in menu):
   - Is the header "OPD / Rx Management" removed?
   - Do you see the doctor filter dropdown?
   - Is the "Add OPD/RX" button hidden?

## If Still Not Working

### Check the Code Files

1. **Check `src/app/dashboard/page.tsx`**:
   - Line 358-600: Should have the new pharmacy dashboard code
   - Line 394-413: Should have inline stats cards
   - Line 434-442: Should have new table headers
   - Line 503-600: Should have RX modal

2. **Check `src/app/dashboard/opd/page.tsx`**:
   - Line 69: Should have `selectedDoctorFilter` state
   - Line 410-445: Should have NO header, doctor filter dropdown
   - Line 164-181: Should have updated filtering logic

### Manual Verification

Open the files and search for:
- `selectedRx` - Should exist in pharmacy section
- `showRxModal` - Should exist in pharmacy section
- `handleMarkDelivered` - Should exist in pharmacy section
- `selectedDoctorFilter` - Should exist in OPD page

## Common Issues

### Issue 1: "todayOpdList is empty"
**Solution**: Make sure you have finalized prescriptions for today. Create a test prescription and finalize it.

### Issue 2: "Modal doesn't open"
**Solution**: Check browser console for errors. The state might not be updating.

### Issue 3: "Deliver button doesn't work"
**Solution**: Check if `isDelivered` field is being saved to database. Check Firebase console.

### Issue 4: "Doctor filter doesn't work"
**Solution**: Make sure doctors are loaded. Check if `doctors` array has data.

## Test Data Setup

To test the pharmacy dashboard:

1. **Create a patient** (if not exists)
2. **Create a prescription** as doctor or reception
3. **Finalize the prescription**
4. **Login as pharmacy**
5. **Check dashboard** - Should see the prescription in today's list
6. **Click the prescription** - Modal should open
7. **Click "Deliver"** - Status should change to "Delivered"

## Expected Behavior

### Dashboard Tab
```
┌─────────────────────────────────────────────────────┐
│ [Purple Card: Today's Finalized: 5]                 │
│ [Green Card: Delivered Today: 3]                    │
├─────────────────────────────────────────────────────┤
│ Today's Prescriptions                               │
├─────────────────────────────────────────────────────┤
│ RX ID | Time | Patient | Age | Doctor | Meds | ... │
│ RX001 | 10:30| John    | 35Y | Smith  | 3    | ... │
│ (Click row to view details)                         │
└─────────────────────────────────────────────────────┘
```

### Prescription Tab
```
┌─────────────────────────────────────────────────────┐
│ [Search...] [All Doctors ▼]                         │
├─────────────────────────────────────────────────────┤
│ RX ID | Time | Patient | Age | Doctor | Meds | ... │
│ RX001 | 10:30| John    | 35Y | Smith  | 3    | ... │
│ RX002 | 11:15| Jane    | 28Y | Jones  | 2    | ... │
└─────────────────────────────────────────────────────┘
```

## Contact Points

If none of the above works:
1. Share screenshot of what you see
2. Share browser console errors
3. Confirm you're logged in as pharmacy role
4. Confirm there are finalized prescriptions in the database
