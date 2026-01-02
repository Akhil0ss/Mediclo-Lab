# Deployment & Rollback Guide

## Current Status

### Changes Made in This Session (Dec 24, 2025)

**Files Modified:**
1. `src/contexts/AuthContext.tsx` - Session monitoring & auth flow
2. `src/app/dashboard/layout.tsx` - Logout button fix
3. `src/app/dashboard/settings/page.tsx` - Deleted staff filtering
4. `src/components/Intercom.tsx` - Chat notifications & staff filtering
5. `src/app/print/report/[id]/page.tsx` - PDF generation (from earlier)

**Features Changed:**
- ✅ Session-based login enforcement
- ✅ Logout button for internal auth
- ✅ Deleted staff filtering
- ✅ Chat notifications with red dots
- ✅ Patient-to-receptionist notifications

---

## Deployment Options

### Option 1: Deploy New Version (Recommended)

**Pros:**
- All critical fixes included
- Better security (session management)
- Cleaner UI (no deleted staff)
- Working logout button
- Better chat notifications

**Cons:**
- New code needs testing in production
- Slight risk of unforeseen issues

**How to Deploy:**
```bash
# From e:\Mediclo-1
git add .
git commit -m "Fix: Session management, logout, deleted staff filtering, chat notifications"
git push origin main
```

Vercel will auto-deploy in ~2-3 minutes.

---

### Option 2: Rollback to Previous Deployment

**When to Use:**
- If new version has critical bugs
- If features don't work as expected
- If you need immediate stability

**How to Rollback:**

#### Method 1: Via Vercel Dashboard (EASIEST)
1. Go to https://vercel.com/dashboard
2. Click on your project (Mediclo)
3. Go to "Deployments" tab
4. Find the last working deployment (before today)
5. Click the three dots (•••) → "Promote to Production"
6. Confirm → Instant rollback!

#### Method 2: Via Git
```bash
# See recent commits
git log --oneline -10

# Find the commit hash of last working version
# Example: abc1234

# Revert to that commit
git reset --hard abc1234

# Force push (CAUTION!)
git push origin main --force
```

#### Method 3: Via Vercel CLI
```bash
# Install Vercel CLI (if not installed)
npm i -g vercel

# Login
vercel login

# List deployments
vercel ls

# Rollback to specific deployment
vercel rollback [deployment-url]
```

---

## Testing Checklist Before Deployment

### Critical Tests (Must Pass)

**Authentication:**
- [ ] Login as Owner (Google) works
- [ ] Login as Lab (username) works
- [ ] Login as Doctor (username) works
- [ ] Logout button works for all roles
- [ ] Page refresh doesn't logout

**Settings:**
- [ ] Settings page loads
- [ ] Team tab shows only active staff
- [ ] Deleted doctors are hidden
- [ ] Can enable/disable staff

**Chat:**
- [ ] Chat bubble appears
- [ ] Staff list shows only active members
- [ ] Can send messages
- [ ] Red dots appear for unread
- [ ] Red dots disappear when opened

**Reports:**
- [ ] Can create new report
- [ ] PDF generation works
- [ ] Critical findings appear
- [ ] Visual bars display correctly

### Non-Critical Tests (Nice to Have)

- [ ] Concurrent login logout (different browsers)
- [ ] Patient-to-receptionist chat
- [ ] All dashboard tabs load
- [ ] Analytics display correctly

---

## Deployment Safety Strategy

### Step 1: Create Backup Point
```bash
# Tag current state before deploying
git tag -a v1.0-pre-session-fix -m "Before session management changes"
git push origin v1.0-pre-session-fix
```

### Step 2: Deploy to Production
```bash
git add .
git commit -m "Session management & critical fixes"
git push origin main
```

### Step 3: Monitor for 15 Minutes
- Watch Vercel deployment logs
- Test critical features immediately
- Check browser console for errors
- Monitor user feedback (if any)

### Step 4: Decision Point

**If Everything Works:**
- ✅ Keep new version
- ✅ Celebrate! 🎉
- ✅ Monitor for 24 hours

**If Issues Found:**
- ⚠️ Rollback immediately (Method 1 above)
- 🔍 Debug locally
- 📝 Document issues
- 🔄 Re-deploy when fixed

---

## Quick Rollback Commands

### Emergency Rollback (Copy-Paste Ready)

**Via Git:**
```bash
# 1. Find last good commit
git log --oneline -10

# 2. Copy the commit hash (e.g., abc1234)

# 3. Revert to that commit
git reset --hard abc1234

# 4. Force push
git push origin main --force
```

**Via Vercel Dashboard:**
1. Open: https://vercel.com/dashboard
2. Click: Your Project → Deployments
3. Find: Last working deployment
4. Click: ••• → Promote to Production
5. Done: Rollback complete in 30 seconds!

---

## What Gets Preserved During Rollback

### ✅ Safe (Not Affected by Rollback)
- **Firebase Data**: All patient records, reports, samples
- **User Accounts**: All staff logins remain intact
- **Settings**: Branding, team configuration
- **Uploaded Files**: Logos, images
- **Database**: Everything in Firebase stays

### ⚠️ Reverted (Goes Back to Old Version)
- **Code Logic**: Session management, filtering
- **UI Components**: Chat, Settings UI
- **Features**: New fixes won't be active

---

## Recommendation

### My Suggested Approach:

1. **Test Locally First** (5 minutes)
   - Open http://localhost:3000
   - Test login/logout
   - Test Settings → Team
   - Test Chat

2. **Deploy to Production** (if tests pass)
   - Use git commands above
   - Wait for Vercel deployment

3. **Quick Production Test** (5 minutes)
   - Login as different roles
   - Check Settings Team tab
   - Check Chat staff list
   - Test logout button

4. **Keep or Rollback**
   - If all good → Keep it!
   - If issues → Rollback via Vercel Dashboard

---

## Rollback Time Estimates

| Method | Time to Rollback | Difficulty | Recommended |
|--------|-----------------|------------|-------------|
| Vercel Dashboard | 30 seconds | Easy | ✅ YES |
| Git Reset | 2 minutes | Medium | If dashboard fails |
| Vercel CLI | 1 minute | Medium | For automation |
| Manual Code Revert | 10+ minutes | Hard | Last resort |

---

## Contact Support

If rollback fails or you need help:
- **Vercel Support**: https://vercel.com/support
- **Git Issues**: Check `.git/` folder exists
- **Firebase**: Data is safe, won't be affected

---

## Final Checklist

Before deploying:
- [ ] All changes committed locally
- [ ] Tested on localhost
- [ ] Know how to rollback (Vercel Dashboard)
- [ ] Have backup tag created
- [ ] Ready to monitor after deployment

After deploying:
- [ ] Verify deployment succeeded on Vercel
- [ ] Test critical features immediately
- [ ] Monitor for 15 minutes
- [ ] Document any issues
- [ ] Rollback if needed (easy!)

---

## Summary

**YES, you can easily revert!**

The safest rollback method is via **Vercel Dashboard** → takes only 30 seconds and doesn't require any git commands.

Your data in Firebase is completely safe - rollback only affects the code, not your database.

**Recommended Action:**
1. Deploy new version
2. Test for 15 minutes
3. If issues → Rollback via Vercel Dashboard
4. If good → Keep it!

You have full control and can switch between versions anytime! 🚀
