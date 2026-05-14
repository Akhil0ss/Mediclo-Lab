# Global Toast Notification System

## Overview
The global toast notification system has been implemented to replace blocking `alert()` popups with non-blocking toast notifications.

## Files Created/Modified

### 1. **Toast Context** (`src/contexts/ToastContext.tsx`)
- Provides global toast functionality
- Can be accessed from any component using `useToast()` hook

### 2. **Toast Component** (`src/components/Toast.tsx`)
- Green background with white text
- Single-line layout
- Auto-dismisses after 2 seconds
- Positioned at bottom-center of screen

### 3. **Dashboard Layout** (`src/app/dashboard/layout.tsx`)
- Wrapped with `ToastProvider`
- Templates tab uses toast warning

## Usage

### Basic Usage

```tsx
import { useToast } from '@/contexts/ToastContext';

function MyComponent() {
    const { showToast } = useToast();

    const handleAction = () => {
        // Show success toast
        showToast('Action completed successfully!', 'success');
        
        // Show error toast
        showToast('Something went wrong!', 'error');
        
        // Show warning toast
        showToast('Please be careful!', 'warning');
        
        // Show info toast (default)
        showToast('Here is some information');
    };

    return <button onClick={handleAction}>Click Me</button>;
}
```

### Replacing alert() calls

**Before:**
```tsx
alert('Patient added successfully!');
```

**After:**
```tsx
const { showToast } = useToast();
showToast('Patient added successfully!', 'success');
```

## Toast Types

- `success` - Green background (default for this app)
- `error` - Red background
- `warning` - Yellow background
- `info` - Blue background (currently all use green)

## Current Implementation

✅ **Implemented:**
- Global ToastContext and Provider
- Toast component with green background
- Templates tab double-click warning uses toast
- Bottom-center positioning
- Auto-dismiss after 2 seconds

❌ **Not Yet Implemented:**
- Converting all `alert()` calls to toast (90+ instances)
- Different colors for different toast types (currently all green)

## Next Steps (Optional)

To convert all alerts to toasts:

1. Import `useToast` in each component
2. Replace `alert('message')` with `showToast('message', 'type')`
3. Test each notification

**Estimated effort:** 2-3 hours for all 90+ alert calls

## Example Conversions

### Patients Page
```tsx
// Before
alert('Patient added!');

// After
const { showToast } = useToast();
showToast('Patient added!', 'success');
```

### Settings Page
```tsx
// Before
alert('Branding Apply Successfully!');

// After
const { showToast } = useToast();
showToast('Branding Apply Successfully!', 'success');
```

### Samples Page
```tsx
// Before
alert('Please add patients first');

// After
const { showToast } = useToast();
showToast('Please add patients first', 'warning');
```
