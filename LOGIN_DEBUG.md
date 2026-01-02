# LOGIN DEBUG CHECKLIST

## Issue: "Invalid username or password" error

## Things to check:

1. **Browser Console Errors**
   - Open browser DevTools (F12)
   - Check Console tab for errors
   - Check Network tab for API response

2. **Test with these credentials:**
   - Username: `test@doctor` (or any existing doctor username)
   - Password: `MASTER123`

3. **Check Firebase Database:**
   - Go to Firebase Console
   - Check if `owners` node exists
   - Check if `owners/{ownerId}/doctors` has users
   - Verify username format in database

4. **API Response Check:**
   - In Network tab, find `/api/auth/login` request
   - Check Response body
   - Should return: `{ success: true, sessionId: "...", user: {...} }`

5. **Common Issues:**
   - Username case mismatch (database has uppercase, you're typing lowercase)
   - No doctors exist in database
   - Firebase rules blocking read
   - API not getting called at all

## Quick Fix Steps:

### Step 1: Check if API is being called
```javascript
// In browser console, run:
fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'test@doctor', password: 'MASTER123' })
}).then(r => r.json()).then(console.log)
```

### Step 2: Check Firebase data structure
- Database should have: `owners/{ownerId}/doctors/{doctorId}/username`
- Username should be lowercase

### Step 3: Verify password hash
- Master password `MASTER123` should bypass hash check
- Check console for "⚠️ MASTER PASSWORD USED ⚠️" message

## Next Steps:
1. Share browser console errors
2. Share Network tab response
3. Share Firebase database structure screenshot
