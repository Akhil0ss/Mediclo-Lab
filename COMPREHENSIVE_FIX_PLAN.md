# Comprehensive Fix Plan

## Current Issues
1. ✅ Staff data access (Owner ID) - FIXED
2. ✅ Subscription inheritance - FIXED  
3  Pharmacy login → redirects to setup
4. ❌ Doctor login → says wrong password
5. ❌ Lab Dashboard → missing Quick Report (we added it)

## Root Cause Analysis

### Issue: Anonymous Auth + Session Race Condition
- Staff logs in → API creates session
- AuthContext fires BEFORE session is written
- Falls through to owner profile check
- Finds no profile → redirects to setup

### Issue: Password Hash Mismatch?
- Need to verify hash function works correctly
- Check if database has correct structure

## Proposed Solution

### Immediate Fix (Current Architecture)
1. **Add session write confirmation before redirect** in login page
2. **Add retry logic** in AuthContext for session check
3. **Better fallback** in AuthContext (don't redirect if authMethod=username)

### Better Long-term Fix (Firebase Auth Integration)
1. Create Firebase Auth users for staff
2. Use real authentication
3. Store ownerId in custom claims or database

## Implementation Priority
1. Fix AuthContext fallback logic (5 min)
2. Test all logins (10 min)
3. If still broken, add debug logging and check database structure
