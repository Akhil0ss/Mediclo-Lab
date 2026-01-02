# FIREBASE CLEANUP GUIDE

## 🗑️ Manual Cleanup (Do Now)

### 1. Delete Old Anonymous Users
**Firebase Console → Authentication → Users**
- Filter by "Anonymous" 
- Select all anonymous users
- Delete them (they're just test logins)

### 2. Delete Old Sessions
**Firebase Console → Realtime Database → sessions**
- Delete entire `sessions` node
- It will recreate automatically on next login

### 3. Keep These:
- ✅ `owners` - Your lab data
- ✅ `users` - Owner profiles
- ✅ `patients` - Patient data
- ✅ `appointments`, `reports`, etc.

---

## 🔄 Auto-Cleanup (Already Implemented)

### Session Cleanup on Logout
**File: `src/app/dashboard/layout.tsx`**
```typescript
// Deletes Firebase session when user logs out
await remove(ref(database, `sessions/${sessionId}`));
```

### Session Expiry (7 Days)
**File: `src/app/api/auth/login/route.ts`**
```typescript
// Sessions expire after 7 days
expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
```

---

## 📋 Future Improvements (Optional)

### Add Scheduled Cleanup (Cloud Function)
Create a Firebase Cloud Function to delete expired sessions daily:

```javascript
// functions/index.js
exports.cleanupExpiredSessions = functions.pubsub
  .schedule('every 24 hours')
  .onRun(async (context) => {
    const now = new Date().toISOString();
    const sessionsRef = admin.database().ref('sessions');
    const snapshot = await sessionsRef.once('value');
    
    const updates = {};
    snapshot.forEach(child => {
      if (child.val().expiresAt < now) {
        updates[child.key] = null; // Delete
      }
    });
    
    await sessionsRef.update(updates);
    console.log('Cleaned up expired sessions');
  });
```

### Add Anonymous User Cleanup
Firebase automatically deletes anonymous users after 30 days of inactivity.

---

## ✅ Current Status

**Automatic Cleanup:**
- ✅ Sessions deleted on logout
- ✅ Sessions expire after 7 days
- ✅ AuthContext validates expiry

**Manual Cleanup Needed:**
- 🔧 Old test sessions (delete now)
- 🔧 Old anonymous users (delete now)

**No Garbage Will Accumulate:**
- Every logout deletes session
- Expired sessions won't be used (validated in AuthContext)
- Anonymous users auto-delete after 30 days (Firebase default)
