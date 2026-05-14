# 🔍 Dashboard Stats Not Loading - Debug Guide

## Issue
Owner dashboard load ho gaya hai with all tabs, but:
- ❌ Stats cards showing 0
- ❌ Queue not loading

## Possible Causes

### 1. Data Path Issue
Stats Firebase se fetch nahi ho rahe because path wrong hai.

### 2. dataOwnerId Issue
`dataOwnerId` undefined ya wrong value hai.

### 3. No Data in Firebase
Database me actual data nahi hai.

## Debug Steps

### Step 1: Check Browser Console
```
1. F12 press karo
2. Console tab kholo
3. Koi error dikh raha hai?
```

### Step 2: Check Network Tab
```
1. F12 → Network tab
2. Filter: "firebase"
3. Koi requests fail ho rahi hain?
```

### Step 3: Check Firebase Paths
Dashboard ye paths use karta hai:
```
patients/${dataOwnerId}
reports/${dataOwnerId}
opd/${dataOwnerId}
samples/${dataOwnerId}
opd_queue/${dataOwnerId}/${dateKey}
```

### Step 4: Verify Data Exists
Firebase Console me jao aur check karo:
```
1. Database → Realtime Database
2. Check: patients/{yourUID}
3. Check: reports/{yourUID}
4. Check: opd/{yourUID}
5. Check: samples/{yourUID}
6. Check: opd_queue/{yourUID}/{today's date}
```

## Quick Fixes

### Fix 1: Check if Data Exists
Agar Firebase me data nahi hai:
1. Patients page pe jao
2. Ek patient add karo
3. Dashboard refresh karo

### Fix 2: Check User UID
Console me run karo:
```javascript
// In browser console
console.log('User UID:', localStorage.getItem('userId'));
console.log('Auth Method:', localStorage.getItem('authMethod'));
```

### Fix 3: Hard Refresh
```
Ctrl + Shift + R
```

### Fix 4: Clear Cache
```
1. F12
2. Application tab
3. Clear storage
4. Reload
```

## Expected Console Logs

Dashboard should log:
```
dataOwnerId: "your-firebase-uid"
Fetching stats from: patients/your-firebase-uid
Fetching stats from: reports/your-firebase-uid
etc.
```

## Common Issues

### Issue 1: dataOwnerId is undefined
**Cause**: userProfile not loaded
**Fix**: Wait for page to fully load

### Issue 2: dataOwnerId is wrong
**Cause**: Using staff ownerId instead of owner UID
**Fix**: Should use `user.uid` for owner

### Issue 3: No data in Firebase
**Cause**: Fresh account, no data added yet
**Fix**: Add some test data

## Test Data Creation

### Add Test Patient:
```
1. Go to Patients page
2. Click "Add Patient"
3. Fill details
4. Save
5. Go back to Dashboard
```

### Add Test Sample:
```
1. Go to Samples page
2. Add a sample
3. Go back to Dashboard
```

## What to Share

If still not working, share:
1. Browser console errors (screenshot)
2. Firebase UID (from console.log)
3. Firebase Database structure (screenshot)
4. Network tab errors

This will help identify the exact issue!
