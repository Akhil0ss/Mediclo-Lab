# Report Auto-Calculation Fix Plan

## Issues Found:
1. Auto-calculation only happens on submit, not while filling data
2. Form uses `template.parameters` but templates have `subtests`
3. No real-time threat level (out of range) display
4. No visual feedback for calculated vs manual values

## Solution:
1. Add `useEffect` to calculate formulas in real-time when dependencies change
2. Support both `parameters` and `subtests` fields
3. Show threat level colors while filling
4. Display calculated values with visual indicator

## Implementation:
- Add real-time calculation in `handleResultChange`
- Add `useEffect` to recalculate when results change
- Add color coding for out-of-range values
- Show formula icon for auto-calculated fields
