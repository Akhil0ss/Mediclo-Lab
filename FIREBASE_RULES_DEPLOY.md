# Firebase Database Rules Deployment

## CRITICAL: Deploy These Rules to Firebase

The username/password authentication system requires these security rules to be deployed to your Firebase Realtime Database.

### How to Deploy:

1. **Via Firebase Console (Recommended)**:
   - Go to https://console.firebase.google.com
   - Select your project
   - Navigate to **Realtime Database** → **Rules**
   - Copy the contents of `database.rules.json`
   - Paste into the rules editor
   - Click **Publish**

2. **Via Firebase CLI**:
   ```bash
   firebase deploy --only database
   ```

### Why These Rules Are Needed:

- **Profile Read Access**: Allows unauthenticated users to read user profiles (contains only lab name, role, setupCompleted)
- **Auth Data Protection**: User credentials (`auth/` node) remain protected and only accessible by the owner
- **Username/Password Login**: The authentication system needs to read profiles to match usernames with owner IDs

### Security Notes:

- Profiles contain NO sensitive data (no passwords, no personal info)
- All user credentials are stored in the protected `auth/` node
- Only the owner can read/write their own auth data
- All other data (patients, samples, OPD, etc.) requires authentication

## Current Status:

⚠️ **RULES NOT YET DEPLOYED** - You must deploy these rules manually to Firebase Console for the system to work.
