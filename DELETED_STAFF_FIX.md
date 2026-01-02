# Deleted Staff Filtering - FIXED

## Issue
Deleted doctors were still appearing in:
1. Settings → Team tab
2. Chat staff list (Intercom)

## Root Cause
The code was checking if staff members had `username` and `name` fields, but was NOT checking the `isActive` status flag.

When a doctor is "deleted" in the system, the record is not actually removed from Firebase. Instead, it's marked with `isActive: false`. This is important for data integrity and historical records.

## Solution Applied

### 1. Settings Team Tab (`src/app/dashboard/settings/page.tsx`)

**Before:**
```tsx
if (doc && doc.username && doc.name) {
    users.push({...});
}
```

**After:**
```tsx
if (doc && doc.username && doc.name && doc.isActive !== false) {
    users.push({...});
}
```

**Applied to:**
- ✅ Receptionist (line 109)
- ✅ Lab (line 117)
- ✅ Pharmacy (line 125)
- ✅ Doctors (line 139)

### 2. Chat Staff List (`src/components/Intercom.tsx`)

**Already Fixed Previously:**
```tsx
const addUser = (uid: string, name: string, r: string, isActive: boolean = true) => {
    if (uid !== user.uid && isActive) {
        users.push({...});
    }
};

// Usage:
if (data.receptionist?.username && data.receptionist.isActive !== false) {
    addUser('receptionist', data.receptionist.name || 'Receptionist', 'receptionist');
}
```

**Applied to:**
- ✅ Receptionist (line 149)
- ✅ Lab (line 153)
- ✅ Pharmacy (line 157)
- ✅ Doctors (line 161)

## How It Works

### Soft Delete Pattern
```
Firebase Structure:
users/
  {ownerId}/
    auth/
      doctors/
        {doctorId}/
          name: "Dr. Smith"
          username: "spot@drsmith"
          password: "******"
          isActive: false  ← Marks as deleted
          role: "doctor"
```

### Filtering Logic
```tsx
// Check if isActive is NOT explicitly false
// This allows for:
// - isActive: true → Show (active)
// - isActive: undefined → Show (legacy data)
// - isActive: false → Hide (deleted)

if (doc.isActive !== false) {
    // Show this staff member
}
```

## Testing Checklist

### Settings Team Tab
- [ ] Login as Owner/Receptionist
- [ ] Go to Settings → Team
- [ ] Verify only active staff appear
- [ ] Delete a doctor (set isActive: false)
- [ ] Refresh page
- [ ] Deleted doctor should NOT appear

### Chat Staff List
- [ ] Login as any staff member
- [ ] Open chat bubble
- [ ] Click Staff tab
- [ ] Verify only active staff appear
- [ ] Deleted doctors should NOT appear

### Re-enabling Staff
- [ ] Go to Settings → Team
- [ ] Find disabled staff (if any)
- [ ] Click "Enable" button
- [ ] Staff should appear in chat list immediately

## Files Modified

1. **`src/app/dashboard/settings/page.tsx`**
   - Lines 109, 117, 125, 139
   - Added `&& data.{role}.isActive !== false` checks

2. **`src/components/Intercom.tsx`**
   - Lines 129, 149, 153, 157, 161
   - Already fixed in previous update

## Database Structure

### Active Staff Member
```json
{
  "name": "Dr. Active",
  "username": "spot@active",
  "password": "password123",
  "role": "doctor",
  "isActive": true
}
```

### Deleted Staff Member
```json
{
  "name": "Dr. Deleted",
  "username": "spot@deleted",
  "password": "password123",
  "role": "doctor",
  "isActive": false  ← This hides them
}
```

### Legacy Staff Member (No isActive field)
```json
{
  "name": "Dr. Legacy",
  "username": "spot@legacy",
  "password": "password123",
  "role": "doctor"
  // No isActive field → Treated as active
}
```

## Benefits of Soft Delete

1. **Data Integrity**: Historical records remain intact
2. **Audit Trail**: Can see who was deleted and when
3. **Reversible**: Can re-enable staff by setting `isActive: true`
4. **Reports**: Old reports still show correct doctor names
5. **Sessions**: Old sessions can still be validated

## Important Notes

- **Permanent Staff** (Receptionist, Lab, Pharmacy) can also be disabled
- **Doctors** are the most commonly deleted/disabled
- **Owner** account cannot be disabled (it's the root account)
- **Re-enabling** is instant - just toggle the status in Settings

## Rollback Instructions

If issues occur, the filtering can be disabled by removing the `&& isActive !== false` checks. However, this will show deleted staff again.

Better approach: Ensure all staff have `isActive: true` in Firebase, then the checks become redundant.
