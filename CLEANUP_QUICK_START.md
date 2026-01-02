# 🔥 Quick Start - Database Cleanup

## Aapko Kya Karna Hai:

### 1️⃣ Templates Backup (ABHI KAREIN)
```bash
npm run backup:templates
```
✅ Yeh command chalane se sabhi templates backup ho jayenge

### 2️⃣ Firebase Console Se Data Delete Karein
- Firebase Console open karein
- Realtime Database mein jayein
- Yeh nodes delete karein:
  - `patients/`
  - `opd/`
  - `reports/`
  - `samples/`
  - `appointments/`
  - `doctors/`
  - `users/`

**KEEP THESE:**
- `templates/` (backup hai)
- `branding/` (important)

### 3️⃣ Fresh Start
- Google se phir se sign-in karein
- New account banega
- Fresh testing shuru karein

### 4️⃣ Templates Restore (Jab Bolein)
```bash
npm run backup:list
# Backup file name copy karein

npm run backup:restore firebase-backups/templates-backup-XXXX.json
```

---

## 📁 Backup Files Location
`firebase-backups/` folder mein save hongi

## 📖 Detailed Guide
`FIREBASE_CLEANUP_GUIDE.md` padhein

---

**Ready!** Pehle backup command chalayein, phir batayein! 🚀
