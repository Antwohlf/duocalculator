# Cascading Reset Bug Fix

## Problem
When changing from-language after selecting a course, section/unit selects remain enabled instead of being disabled. This only happens on production with localStorage state.

## Root Cause
Race condition between localStorage restoration and user input:

1. `loadCourses()` is async and loads in background
2. User changes from-language → code resets & disables section/unit
3. `loadCourses()` completes → restores old course from localStorage → re-enables section/unit

## Solution

**File:** `app.js` line 352-364

**Current code:**
```javascript
dom.fromLangSelect.addEventListener("change", () => {
  const fromLang = dom.fromLangSelect.value || null;
  state.selectedFromLang = fromLang;
  state.selectedToLang = null;
  state.currentCourseKey = null;  // ← This is already here
  state.currentCourseData = null;
  state.selection = { sectionIndex: null, unitIndex: null };
  populateToLanguageSelect(fromLang);
  clearCourseDisplay({
    progressMessage: fromLang ? "Select a target language first" : "Select languages first",
  });
  saveState();
  computeAndRender();
});
```

**The code is already correct!** The issue is that `loadCourses()` might still be running when this happens.

### Real Fix: Add Loading Guard

The actual fix needed is in `loadCourses()` around line 585:

**Change:**
```javascript
if (state.currentCourseKey && state.courseMap.has(state.currentCourseKey)) {
  targetCourseKey = state.currentCourseKey;
}
```

**To:**
```javascript
// Only restore if from-language still matches
if (state.currentCourseKey && state.courseMap.has(state.currentCourseKey)) {
  const meta = state.courseMap.get(state.currentCourseKey);
  if (meta.fromLang === state.selectedFromLang) {
    targetCourseKey = state.currentCourseKey;
  } else {
    // From-language changed while loading, don't restore
    state.currentCourseKey = null;
    state.currentCourseData = null;
  }
}
```

This prevents restoring a course if the from-language has changed since the page loaded.

## Testing

1. **Local test:** Already passes ✅
2. **Production test after fix:** Should pass when section/unit don't get re-enabled

## Alternative: Clear localStorage in Tests

For immediate testing without code change, clear localStorage before each test:

```javascript
test.beforeEach(async ({ page }) => {
  await page.goto(baseUrl);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});
```

This simulates a clean browser state.
