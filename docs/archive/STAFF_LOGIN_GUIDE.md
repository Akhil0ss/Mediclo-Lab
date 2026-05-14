# 🔐 Login Issue - Staff Users Not Created

## Problem
You're getting **401 Unauthorized** because staff users don't exist yet!

## Solution: Create Staff Users First

### Step 1: Login as Owner (Google)
1. Go to http://localhost:3001
2. Click **"Continue with Google"**
3. Login with your Google account

### Step 2: Complete Setup Profile
After Google login, you'll be redirected to **Setup Profile** page:

1. Enter **Lab Name** (e.g., "Spotnet Labs")
2. Enter **Password** for receptionist (e.g., "Test@123")
3. Click **"Create User Accounts"**

This will create 3 staff users:
- `spot@receptionist` (your password)
- `spot@lab` (auto-generated password)
- `spot@pharmacy` (auto-generated password)

### Step 3: Save Staff Credentials
After setup, you'll see a screen with all usernames and passwords.
**IMPORTANT**: Copy and save these credentials!

Example:
```
RECEPTIONIST (Your Account):
Username: spot@receptionist
Password: Test@123

LAB USER:
Username: spot@lab
Password: Xy7@kL9m

PHARMACY USER:
Username: spot@pharmacy
Password: Qw3@pN8r
```

### Step 4: Test Staff Login
1. Logout from owner account
2. Go to http://localhost:3001/login
3. Click **"Login with Username"**
4. Enter staff credentials
5. Should login successfully!

## Why This Happens

### Google Login (Owner):
- ✅ Works immediately
- Creates owner account automatically
- No username/password needed

### Username Login (Staff):
- ❌ Needs setup first
- Requires owner to create staff accounts
- Each staff member gets unique username/password

## Current Status

You need to:
1. ✅ Login with Google first (as owner)
2. ❌ Complete setup profile (create staff users)
3. ❌ Then use staff credentials to login

## Quick Test

### Test Owner Login:
```
1. Go to http://localhost:3001
2. Click "Continue with Google"
3. Should redirect to /setup-profile or /dashboard
```

### If Already Setup:
```
1. Check Firebase Console
2. Go to Realtime Database
3. Look for: users/{yourUID}/auth/
4. Should have: receptionist, lab, pharmacy
5. Each has username and passwordHash
```

## Need Help?

If setup profile is not showing:
1. Clear localStorage: `localStorage.clear()`
2. Logout and login again with Google
3. Should show setup page

If you've already done setup:
1. Go to Firebase Console
2. Database → users → {yourUID} → auth
3. Check receptionist/lab/pharmacy usernames
4. Use those usernames to login
