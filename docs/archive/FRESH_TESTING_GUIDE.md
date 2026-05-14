# 🔄 Fresh Testing Guide - Firebase Data Reset with Template Backup

## आपका सवाल: Templates कैसे बचाएं?

### ✅ **Answer: Templates Firebase में हैं, लेकिन Backup Script है!**

---

## 📍 Templates Location

**Templates are stored in Firebase Realtime Database:**
```
Firebase Path: templates/{userId}/
  {templateId}/
    name: "CBC"
    category: "Hematology"
    subtests: [...]
    price: 500
```

**NOT in code files** - All templates are in Firebase only.

---

## 🛡️ Complete Fresh Testing Process

### Step 1: Backup Templates (CRITICAL!)

**Method 1: Using Backup Script (Recommended)**

```bash
# 1. Add backup script to package.json
# Open package.json and add to "scripts":
"backup:templates": "tsx scripts/backup-templates.ts backup",
"backup:restore": "tsx scripts/backup-templates.ts restore",
"backup:list": "tsx scripts/backup-templates.ts list"

# 2. Install tsx if not installed
npm install -D tsx

# 3. Run backup
npm run backup:templates
```

**This will create:** `firebase-backups/templates-backup-{timestamp}.json`

**Method 2: Manual Firebase Export**

1. Go to: https://console.firebase.google.com
2. Select your project
3. Realtime Database → Click ⋮ (three dots)
4. Export JSON
5. Save file as `firebase-full-backup.json`

---

### Step 2: Backup Current User Data (Optional but Recommended)

**Export these nodes from Firebase Console:**

```
users/
  {yourUserId}/
    profile/
    auth/
    branding/
```

**Save as:** `user-data-backup.json`

---

### Step 3: Delete Firebase Data

**Option A: Delete Specific Nodes (Safer)**

Go to Firebase Console and delete:
- ✅ `patients/` - All patient records
- ✅ `samples/` - All samples
- ✅ `reports/` - All reports
- ✅ `appointments/` - All appointments
- ✅ `opd/` - OPD records
- ✅ `doctors/` - Doctor records
- ⚠️ **KEEP:** `templates/` (or backup first!)
- ⚠️ **KEEP:** `users/` (or backup first!)

**Option B: Delete Everything (Nuclear Option)**

1. Firebase Console → Realtime Database
2. Click on root `/`
3. Click ⋮ → Delete
4. Confirm deletion

⚠️ **WARNING:** This deletes EVERYTHING including templates!

---

### Step 4: Create Fresh Test User

**Method 1: New Google Account**

1. Go to your app
2. Click "Sign in with Google"
3. Use a NEW Google account
4. Complete setup-profile
5. This creates a fresh user with new UID

**Method 2: New Internal User**

1. Go to Firebase Console
2. Create new user in `users/{newUID}/`
3. Set up auth credentials
4. Login with new credentials

---

### Step 5: Restore Templates

**Using Backup Script:**

```bash
# 1. List available backups
npm run backup:list

# 2. Restore from specific backup
npm run backup:restore firebase-backups/templates-backup-2025-12-24T10-30-00-000Z.json
```

**Manual Restore:**

1. Open backup JSON file
2. Copy the `templates` object
3. Firebase Console → Realtime Database
4. Navigate to `templates/{newUserId}/`
5. Paste the templates data

---

## 📋 Complete Step-by-Step Checklist

### Pre-Testing Preparation

- [ ] **Backup templates** using script or manual export
- [ ] **Backup user data** (optional)
- [ ] **Note down** current user UID
- [ ] **Document** any custom settings
- [ ] **Close** all browser tabs with app open

### Fresh Start

- [ ] **Delete** old data from Firebase
- [ ] **Clear** browser localStorage (F12 → Application → Clear)
- [ ] **Clear** browser cookies for your domain
- [ ] **Logout** from Google account (if using Google auth)

### New User Setup

- [ ] **Create** new Google account OR new internal user
- [ ] **Login** to app with new account
- [ ] **Complete** setup-profile
- [ ] **Verify** new UID in Firebase

### Template Restoration

- [ ] **Run** restore script OR manual import
- [ ] **Verify** templates appear in Templates tab
- [ ] **Test** creating a sample with template
- [ ] **Test** generating a report

### Complete Testing

- [ ] Login/Logout works
- [ ] Settings → Team management
- [ ] Chat system
- [ ] Create patient
- [ ] Create sample
- [ ] Generate report
- [ ] PDF download
- [ ] Session management (2 browsers)

---

## 🔧 Quick Commands Reference

### Backup Templates
```bash
# Add to package.json first!
npm run backup:templates
```

### List Backups
```bash
npm run backup:list
```

### Restore Templates
```bash
npm run backup:restore firebase-backups/templates-backup-YYYY-MM-DDTHH-mm-ss-sssZ.json
```

### Install Dependencies
```bash
npm install -D tsx
```

---

## 📁 Backup File Structure

```json
{
  "backupDate": "2025-12-24T10:30:00.000Z",
  "totalUsers": 1,
  "totalTemplates": 150,
  "templates": {
    "{userId}": {
      "{templateId1}": {
        "name": "CBC",
        "category": "Hematology",
        "subtests": [...],
        "price": 500
      },
      "{templateId2}": {
        "name": "Lipid Profile",
        "category": "Biochemistry",
        "subtests": [...],
        "price": 800
      }
    }
  }
}
```

---

## ⚠️ Important Warnings

### DO NOT Delete Without Backup!

**Templates are NOT in code files!**
- ❌ Not in `src/`
- ❌ Not in `public/`
- ❌ Not in any file
- ✅ Only in Firebase Database

**If you delete Firebase data without backup:**
- ❌ Templates are LOST forever
- ❌ Cannot recover from code
- ❌ Must manually recreate all templates

### Safe Deletion Order

1. ✅ Backup templates first
2. ✅ Backup user data (optional)
3. ✅ Delete patient/sample/report data
4. ⚠️ Keep templates node (or restore after)
5. ⚠️ Keep users node (or recreate)

---

## 🎯 Recommended Testing Strategy

### Strategy 1: Partial Reset (Safer)

**Delete only:**
- Patients
- Samples
- Reports
- Appointments
- OPD records

**Keep:**
- Templates
- Users
- Branding
- Settings

**Advantage:** No need to restore templates!

### Strategy 2: Complete Reset (Thorough)

**Delete everything:**
- All Firebase data

**Then restore:**
- Templates from backup
- Create fresh user
- Test from scratch

**Advantage:** True fresh start, catches all issues

---

## 🔄 Alternative: Use Different Firebase Project

**Instead of deleting data:**

1. Create new Firebase project
2. Update `.env.local` with new config
3. Deploy to new project
4. Test with fresh database
5. Keep old project as backup

**Advantage:**
- Original data safe
- Can compare both
- Easy to switch back

---

## 📊 Backup Verification

### Check Backup File

```bash
# View backup file
cat firebase-backups/templates-backup-*.json

# Count templates
# Should show: "totalTemplates": 150 (or your count)
```

### Verify in Firebase

After restore:
1. Firebase Console → Realtime Database
2. Navigate to `templates/{userId}/`
3. Count should match backup file
4. Spot check a few templates

---

## 🆘 Emergency Recovery

### If You Deleted Without Backup

**Option 1: Restore from Vercel Backup**
- Check if you used the backup feature
- Download latest backup
- Import to Firebase

**Option 2: Restore from Legacy App**
- Check `_legacy_app/` folder
- May have template data
- Manually recreate in new system

**Option 3: Manual Recreation**
- Use Templates tab
- Recreate templates one by one
- Time-consuming but works

---

## ✅ Final Checklist

Before deleting Firebase data:

- [ ] Templates backed up ✅
- [ ] Backup file verified ✅
- [ ] User data noted ✅
- [ ] Restore script tested ✅
- [ ] Alternative Firebase project ready (optional)
- [ ] Team informed about testing
- [ ] Production data is separate (not testing on production!)

---

## 🚀 Quick Start Commands

```bash
# 1. Install dependencies
npm install -D tsx

# 2. Add scripts to package.json
# (See "scripts" section in this guide)

# 3. Backup templates
npm run backup:templates

# 4. Delete Firebase data
# (Use Firebase Console)

# 5. Create new user
# (Login with new account)

# 6. Restore templates
npm run backup:restore firebase-backups/templates-backup-[timestamp].json

# 7. Start testing!
npm start
```

---

## 📝 Summary

**Templates Location:** Firebase Database (`templates/{userId}/`)

**Backup Method:** Use `scripts/backup-templates.ts`

**Restore Method:** Run restore script with backup file

**Safe Testing:**
1. Backup templates ✅
2. Delete old data ✅
3. Create new user ✅
4. Restore templates ✅
5. Test everything ✅

**Templates are safe as long as you backup first!** 🛡️
