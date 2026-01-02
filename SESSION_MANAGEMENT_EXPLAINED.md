# Session Management - Google vs Internal Auth

## Question: क्या Google Login (Owner) भी Single Login Follow कर रहा है?

## Answer: हाँ! ✅

**Both Google Login (Owner) और Internal Auth (Staff) दोनों single-device login follow करते हैं।**

---

## Implementation Details

### 1. Google Login (Owner/Admin)
**Code Location:** `src/contexts/AuthContext.tsx` lines 116-151

**How it works:**
```tsx
// For Google users (Owner)
if (typeof window !== 'undefined' && !isPatient) {
    const sessionRef = ref(database, `sessions/${firebaseUser.uid}`);
    
    // Create unique session ID
    let localSessionId = localStorage.getItem('app_session_id');
    if (!localSessionId) {
        localSessionId = `sess_${Date.now()}_${Math.random().toString(36)}`;
        localStorage.setItem('app_session_id', localSessionId);
        
        // Save to Firebase
        await update(sessionRef, {
            sessionId: localSessionId,
            lastActive: new Date().toISOString(),
            device: navigator.userAgent
        });
    }
    
    // Monitor for changes
    onValue(sessionRef, async (snapshot) => {
        const data = snapshot.val();
        if (data.sessionId && data.sessionId !== localSessionId) {
            // Another device logged in!
            await auth.signOut();
            localStorage.clear();
            window.location.href = '/login?reason=concurrent_login';
        }
    });
}
```

**Session Structure:**
```
Firebase: sessions/{googleUID}/
  sessionId: "sess_1735041234567_abc123"
  lastActive: "2025-12-24T16:00:00"
  device: "Mozilla/5.0..."
  role: "receptionist"
  name: "Owner Name"
```

---

### 2. Internal Auth (Staff - Lab/Pharmacy/Doctor)
**Code Location:** `src/contexts/AuthContext.tsx` lines 69-95

**How it works:**
```tsx
// For internal users (Staff)
const sessionRef = ref(database, `sessions/${userId}`);

onValue(sessionRef, (snapshot) => {
    if (!snapshot.exists()) {
        // Session deleted - another device logged in
        localStorage.clear();
        window.location.href = '/login?reason=session_expired';
    } else {
        const data = snapshot.val();
        if (data.username !== username) {
            // Session username changed
            localStorage.clear();
            window.location.href = '/login?reason=session_replaced';
        }
    }
});
```

**Session Structure:**
```
Firebase: sessions/{anonymousUID}/
  userId: "{anonymousUID}"
  username: "spot@lab"
  role: "lab"
  name: "Lab Technician"
  ownerId: "{ownerUID}"
  loginAt: "2025-12-24T16:00:00"
```

---

## Comparison Table

| Feature | Google Login (Owner) | Internal Auth (Staff) |
|---------|---------------------|----------------------|
| **Single Device** | ✅ Yes | ✅ Yes |
| **Session Key** | `app_session_id` | `userId` |
| **Firebase Path** | `sessions/{googleUID}` | `sessions/{anonymousUID}` |
| **Detection Method** | Session ID mismatch | Session deletion or username change |
| **Logout Trigger** | New `sessionId` in Firebase | Session node deleted |
| **Applies To** | Owner/Admin (Google) | Lab/Pharmacy/Doctor/Receptionist |

---

## Testing Both Types

### Test 1: Google Login (Owner)
```
Device 1 (Chrome):
1. Login with Google as Owner
2. localStorage: app_session_id = "sess_123_abc"
3. Firebase: sessions/{googleUID}/sessionId = "sess_123_abc"

Device 2 (Firefox):
1. Login with same Google account
2. localStorage: app_session_id = "sess_456_xyz"
3. Firebase: sessions/{googleUID}/sessionId = "sess_456_xyz" (UPDATED!)

Device 1 (Chrome):
→ Detects sessionId changed from "sess_123_abc" to "sess_456_xyz"
→ Auto logout within 1-2 seconds ✅
```

### Test 2: Internal Auth (Staff)
```
Device 1 (Chrome):
1. Login as spot@lab
2. localStorage: userId = "anon_abc123"
3. Firebase: sessions/anon_abc123 created

Device 2 (Firefox):
1. Login as spot@lab
2. Login page finds existing session for "spot@lab"
3. Deletes sessions/anon_abc123
4. Creates sessions/anon_xyz789

Device 1 (Chrome):
→ Detects sessions/anon_abc123 no longer exists
→ Auto logout within 1-2 seconds ✅
```

---

## Who is Excluded?

**Patients are NOT enforced:**
```tsx
if (typeof window !== 'undefined' && !isPatient) {
    // Session monitoring only for staff/admin
}
```

**Reason:**
- Patients may use multiple devices (phone, tablet, computer)
- Patient portal is view-only, less security risk
- Better user experience for patients

---

## Summary

### ✅ Single-Device Login Enforced For:
1. **Owner (Google Login)** - Uses `app_session_id` tracking
2. **Receptionist (Internal)** - Uses session deletion detection
3. **Lab (Internal)** - Uses session deletion detection
4. **Pharmacy (Internal)** - Uses session deletion detection
5. **Doctor (Internal)** - Uses session deletion detection

### ❌ NOT Enforced For:
1. **Patients** - Can use multiple devices freely

---

## How to Verify

### For Google Login (Owner):
```bash
# 1. Login as Owner on Chrome
# 2. Open DevTools → Application → Local Storage
# 3. Check: app_session_id exists

# 4. Login as same Owner on Firefox
# 5. Chrome should auto-logout within 2 seconds
```

### For Internal Auth (Staff):
```bash
# 1. Login as spot@lab on Chrome
# 2. Open DevTools → Application → Local Storage
# 3. Check: userId exists

# 4. Login as spot@lab on Firefox
# 5. Chrome should auto-logout within 2 seconds
```

---

## Firebase Console Verification

**Check sessions in Firebase:**
1. Go to: https://console.firebase.google.com
2. Select your project
3. Realtime Database → sessions/
4. You should see only ONE session per user at any time

**Example:**
```
sessions/
  {googleUID}/           ← Owner session
    sessionId: "sess_..."
    role: "receptionist"
    
  {anonymousUID1}/       ← Lab session
    username: "spot@lab"
    role: "lab"
    
  {anonymousUID2}/       ← Doctor session
    username: "spot@drsmith"
    role: "doctor"
```

---

## Important Notes

1. **Both systems work independently:**
   - Google users use `sessionId` comparison
   - Internal users use session existence check

2. **Same security level:**
   - Both prevent concurrent logins
   - Both auto-logout old sessions
   - Both have ~1-2 second detection delay

3. **Different implementation:**
   - Google: Checks if sessionId changed
   - Internal: Checks if session deleted

4. **Why different approaches?**
   - Google users have persistent Firebase UID
   - Internal users get new anonymous UID each login
   - Each approach is optimal for its auth type

---

## Conclusion

**हाँ, Google Login (Owner) भी single-device login follow करता है!**

दोनों systems (Google और Internal) में single-device enforcement है, बस implementation method अलग है।

**Security Level:** Same ✅
**User Experience:** Same ✅
**Reliability:** Same ✅
