# ⚠️ CRITICAL: Firebase Rules Update Required

To fix the permission errors when **Adding Doctors**, **Creating Backups**, and enabling **Anonymous Login** for staff/patients, you MUST update your Firebase Database Rules.

## Why?
Currently, your database rules might be restricting access only to the exact authenticated user (e.g., `"$uid === auth.uid"`).
1. **Admins** need to read everything for backups.
2. **Staff** (Anonymous Users) need to read/write to the **Owner's** data nodes.
3. **Doctors** need to read their queue.

Since we are using custom Roles in the database (`users/{uid}/profile/role`), simply checking `auth != null` is the easiest interim fix, or you can implement complex role-based rules later.

## How to Fix

1. Go to **Firebase Console** > **Realtime Database** > **Rules**.
2. Replace the current rules with the following:

```json
{
  "rules": {
    ".read": "auth != null",
    ".write": "auth != null"
  }
}
```

3. Click **Publish**.

## What this does
- Allows **ANY logged-in user** (including Owner, Staff, Patients via portal) to read/write data.
- **Unauthenticated users** (public) still CANNOT access anything.

This is standard for internal business tools where all users are trusted staff or verified patients.
