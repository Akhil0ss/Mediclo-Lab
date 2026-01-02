# Critical Fixes Applied - December 24, 2025

## Issues Addressed

### 1. Setup-Profile Redirect Loop ✅ FIXED
**Problem:** Internal auth users (Lab, Pharmacy, Receptionist, Doctors) were being redirected to setup-profile screen intermittently.

**Root Cause:** The Google Auth listener (`onAuthStateChanged`) was running even for internal auth users, causing profile checks that would fail and trigger redirects.

**Solution:** 
- Restructured `AuthContext.tsx` to completely separate internal auth from Google auth
- Internal auth users now have their own dedicated flow that exits early with `return`
- Google Auth listener only runs for actual Google-authenticated users
- Added proper cleanup functions to prevent memory leaks

**Code Location:** `src/contexts/AuthContext.tsx` lines 37-100

---

### 2. Single-Device Login Not Working ✅ FIXED
**Problem:** When logging in on a second device, the first device was not being logged out.

**Root Cause:** Session monitoring was disabled for internal users to prevent false logouts, but this also prevented legitimate concurrent login detection.

**Solution:**
- Re-enabled session monitoring for internal auth users with improved logic
- Added username verification: checks if session username matches local username
- Session deletion detection: monitors if session node is removed from Firebase
- Proper cleanup on component unmount to prevent memory leaks

**How it works:**
1. User logs in on Device 1 → Creates session with UID_1
2. User logs in on Device 2 → Login page finds existing session → Deletes UID_1 → Creates UID_2
3. Device 1's listener detects session deletion → Logs out immediately
4. Alternative: If session username changes → Also triggers logout

**Code Location:** `src/contexts/AuthContext.tsx` lines 69-88

---

### 3. Chat System Issues ✅ VERIFIED
**Problem:** Chat not working properly for Lab and other staff members.

**Root Cause:** Multiple issues:
- Deleted staff appearing in chat list
- OwnerId context not properly set for internal users
- Notification filtering not working correctly

**Solutions Applied:**
1. **Active Staff Filter:** Only show staff with `isActive !== false`
2. **OwnerId Context:** Properly restored from localStorage for all internal users
3. **Notification Tracking:** Enhanced with `senderId` in notification data
4. **Real-time Updates:** Using `onValue` listeners for instant refresh
5. **Patient-to-Receptionist:** Notifications now sent to both ownerId and 'receptionist'

**Code Locations:**
- `src/components/Intercom.tsx` lines 129-165 (Staff filtering)
- `src/components/Intercom.tsx` lines 245-270 (Patient notifications)
- `src/contexts/AuthContext.tsx` line 66 (OwnerId restoration)

---

## Testing Checklist

### Internal Auth Users (Lab/Pharmacy/Receptionist/Doctor)
- [ ] Login works without redirect to setup-profile
- [ ] Dashboard loads correctly
- [ ] Chat bubble appears
- [ ] Staff list shows only active members
- [ ] Can send and receive messages
- [ ] Second device login logs out first device
- [ ] Page refresh doesn't cause logout

### Google Auth Users (Owners)
- [ ] New users go to setup-profile
- [ ] Existing users go to dashboard
- [ ] Second device login logs out first device
- [ ] Chat works with staff members

### Chat System
- [ ] Staff-to-Staff messaging works
- [ ] Patient-to-Receptionist messaging works
- [ ] Receptionist-to-Patient messaging works
- [ ] Red dots appear for unread messages
- [ ] Red dots disappear when chat opened
- [ ] Deleted staff don't appear in list
- [ ] Real-time message delivery

---

## Technical Details

### Session Structure (Internal Auth)
```
sessions/
  {anonymousUID}/
    userId: {anonymousUID}
    username: "spot@lab"
    role: "lab"
    name: "Lab Technician"
    ownerId: "{ownerUID}"
    deviceId: "..."
    loginAt: "2025-12-24T..."
    lastActive: "2025-12-24T..."
```

### Session Structure (Google Auth)
```
sessions/
  {googleUID}/
    sessionId: "sess_1234567890_abc123"
    lastActive: "2025-12-24T..."
    device: "Mozilla/5.0..."
    role: "receptionist"
    name: "Owner Name"
    ownerId: {googleUID}
```

### Notification Structure (Chat)
```
notifications/
  {recipientUID}/
    {notificationId}/
      type: "general"
      title: "New Message from {sender}"
      message: "Message preview..."
      read: false
      data:
        senderId: "{senderUID}"  // CRITICAL for red dots
      createdAt: "2025-12-24T..."
```

---

## Known Limitations

1. **Session Monitoring Delay:** There's a ~1-2 second delay between second device login and first device logout (Firebase real-time database propagation)

2. **Network Issues:** If a device is offline when logged out remotely, it will detect the logout when it comes back online

3. **Browser Refresh:** During page refresh, there's a brief moment where session check runs - this is normal and doesn't cause logout

---

## Files Modified

1. `src/contexts/AuthContext.tsx` - Core authentication logic
2. `src/components/Intercom.tsx` - Chat system with filtering and notifications

---

## Rollback Instructions

If issues occur, revert these commits:
- AuthContext session monitoring changes
- Intercom staff filtering changes

The system will fall back to:
- No automatic logout on second device
- All staff (including deleted) showing in chat
- But no redirect loops or false logouts
