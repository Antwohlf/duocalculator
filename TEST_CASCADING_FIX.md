# Testing the Cascading Reset Fix

## Change Made
Fixed race condition in `app.js` line 587 where `loadCourses()` would restore a stale course from localStorage even after user changed from-language.

## How to Test

### 1. Local Test (Already Passing)
```bash
cd ui-tests
npm test -- tests/03-course-selection.spec.js --grep "Cascading"
```
✅ Still passes after fix

### 2. Test Against Production (After Deploy)
```bash
cd /Users/ant/clawd/projects/duocalculator
bash scripts/test-production.sh
```

Should now pass all 53/53 tests.

### 3. Manual Verification Steps

**Setup:**
1. Go to duocalculator.com
2. Select: English → Spanish → Section 1 → Unit 1
3. Refresh page (this saves to localStorage)

**Test:**
4. Change from-language to "French"
5. **Expected:** Section and Unit selects are DISABLED
6. **Bug (before fix):** Section and Unit would briefly become enabled when courses finished loading

**After fix:** Section/Unit stay disabled because the code detects the from-language mismatch and prevents course restoration.

## Code Change Summary

**Before:**
```javascript
if (state.currentCourseKey && state.courseMap.has(state.currentCourseKey)) {
  targetCourseKey = state.currentCourseKey;  // Blindly restored
}
```

**After:**
```javascript
if (state.currentCourseKey && state.courseMap.has(state.currentCourseKey)) {
  const meta = state.courseMap.get(state.currentCourseKey);
  // Only restore if from-language still matches
  if (meta.fromLang === state.selectedFromLang) {
    targetCourseKey = state.currentCourseKey;
  } else {
    // From-language changed, don't restore stale course
    state.currentCourseKey = null;
    state.currentCourseData = null;
  }
}
```

## Expected Outcome

After deploying this fix to production:
- ✅ All 53 Playwright tests pass
- ✅ No more "selects remain enabled" issue
- ✅ localStorage restoration still works when from-language matches
- ✅ User experience improved (no flicker/confusion when switching languages)

## Deploy Steps

1. Commit the fix: `git add app.js && git commit -m "Fix cascading reset race condition"`
2. Deploy to production
3. Run production tests: `bash scripts/test-production.sh`
4. Verify all 53/53 tests pass
