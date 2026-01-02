# 🔥 Firebase Database Cleanup Guide

## ⚠️ IMPORTANT: Read Before Deleting Data

Yeh guide aapko step-by-step batayega ki kaise:
1. Templates ka backup lein
2. Firebase database clean karein
3. Baad mein templates restore karein

---

## 📋 Step-by-Step Process

### Step 1: Templates Backup Lein

**Command:**
```bash
npm run backup:templates
```

**Yeh kya karega:**
- Sabhi users ke templates fetch karega
- `firebase-backups/` folder mein save karega
- File name: `templates-backup-2025-12-21T18-24-00-000Z.json`
- Total templates count dikhayega

**Output Example:**
```
🔄 Starting templates backup...

📂 Checking user: abc123xyz
   ✅ Found 45 templates

📂 Checking user: def456uvw
   ✅ Found 32 templates

✅ BACKUP SUCCESSFUL!
📁 File: firebase-backups/templates-backup-2025-12-21T18-24-00-000Z.json
📊 Total Users: 2
📋 Total Templates: 77
```

---

### Step 2: Backup File Check Karein

**Command:**
```bash
npm run backup:list
```

**Output:**
```
📁 Available Backups:

1. templates-backup-2025-12-21T18-24-00-000Z.json
   Date: 2025-12-21T18:24:00.000Z
   Templates: 77
   Size: 45.23 KB
```

---

### Step 3: Firebase Console Se Data Delete Karein

**Manual Steps:**

1. **Firebase Console Open Karein:**
   - https://console.firebase.google.com
   - Apna project select karein

2. **Realtime Database Mein Jayein:**
   - Left sidebar → Realtime Database
   - Data tab open karein

3. **Delete Karne Ke Liye Nodes:**

   **✅ DELETE THESE (Old Data):**
   ```
   ├─ patients/          ← DELETE (old patient data)
   ├─ opd/              ← DELETE (old RX data)
   ├─ reports/          ← DELETE (old lab reports)
   ├─ samples/          ← DELETE (old samples)
   ├─ appointments/     ← DELETE (old appointments)
   ├─ doctors/          ← DELETE (old doctor data)
   ├─ externalDoctors/  ← DELETE (old external doctors)
   └─ users/            ← DELETE (old users - will recreate)
   ```

   **❌ KEEP THESE (Important):**
   ```
   ├─ templates/        ← KEEP (we have backup anyway)
   └─ branding/         ← KEEP (lab branding settings)
   ```

4. **Delete Kaise Karein:**
   - Node pe right-click → Delete
   - Ya node select karke Delete button press karein
   - Confirm karein

---

### Step 4: Fresh Start - New User Create Karein

**Ab aap fresh start kar sakte ho:**

1. **Landing Page Pe Jayein:**
   - http://localhost:3000

2. **Google Sign-in Karein:**
   - New owner account banega
   - Fresh UID milega

3. **Setup Complete Karein:**
   - Lab name, address, etc. enter karein
   - Branding setup karein

---

### Step 5: Templates Restore Karein (Jab Bolein)

**Jab aap bolein "templates restore karo", tab:**

**Command:**
```bash
npm run backup:restore firebase-backups/templates-backup-2025-12-21T18-24-00-000Z.json
```

**Yeh kya karega:**
- Backup file read karega
- Sabhi templates restore karega
- New user ID ke under save karega

**Output:**
```
🔄 Starting templates restore...

📁 Backup Date: 2025-12-21T18:24:00.000Z
📊 Total Users: 2
📋 Total Templates: 77

📂 Restoring templates for user: abc123xyz
   ✅ Restored 45 templates

📂 Restoring templates for user: def456uvw
   ✅ Restored 32 templates

✅ RESTORE SUCCESSFUL!
```

---

## 🎯 Complete Cleanup Checklist

### Before Cleanup:
- [ ] Backup templates: `npm run backup:templates`
- [ ] Verify backup: `npm run backup:list`
- [ ] Check backup file exists in `firebase-backups/` folder

### During Cleanup:
- [ ] Delete `patients/` node
- [ ] Delete `opd/` node
- [ ] Delete `reports/` node
- [ ] Delete `samples/` node
- [ ] Delete `appointments/` node
- [ ] Delete `doctors/` node
- [ ] Delete `externalDoctors/` node
- [ ] Delete `users/` node
- [ ] Keep `templates/` (we have backup)
- [ ] Keep `branding/` (important settings)

### After Cleanup:
- [ ] Fresh Google sign-in
- [ ] New owner account created
- [ ] Lab setup completed
- [ ] Restore templates when needed

---

## 📁 Backup File Structure

```json
{
  "backupDate": "2025-12-21T18:24:00.000Z",
  "totalUsers": 2,
  "totalTemplates": 77,
  "templates": {
    "userId1": {
      "templateId1": {
        "testName": "CBC",
        "category": "Hematology",
        "parameters": [...]
      },
      "templateId2": {...}
    },
    "userId2": {...}
  }
}
```

---

## 🔄 Restore Process Details

**Automatic Mapping:**
- Script automatically new user ID ke under restore karega
- Template structure same rahega
- All parameters, ranges, formulas intact rahenge

**Manual Restore (If Needed):**
1. Backup file open karein
2. Templates copy karein
3. Firebase Console mein manually paste karein
4. Path: `templates/{newUserId}/`

---

## ⚠️ Important Notes

1. **Backup Zaroor Lein:**
   - Templates important hain
   - Backup ke bina restore nahi kar sakte

2. **Branding Keep Karein:**
   - Lab name, logo, address
   - Agar delete karoge toh phir se setup karna padega

3. **Users Delete Karne Se:**
   - Authentication nahi delete hoga (Firebase Auth alag hai)
   - Sirf database data delete hoga
   - Fresh sign-in se new user banega

4. **Testing Ke Liye:**
   - Pehle backup lein
   - Phir delete karein
   - Test karein
   - Zaroorat pade toh restore karein

---

## 🚀 Quick Commands Reference

```bash
# Backup templates
npm run backup:templates

# List all backups
npm run backup:list

# Restore from backup
npm run backup:restore firebase-backups/templates-backup-YYYY-MM-DD.json
```

---

## 📞 Support

Agar koi problem aaye toh:
1. Backup file check karein
2. Console logs dekhein
3. Error message share karein

**Ready for fresh start!** 🎊
