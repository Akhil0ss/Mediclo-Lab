# Google Drive Backup Integration Plan

## 🎯 Objective
Setup automatic backup to owner's Google Drive using Google OAuth login

---

## 📋 Implementation Steps

### Step 1: Google Cloud Console Setup

1. **Go to:** https://console.cloud.google.com/
2. **Create/Select Project:** "MedOS Backup"
3. **Enable APIs:**
   - Google Drive API
   - Google OAuth 2.0

4. **Create OAuth Credentials:**
   - Go to: APIs & Services → Credentials
   - Create OAuth 2.0 Client ID
   - Application type: Web application
   - Authorized redirect URIs:
     - `http://localhost:3000/api/auth/callback/google`
     - `https://yourdomain.com/api/auth/callback/google`

5. **Get Credentials:**
   - Client ID: `YOUR_CLIENT_ID`
   - Client Secret: `YOUR_CLIENT_SECRET`

6. **Add to `.env.local`:**
```env
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_DRIVE_FOLDER_NAME=MedOS_Backups
```

---

### Step 2: Install Dependencies

```bash
npm install googleapis
npm install @google-cloud/storage
```

---

### Step 3: Create Google Drive Manager

**File:** `src/lib/googleDriveBackup.ts`

```typescript
import { google } from 'googleapis';

export interface DriveAuthTokens {
  access_token: string;
  refresh_token: string;
  scope: string;
  token_type: string;
  expiry_date: number;
}

/**
 * Initialize Google Drive client
 */
export function initDriveClient(tokens: DriveAuthTokens) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.NEXT_PUBLIC_APP_URL + '/api/auth/callback/google'
  );

  oauth2Client.setCredentials(tokens);
  return google.drive({ version: 'v3', auth: oauth2Client });
}

/**
 * Get or create backup folder in Drive
 */
export async function getOrCreateBackupFolder(
  drive: any,
  folderName: string = 'MedOS_Backups'
) {
  // Search for existing folder
  const response = await drive.files.list({
    q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name)',
    spaces: 'drive'
  });

  if (response.data.files.length > 0) {
    return response.data.files[0].id;
  }

  // Create new folder
  const folderMetadata = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder'
  };

  const folder = await drive.files.create({
    resource: folderMetadata,
    fields: 'id'
  });

  return folder.data.id;
}

/**
 * Upload backup to Google Drive
 */
export async function uploadBackupToDrive(
  drive: any,
  folderId: string,
  backupData: any,
  filename: string
) {
  const fileMetadata = {
    name: filename,
    parents: [folderId]
  };

  const media = {
    mimeType: 'application/json',
    body: JSON.stringify(backupData, null, 2)
  };

  const file = await drive.files.create({
    resource: fileMetadata,
    media: media,
    fields: 'id, name, webViewLink'
  });

  return file.data;
}

/**
 * List backups from Drive
 */
export async function listDriveBackups(drive: any, folderId: string) {
  const response = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false`,
    fields: 'files(id, name, createdTime, size, webViewLink)',
    orderBy: 'createdTime desc'
  });

  return response.data.files;
}

/**
 * Delete old backups from Drive
 */
export async function deleteOldDriveBackups(
  drive: any,
  folderId: string,
  daysToKeep: number = 90
) {
  const backups = await listDriveBackups(drive, folderId);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  let deletedCount = 0;

  for (const backup of backups) {
    const backupDate = new Date(backup.createdTime);
    if (backupDate < cutoffDate) {
      await drive.files.delete({ fileId: backup.id });
      deletedCount++;
    }
  }

  return deletedCount;
}
```

---

### Step 4: Create API Routes

**File:** `src/app/api/backup/google-auth/route.ts`

```typescript
import { google } from 'googleapis';
import { NextResponse } from 'next/server';

export async function GET() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.NEXT_PUBLIC_APP_URL + '/api/auth/callback/google'
  );

  const scopes = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/drive.appdata'
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent'
  });

  return NextResponse.json({ url });
}
```

**File:** `src/app/api/auth/callback/google/route.ts`

```typescript
import { google } from 'googleapis';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect('/admin/backup?error=no_code');
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.NEXT_PUBLIC_APP_URL + '/api/auth/callback/google'
  );

  try {
    const { tokens } = await oauth2Client.getToken(code);
    
    // Store tokens in database for this owner
    // You'll need to implement this based on your auth system
    
    return NextResponse.redirect('/admin/backup?success=true');
  } catch (error) {
    console.error('Error getting tokens:', error);
    return NextResponse.redirect('/admin/backup?error=auth_failed');
  }
}
```

**File:** `src/app/api/backup/upload/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createBackup } from '@/lib/backupManager';
import { initDriveClient, getOrCreateBackupFolder, uploadBackupToDrive } from '@/lib/googleDriveBackup';

export async function POST(request: NextRequest) {
  try {
    const { ownerId, tokens } = await request.json();

    // Create backup
    const backupData = await createBackup(ownerId);
    if (!backupData) {
      return NextResponse.json({ error: 'Failed to create backup' }, { status: 500 });
    }

    // Initialize Drive client
    const drive = initDriveClient(tokens);

    // Get/Create backup folder
    const folderId = await getOrCreateBackupFolder(drive);

    // Upload to Drive
    const date = new Date();
    const filename = `medos-backup-${date.toISOString().split('T')[0]}.json`;
    const file = await uploadBackupToDrive(drive, folderId, backupData, filename);

    return NextResponse.json({
      success: true,
      file: {
        id: file.id,
        name: file.name,
        link: file.webViewLink
      }
    });
  } catch (error) {
    console.error('Backup upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
```

---

### Step 5: Update Admin Backup Page

**File:** `src/app/admin/backup/page.tsx`

Add Google Drive integration:

```typescript
// Add state for Google Drive
const [driveConnected, setDriveConnected] = useState(false);
const [driveTokens, setDriveTokens] = useState(null);

// Connect to Google Drive
const connectGoogleDrive = async () => {
  const response = await fetch('/api/backup/google-auth');
  const { url } = await response.json();
  window.open(url, '_blank');
};

// Upload to Google Drive
const uploadToDrive = async () => {
  const response = await fetch('/api/backup/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ownerId: user.uid,
      tokens: driveTokens
    })
  });

  const result = await response.json();
  if (result.success) {
    showToast(`Backup uploaded to Google Drive!\nFile: ${result.file.name}`);
  }
};

// UI
<button onClick={connectGoogleDrive}>
  Connect Google Drive
</button>

<button onClick={uploadToDrive} disabled={!driveConnected}>
  Backup to Google Drive
</button>
```

---

## 🔐 Security Considerations

1. **Token Storage:**
   - Store refresh tokens encrypted in database
   - Never expose tokens in client-side code
   - Use server-side API routes only

2. **Permissions:**
   - Request minimal Drive permissions
   - Only access backup folder
   - No access to other Drive files

3. **Data Encryption:**
   - Encrypt backup data before upload (optional)
   - Use AES-256 encryption
   - Store encryption key securely

---

## 📊 Database Schema for Tokens

```typescript
// Add to users/owners collection
{
  googleDrive: {
    connected: true,
    accessToken: "encrypted_token",
    refreshToken: "encrypted_token",
    expiryDate: timestamp,
    folderId: "drive_folder_id"
  }
}
```

---

## 🎯 User Flow

1. **Owner goes to Admin → Backup**
2. **Clicks "Connect Google Drive"**
3. **Google OAuth popup opens**
4. **Owner logs in with their Google account**
5. **Grants permission to MedOS**
6. **Tokens stored in database**
7. **"Backup to Google Drive" button enabled**
8. **Click to create & upload backup**
9. **Backup appears in their Google Drive**

---

## ✅ Features

- ✅ One-click Google Drive connection
- ✅ Automatic backup upload
- ✅ Organized in "MedOS_Backups" folder
- ✅ Auto-delete old backups (>90 days)
- ✅ View backup history
- ✅ Download from Drive
- ✅ Secure token management

---

## 🚀 Implementation Priority

**Phase 1 (Immediate):**
1. Setup Google Cloud Console
2. Create OAuth credentials
3. Add environment variables

**Phase 2 (Next):**
1. Install googleapis package
2. Create googleDriveBackup.ts
3. Create API routes

**Phase 3 (Final):**
1. Update admin backup page
2. Test OAuth flow
3. Test backup upload

---

## 📝 Alternative: Firebase Storage (Current)

**Current implementation uses Firebase Storage:**
- ✅ Already integrated
- ✅ No OAuth needed
- ✅ Works immediately
- ❌ Not in owner's personal Drive

**Google Drive integration:**
- ✅ Owner's personal Drive
- ✅ Full control
- ✅ Easy access
- ❌ Requires OAuth setup

---

**Kya aap chahte hain:**
1. **Google Drive setup karein** (OAuth + API)?
2. **Firebase Storage use karein** (already working)?
3. **Dono options dein** (user can choose)?

Batao! 🎯
