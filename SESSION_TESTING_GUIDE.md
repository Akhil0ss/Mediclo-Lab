# Session Management Testing Guide

## Current Status

### ✅ Fixed Issues:
1. **Logout Button** - Now works for both Google and internal auth users
2. **Setup-Profile Redirect** - Internal auth users no longer get redirected
3. **Session Monitoring** - Active for internal users

### ⚠️ Important Understanding:

**Opening multiple tabs in the SAME browser is NOT a concurrent login!**

When you open a second tab:
- It uses the SAME localStorage
- It uses the SAME session
- No new login occurs
- Session monitoring will NOT trigger

This is expected behavior and actually GOOD for user experience.

---

## How to Test Concurrent Login Detection

### Test 1: Different Browsers (CORRECT WAY)
1. **Browser 1 (Chrome):** Login as `spot@lab` with password
2. **Browser 2 (Firefox/Edge):** Login as `spot@lab` with same password
3. **Expected Result:** Browser 1 should automatically logout within 1-2 seconds

### Test 2: Incognito Mode
1. **Normal Window:** Login as `spot@lab`
2. **Incognito Window:** Login as `spot@lab`
3. **Expected Result:** Normal window should logout

### Test 3: Different Devices
1. **Computer:** Login as `spot@lab`
2. **Phone/Tablet:** Login as `spot@lab`
3. **Expected Result:** Computer should logout

---

## What Happens During Concurrent Login

### Step-by-Step Process:

**Device 1 (Already Logged In):**
```
localStorage:
  userId: "abc123"
  username: "spot@lab"
  
Firebase sessions/abc123:
  username: "spot@lab"
  role: "lab"
  loginAt: "2025-12-24T10:00:00"
  
Session Monitor: ✅ Active, listening to sessions/abc123
```

**Device 2 (New Login):**
```
1. User enters credentials
2. API validates credentials ✅
3. signInAnonymously() → Gets new UID: "xyz789"
4. Check existing sessions → Finds abc123 with username "spot@lab"
5. DELETE sessions/abc123 ← This triggers Device 1's monitor!
6. CREATE sessions/xyz789 with username "spot@lab"
7. Store xyz789 in localStorage
8. Redirect to dashboard
```

**Device 1 (Automatic Logout):**
```
Session Monitor detects:
  - sessions/abc123 no longer exists!
  - Trigger: snapshot.exists() === false
  - Action: localStorage.clear()
  - Redirect: /login?reason=session_expired
```

**Timeline:**
- T+0s: Device 2 login initiated
- T+0.5s: Device 2 deletes old session
- T+1s: Device 1's monitor detects deletion
- T+1.5s: Device 1 redirects to login
- T+2s: Device 2 completes login

---

## Debugging Steps

### 1. Check Console Logs

**On Device 1 (should see):**
```
🔍 AuthContext: Username login detected
🔒 Setting up session monitoring for userId: abc123
✅ Session exists, verifying username...
Session data: {username: "spot@lab", role: "lab", ...}
Expected username: spot@lab
```

**When Device 2 logs in (Device 1 should see):**
```
⚠️ Session deleted remotely. Logging out.
Session path checked: sessions/abc123
```

### 2. Check Firebase Database

Navigate to: `https://console.firebase.google.com`
- Go to Realtime Database
- Check `sessions/` node
- You should see only ONE session per username at any time

### 3. Check localStorage

**Open DevTools → Application → Local Storage:**
```
authMethod: "username"
userId: "abc123"  ← This is the session key!
username: "spot@lab"
userRole: "lab"
ownerId: "owner123"
```

---

## Common Misconceptions

### ❌ WRONG: "Two tabs should logout each other"
**Why it doesn't work:**
- Same browser = Same localStorage
- Same localStorage = Same session
- No new login = No logout trigger

### ✅ CORRECT: "Two browsers/devices should logout each other"
**Why it works:**
- Different browser = Different localStorage
- New login = New session created
- Old session deleted = Monitor triggers logout

---

## Manual Testing Checklist

### Logout Button Test:
- [ ] Login as Lab user
- [ ] Click Logout button
- [ ] Should redirect to home page
- [ ] localStorage should be cleared
- [ ] Firebase session should be deleted

### Concurrent Login Test (Different Browsers):
- [ ] Login as Lab on Chrome
- [ ] Login as Lab on Firefox
- [ ] Chrome should auto-logout within 2 seconds
- [ ] Firefox should stay logged in
- [ ] Only Firefox session exists in Firebase

### Session Persistence Test:
- [ ] Login as Lab
- [ ] Refresh page multiple times
- [ ] Should NOT logout
- [ ] Should stay on dashboard

### Multiple Tabs Test (Same Browser):
- [ ] Login as Lab
- [ ] Open new tab, go to dashboard
- [ ] Both tabs should work
- [ ] Logout from one tab
- [ ] Other tab should also logout (on next action)

---

## Troubleshooting

### Issue: "Logout button doesn't work"
**Check:**
1. Open DevTools Console
2. Click Logout
3. Look for errors
4. Verify `handleSignOut` is being called

**Fix Applied:**
- Updated to use correct session key (userId for internal auth)
- Added fallback error handling
- Force clear localStorage even if Firebase fails

### Issue: "Second login doesn't logout first"
**Verify:**
1. Are you using DIFFERENT browsers? (Not tabs!)
2. Check Firebase Database - is old session being deleted?
3. Check Console logs on first device
4. Wait 2-3 seconds for Firebase propagation

**Common Causes:**
- Using same browser (expected behavior)
- Network delay (wait longer)
- Session monitoring not initialized (check logs)

---

## Code Locations

### Session Monitoring:
`src/contexts/AuthContext.tsx` lines 69-95

### Logout Handler:
`src/app/dashboard/layout.tsx` lines 128-167

### Login Flow:
`src/app/login/page.tsx` lines 80-107

---

## Next Steps if Still Not Working

1. **Check Browser Console** for any errors
2. **Check Firebase Rules** - ensure sessions can be read/written
3. **Check Network Tab** - verify Firebase connection
4. **Try clearing all browser data** and test fresh
5. **Verify you're testing with DIFFERENT browsers**, not tabs

---

## Expected Behavior Summary

| Scenario | Expected Result |
|----------|----------------|
| Open 2nd tab (same browser) | Both tabs work ✅ |
| Login on 2nd browser | 1st browser logs out ✅ |
| Click logout button | Redirects to home ✅ |
| Refresh page | Stays logged in ✅ |
| Session deleted remotely | Auto logout ✅ |
| Network offline | Works offline, syncs when online ✅ |
