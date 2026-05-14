# 🎯 Unified Dashboard with Role-Based Permissions

## Current Problem
- Multiple separate dashboards (doctor, lab, pharmacy)
- Data sync issues
- Premium status not syncing
- Confusing navigation

## New Solution
**One Main Dashboard for All** with role-based UI hiding

### Benefits:
✅ Same dashboard for everyone
✅ Data automatically synced (using owner's data)
✅ Premium status from owner
✅ Simpler codebase
✅ Better UX

## Implementation Plan

### Step 1: Redirect All Roles to Main Dashboard
Update login redirects:
- Doctor → `/dashboard` (not `/dashboard/doctor`)
- Lab → `/dashboard` (not `/dashboard/lab`)
- Pharmacy → `/dashboard` (not `/dashboard/pharmacy`)
- Receptionist → `/dashboard`

### Step 2: Role-Based Menu Hiding
In `dashboard/layout.tsx`, hide menu items based on role:

**Owner (Admin)**: See everything
- ✅ Dashboard
- ✅ Patients
- ✅ OPD
- ✅ OPD Queue
- ✅ Samples
- ✅ Reports
- ✅ Doctors
- ✅ Templates
- ✅ Appointments
- ✅ Analytics
- ✅ Settings

**Receptionist**: Patient management + Queue
- ✅ Dashboard (stats only)
- ✅ Patients
- ✅ OPD Queue
- ✅ Appointments
- ❌ OPD (hide)
- ❌ Samples (hide)
- ❌ Reports (hide)
- ❌ Doctors (hide)
- ❌ Templates (hide)
- ❌ Analytics (hide)
- ❌ Settings (hide)

**Lab**: Sample & Report management
- ✅ Dashboard (stats only)
- ✅ Patients (view only)
- ✅ Samples
- ✅ Reports
- ✅ Templates
- ❌ OPD (hide)
- ❌ OPD Queue (hide)
- ❌ Doctors (hide)
- ❌ Appointments (hide)
- ❌ Analytics (hide)
- ❌ Settings (hide)

**Pharmacy**: Prescription viewing
- ✅ Dashboard (stats only)
- ✅ Patients (view only)
- ✅ Pharmacy (prescriptions)
- ❌ Everything else (hide)

**Doctor**: OPD + Patients
- ✅ Dashboard (stats only)
- ✅ Patients (view only)
- ✅ OPD
- ✅ OPD Queue (assigned to them)
- ❌ Samples (hide)
- ❌ Reports (hide)
- ❌ Doctors (hide)
- ❌ Templates (hide)
- ❌ Appointments (hide)
- ❌ Analytics (hide)
- ❌ Settings (hide)

### Step 3: Fix Doctor Dashboard
Update `/dashboard/doctor/page.tsx` to use main dashboard layout with OPD focus.

### Step 4: Premium Status Sync
All staff users get premium status from owner's profile.

## Files to Modify

1. **src/app/login/page.tsx**
   - Change all redirects to `/dashboard`

2. **src/app/dashboard/layout.tsx**
   - Add role-based menu filtering
   - Show/hide based on userProfile.role

3. **src/app/dashboard/doctor/page.tsx**
   - Keep for backward compatibility
   - Or redirect to main dashboard with OPD tab

4. **src/contexts/AuthContext.tsx**
   - Ensure premium status comes from owner

## Code Structure

```typescript
// In layout.tsx
const menuItems = [
  { name: 'Dashboard', path: '/dashboard', icon: 'home', roles: ['all'] },
  { name: 'Patients', path: '/dashboard/patients', icon: 'users', roles: ['all'] },
  { name: 'OPD', path: '/dashboard/opd', icon: 'stethoscope', roles: ['admin', 'doctor'] },
  { name: 'OPD Queue', path: '/dashboard/opd-queue', icon: 'list', roles: ['admin', 'receptionist', 'doctor'] },
  { name: 'Samples', path: '/dashboard/samples', icon: 'vial', roles: ['admin', 'lab'] },
  { name: 'Reports', path: '/dashboard/reports', icon: 'file-medical', roles: ['admin', 'lab'] },
  { name: 'Doctors', path: '/dashboard/doctors', icon: 'user-md', roles: ['admin'] },
  { name: 'Templates', path: '/dashboard/templates', icon: 'flask', roles: ['admin', 'lab'] },
  { name: 'Appointments', path: '/dashboard/appointments', icon: 'calendar', roles: ['admin', 'receptionist'] },
  { name: 'Pharmacy', path: '/dashboard/pharmacy', icon: 'pills', roles: ['admin', 'pharmacy'] },
  { name: 'Analytics', path: '/dashboard/analytics', icon: 'chart-line', roles: ['admin'] },
  { name: 'Settings', path: '/dashboard/settings', icon: 'cog', roles: ['admin'] },
];

// Filter based on role
const visibleMenuItems = menuItems.filter(item => 
  item.roles.includes('all') || 
  item.roles.includes(userProfile?.role || 'admin')
);
```

## Migration Steps

1. Update login redirects
2. Update layout menu filtering
3. Test each role
4. Remove old dashboard pages (doctor, lab, pharmacy)
5. Update documentation

## Expected Result

**All users see same dashboard, but:**
- Owner: Full access
- Staff: Limited menu based on role
- Data: Always from owner
- Premium: Always from owner
- Clean & Simple! ✅
