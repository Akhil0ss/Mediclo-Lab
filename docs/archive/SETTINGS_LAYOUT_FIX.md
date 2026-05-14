# SETTINGS PAGE LAYOUT IMPROVEMENTS

## Current Issues:
- 946 lines - too long
- Scattered sections
- Too much spacing
- Tabs not well organized

## Quick CSS Fixes (Apply to settings page):

### 1. Compact Card Spacing
Replace: `p-8` with `p-4`
Replace: `mb-8` with `mb-4`
Replace: `gap-8` with `gap-4`

### 2. Reduce Header Sizes
Replace: `text-3xl` with `text-2xl`
Replace: `text-2xl` with `text-xl`

### 3. Compact Table
Replace table padding: `px-6 py-4` with `px-4 py-2`

### 4. Better Tab Organization
Current tabs: General, Team, Billing
Suggested: Lab Info, Staff, Subscription

### 5. Remove Unnecessary Margins
Search for: `mb-6`, `mb-8`, `mt-8`
Replace with: `mb-3`, `mb-4`, `mt-4`

## Sections to Keep:
✅ Lab Branding (Name, Tagline, Address)
✅ User Management (Staff list, Password reset)
✅ Subscription Status
✅ Payment History

## Sections to Remove/Hide:
❌ Verbose descriptions
❌ Extra help text
❌ Duplicate information
❌ Large empty spaces

## Implementation:
Run global find/replace on settings/page.tsx:
1. `className="p-8"` → `className="p-4"`
2. `className="mb-8"` → `className="mb-4"`
3. `className="gap-8"` → `className="gap-4"`
4. `className="text-3xl"` → `className="text-2xl"`
5. `className="px-6 py-4"` → `className="px-4 py-2"`

This will make page 30-40% more compact without changing functionality!
