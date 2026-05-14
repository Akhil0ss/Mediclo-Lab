# 🔥 Firebase & App Optimization Guide

To ensure **seamless access during peak times** and **fast data loading**, we have optimized the application code. However, for maximum performance, you **MUST** configure your Firebase Database Rules to support indexing.

## 1. ⚡ Add Indexing Rules
Go to **Firebase Console** > **Realtime Database** > **Rules** and paste the following configuration. This allows the app to query data (e.g., "Today's Patients") without downloading the entire history.

```json
{
  "rules": {
    ".read": true, 
    ".write": true,
    "patients": {
      "$ownerId": {
        ".indexOn": ["createdAt", "mobile", "name"]
      }
    },
    "opd": {
      "$ownerId": {
        ".indexOn": ["visitDate", "createdAt", "patientId", "isFinal"]
      }
    },
    "reports": {
      "$ownerId": {
        ".indexOn": ["createdAt", "patientId"]
      }
    },
    "samples": {
      "$ownerId": {
        ".indexOn": ["createdAt", "status"]
      }
    }
  }
}
```
*(Note: Adjust `.read` / `.write` rules according to your security policy. The `.indexOn` parts are what matters for performance.)*

## 2. 🚀 Code Optimizations Implemented
- **Lazy Loading**: Heavy components (`RxModal`, `QuickReportModal`) and lists (Patient Directory) now load only when needed.
- **Limit-to-Last**: The Dashboard now fetches only the *most recent* data (last 100-200 items) for real-time stats, drastically reducing initial bandwidth usage.
- **Dynamic Imports**: Reduced initial bundle size.

## 3. 📊 Analytics vs Dashboard
- **Dashboard**: Optimized for speed. Shows *Today's* activity and *Recent* trends.
- **Analytics Tab**: Use this for full historical analysis (Revenue, Monthly Stats). It uses optimized one-time fetching.
