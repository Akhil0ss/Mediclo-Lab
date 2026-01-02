# Permanent Fixes Manual

This document records the critical fixes applied to resolve persistent issues with redirections, data access, and UI consistency.

## 1. Authentication & Redirection Integrity
**File:** `src/contexts/AuthContext.tsx`
**Fix:** Explicitly prevented redirections for protected routes.
**Logic:**
- Added checks for `/patient` and `/print/` paths in the authentication redirects.
- Ensures that:
  1. Patients are never redirected to the staff login page (`/login`).
  2. Public print pages (Rx, Reports) are never redirected to login.
  3. Anonymous session transitions do not trigger false-positive logouts.

## 2. Notification System Stability
**File:** `src/components/NotificationBell.tsx`
**Fix:** Resolved "Rendered fewer hooks than expected" error.
**Logic:**
- Moved the role-based early return check (`if (!receptionist) return null`) to the **end** of the component.
- Ensures all React hooks (`useState`, `useEffect`) execute in the same order on every render, complying with React rules.

## 3. Prescription Access (OPD Print)
**File:** `src/app/print/opd/[rxId]/page.tsx`
**Fix:** robust Data Source ID resolution.
**Logic:**
- Replaced fragile `userProfile?.ownerId` check with a robust priority strategy:
  1. **Staff**: Check `localStorage.getItem('ownerId')` first.
  2. **Real Owner**: Check `user.uid` IF user is NOT anonymous. This prevents Owners from accidentally using stale patient credentials from testing.
  3. **Patient**: Check `patient_owner_id` (fallback for anonymous users).
  4. **Fallback**: `user.uid`.
- This ensures Staff/Owners always access the correct data silo even if `userProfile` is loading or localStorage has mixed role data.

## 4. Chat System (Intercom)
**File:** `src/components/Intercom.tsx`
**Fix:** Bubble alignment and login visibility.
**Logic:**
- Unified sender ID logic so both "sending" and "rendering" phases use the exact same ID (username for staff, UID for others).
- Added `usePathname` for reactive visibility updates (auto-hide on login page, auto-show on dashboard).
- Removed sender names from bubbles for cleaner UI in 1-on-1 chats.
- NOTIFICATION ROUTING: Patient messages now notify 'receptionist' ID only, not ownerId.
- AUTO-CLEANUP: Added logic to automatically mark legacy patient chat notifications as read on the Owner's dashboard to keep it clean.
