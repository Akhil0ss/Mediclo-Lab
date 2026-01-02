# Authentication Fix Plan

## Current Issues
1. ❌ Staff/Admin login only works when owner is logged in with Google (CRITICAL BUG)
2. ❌ Patient login not working at all
3. ❌ No single-device login security (subscription misuse risk)

## Root Cause
- API route uses Firebase Client SDK which requires authenticated user
- Staff/Patient logins depend on owner's Google session

## Solution: Anonymous Authentication

### Firebase Anonymous Auth Benefits
- ✅ No Google login dependency
- ✅ Each session gets unique anonymous UID
- ✅ Can store session data in Firebase
- ✅ Can implement single-device login
- ✅ Works independently for each user

### Implementation Steps

#### 1. Update API Route (`/api/auth/login/route.ts`)
- Keep current username/password validation logic
- Return session token instead of direct user data
- No Firebase SDK calls needed (pure Node.js)

#### 2. Update Login Page (`/app/login/page.tsx`)
- After successful API validation, sign in anonymously
- Store session info in Firebase under anonymous UID
- Implement device fingerprinting

#### 3. Update AuthContext (`/contexts/AuthContext.tsx`)
- Check for anonymous user
- Fetch actual user data from session node
- Validate single-device login

#### 4. Add Session Management
```
sessions/
  {anonymousUID}/
    userId: "owner123"
    role: "receptionist"
    username: "spot@receptionist"
    deviceId: "unique-device-fingerprint"
    loginAt: timestamp
    lastActive: timestamp
```

#### 5. Single Device Security
- Generate device fingerprint (browser + OS + screen)
- On login: Check if another session exists
- If exists: Force logout previous session
- Store only ONE active session per username

### Patient Login Fix
- Same anonymous auth approach
- Session node: `patientSessions/{anonymousUID}`
- Store: mobile, name, token

## Files to Modify
1. `/app/api/auth/login/route.ts` - Simplify (no Firebase calls)
2. `/app/login/page.tsx` - Add anonymous sign-in
3. `/contexts/AuthContext.tsx` - Read from sessions
4. `/app/patient/page.tsx` - Add anonymous sign-in
5. Add `/lib/deviceFingerprint.ts` - Device ID generation

## Security Benefits
- ✅ Each device = unique session
- ✅ Logout on one device = session cleared
- ✅ Can't login on multiple devices simultaneously
- ✅ Subscription tied to single active session
