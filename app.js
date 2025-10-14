const REMOTE_BASE = "https://duolingodata.com/";
const PROXY_ENDPOINT = "/api/proxy?url=";
const STORAGE_KEY = "duocalculator:v1";

const LANGUAGE_NAME_OVERRIDES = {
  af: "Afrikaans",
  am: "Amharic",
  ar: "Arabic",
  az: "Azerbaijani",
  be: "Belarusian",
  bg: "Bulgarian",
  bn: "Bengali",
  bs: "Bosnian",
  ca: "Catalan",
  ceb: "Cebuano",
  co: "Corsican",
  cs: "Czech",
  cy: "Welsh",
  da: "Danish",
  de: "German",
  el: "Greek",
  en: "English",
  eo: "Esperanto",
  es: "Spanish",
  et: "Estonian",
  eu: "Basque",
  fa: "Persian",
  fi: "Finnish",
  fr: "French",
  ga: "Irish",
  gd: "Scottish Gaelic",
  gl: "Galician",
  gu: "Gujarati",
  he: "Hebrew",
  hi: "Hindi",
  hr: "Croatian",
  hu: "Hungarian",
  hy: "Armenian",
  id: "Indonesian",
  ig: "Igbo",
  is: "Icelandic",
  it: "Italian",
  ja: "Japanese",
  ko: "Korean",
  ku: "Kurdish",
  la: "Latin",
  lb: "Luxembourgish",
  lt: "Lithuanian",
  lv: "Latvian",
  mg: "Malagasy",
  mi: "Maori",
  mk: "Macedonian",
  ml: "Malayalam",
  mn: "Mongolian",
  mr: "Marathi",
  ms: "Malay",
  mt: "Maltese",
  my: "Burmese",
  ne: "Nepali",
  nl: "Dutch",
  no: "Norwegian",
  ny: "Chichewa",
  pl: "Polish",
  pt: "Portuguese",
  qu: "Quechua",
  ro: "Romanian",
  ru: "Russian",
  sh: "Serbo-Croatian",
  si: "Sinhala",
  sk: "Slovak",
  sr: "Serbian",
  sv: "Swedish",
  sw: "Swahili",
  ta: "Tamil",
  te: "Telugu",
  th: "Thai",
  tr: "Turkish",
  uk: "Ukrainian",
  ur: "Urdu",
  uz: "Uzbek",
  vi: "Vietnamese",
  xh: "Xhosa",
  zh: "Chinese",
  zhhans: "Chinese (Simplified)",
  zhhant: "Chinese (Traditional)",
  zu: "Zulu",
};

const LANGUAGE_FLAGS = {
  en: "🇺🇸",
  es: "🇪🇸",
  fr: "🇫🇷",
  de: "🇩🇪",
  it: "🇮🇹",
  pt: "🇵🇹",
  ja: "🇯🇵",
  ko: "🇰🇷",
  zh: "🇨🇳",
  zhhans: "🇨🇳",
  zhhant: "🇨🇳",
  ru: "🇷🇺",
  ar: "🇸🇦",
  hi: "🇮🇳",
  nl: "🇳🇱",
  sv: "🇸🇪",
  da: "🇩🇰",
  fi: "🇫🇮",
  no: "🇳🇴",
  pl: "🇵🇱",
  uk: "🇺🇦",
  cs: "🇨🇿",
  he: "🇮🇱",
  id: "🇮🇩",
  vi: "🇻🇳",
  tr: "🇹🇷",
  th: "🇹🇭",
  ro: "🇷🇴",
  hu: "🇭🇺",
  el: "🇬🇷",
  ga: "🇮🇪",
  eo: "🌍",
};

const dom = {
  tabs: document.querySelectorAll(".tab-button"),
  tabPanels: document.querySelectorAll("[data-tab-panel]"),
  form: document.getElementById("shared-form"),
  fromLangSelect: document.getElementById("from-lang-select"),
  toLangSelect: document.getElementById("to-lang-select"),
  swapButton: document.getElementById("swap-languages"),
  sectionSelect: document.getElementById("section-select"),
  unitSelect: document.getElementById("unit-select"),
  minutesPerActivity: document.getElementById("minutes-per-activity"),
  minutesPerDay: document.getElementById("minutes-per-day"),
  targetDays: document.getElementById("target-days"),
  resultHeadline: document.getElementById("result-headline"),
  resultDetail: document.getElementById("result-detail"),
  resultMeta: document.getElementById("result-meta"),
  progressText: document.getElementById("progress-text"),
  progressCounts: document.getElementById("progress-counts"),
  progressFill: document.getElementById("progress-bar-fill"),
  courseMeta: document.getElementById("course-meta"),
  sectionCEFRHint: document.getElementById("section-cefr-hint"),
  statFinishDate: document.getElementById("stat-finish-date"),
  statLessonsLeft: document.getElementById("stat-lessons-left"),
  statMinutesPerDay: document.getElementById("stat-minutes-day"),
  tooltipTriggers: document.querySelectorAll("[data-tooltip-target]"),
  resetButtons: document.querySelectorAll("[data-reset]"),
  toastRegion: document.getElementById("toast-region"),
  debugPanel: document.getElementById("debug-panel"),
  debugOutput: document.getElementById("debug-output"),
};

const state = {
  activeTab: "finish",
  courses: [],
  courseMap: new Map(),
  courseDetailCache: new Map(),
  currentCourseKey: null,
  currentCourseData: null,
  selectedFromLang: null,
  selectedToLang: null,
  selection: {
    sectionIndex: null,
    unitIndex: null,
  },
  minutesPerActivity: 3.5,
  minutesPerDay: 30,
  targetDays: 90,
  debug: false,
};

const debugEnabled = new URLSearchParams(window.location.search).has("debug");
state.debug = debugEnabled;
if (debugEnabled && dom.debugPanel) {
  dom.debugPanel.hidden = false;
}

init();

function init() {
  loadStoredState();
  resetStats();
  setupTabs();
  setupTooltip();
  setupForm();
  setupReset();
  renderStoredInputs();
  loadCourses();
  setActiveTab(state.activeTab);
}

function setupTabs() {
  dom.tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      setActiveTab(tab.dataset.tab);
    });
  });
}

function setActiveTab(tabId) {
  state.activeTab = tabId;
  dom.tabs.forEach((tab) => {
    const isActive = tab.dataset.tab === tabId;
    tab.setAttribute("aria-selected", String(isActive));
  });
  dom.tabPanels.forEach((panel) => {
    panel.hidden = panel.dataset.tabPanel !== tabId;
  });
  saveState();
  computeAndRender();
}

function setupTooltip() {
  if (!dom.tooltipTriggers || !dom.tooltipTriggers.length) return;
  dom.tooltipTriggers.forEach((trigger) => {
    const targetId = trigger.dataset.tooltipTarget;
    const tooltip = targetId ? document.getElementById(targetId) : null;
    if (!tooltip) return;

    const show = () => {
      tooltip.dataset.visible = "true";
    };
    const hide = () => {
      tooltip.dataset.visible = "false";
    };

    trigger.addEventListener("mouseenter", show);
    trigger.addEventListener("mouseleave", hide);
    trigger.addEventListener("focus", show);
    trigger.addEventListener("blur", hide);

    tooltip.addEventListener("mouseenter", show);
    tooltip.addEventListener("mouseleave", hide);
  });
}

function setupForm() {
  dom.form.addEventListener("submit", (event) => {
    event.preventDefault();
    computeAndRender({ force: true });
  });

  dom.fromLangSelect.addEventListener("change", () => {
    const fromLang = dom.fromLangSelect.value || null;
    state.selectedFromLang = fromLang;
    state.selectedToLang = null;
    state.currentCourseKey = null;
    state.currentCourseData = null;
    state.selection = { sectionIndex: null, unitIndex: null };
    populateToLanguageSelect(fromLang);
    clearCourseDisplay({
      progressMessage: fromLang ? "Select a target language first" : "Select languages first",
    });
    saveState();
    computeAndRender();
  });

  dom.toLangSelect.addEventListener("change", async () => {
    const courseKey = dom.toLangSelect.value || null;
    if (!courseKey) {
      clearCourseDisplay({ progressMessage: "Select a target language first" });
      saveState();
      computeAndRender();
      return;
    }
    await handleCourseSelection(courseKey, { restoreProgress: false });
  });

  if (dom.swapButton) {
    dom.swapButton.addEventListener("click", () => {
      if (dom.swapButton.disabled) return;
      const currentCourseKey = dom.toLangSelect.value;
      if (!currentCourseKey || !state.courseMap.has(currentCourseKey)) return;
      const currentCourse = state.courseMap.get(currentCourseKey);
      const reverseKey = findCourseKey(currentCourse.toLang, currentCourse.fromLang, currentCourse.levelShort);
      if (!reverseKey) return;
      const reverseCourse = state.courseMap.get(reverseKey);
      if (!reverseCourse) return;
      state.selectedFromLang = reverseCourse.fromLang;
      state.selectedToLang = reverseCourse.toLang;
      state.currentCourseKey = reverseKey;
      dom.fromLangSelect.value = reverseCourse.fromLang;
      populateToLanguageSelect(reverseCourse.fromLang);
      dom.toLangSelect.value = reverseKey;
      handleCourseSelection(reverseKey, { restoreProgress: false });
    });
  }

  dom.sectionSelect.addEventListener("change", () => {
    const rawValue = dom.sectionSelect.value;
    if (rawValue === "") {
      state.selection.sectionIndex = null;
      state.selection.unitIndex = null;
      populateUnits();
      saveState();
      computeAndRender();
      return;
    }
    const index = Number(rawValue);
    if (Number.isNaN(index)) {
      return;
    }
    state.selection.sectionIndex = index;
    state.selection.unitIndex = null;
    populateUnits({ autoSelect: true });
    saveState();
    computeAndRender();
  });

  dom.unitSelect.addEventListener("change", () => {
    const rawValue = dom.unitSelect.value;
    if (rawValue === "") {
      state.selection.unitIndex = null;
      saveState();
      computeAndRender();
      return;
    }
    const index = Number(rawValue);
    if (Number.isNaN(index)) {
      return;
    }
    state.selection.unitIndex = index;
    saveState();
    computeAndRender();
  });

  dom.minutesPerActivity.addEventListener("input", () => {
    const value = Number(dom.minutesPerActivity.value);
    if (!Number.isFinite(value) || value <= 0) return;
    state.minutesPerActivity = value;
    saveState();
    computeAndRender();
  });

  dom.minutesPerDay.addEventListener("input", () => {
    const value = Number(dom.minutesPerDay.value);
    if (!Number.isFinite(value) || value <= 0) return;
    state.minutesPerDay = value;
    saveState();
    if (state.activeTab === "finish") {
      computeAndRender();
    }
  });

  dom.targetDays.addEventListener("input", () => {
    const value = Number(dom.targetDays.value);
    if (!Number.isFinite(value) || value <= 0) return;
    state.targetDays = value;
    saveState();
    if (state.activeTab === "pace") {
      computeAndRender();
    }
  });
}

function setupReset() {
  if (!dom.resetButtons || dom.resetButtons.length === 0) return;
  dom.resetButtons.forEach((button) => {
    button.addEventListener("click", () => {
      localStorage.removeItem(STORAGE_KEY);
      showToast("Saved selections cleared.");
      window.location.reload();
    });
  });
}

function loadStoredState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (typeof data !== "object" || data === null) return;
    state.activeTab = data.activeTab || state.activeTab;
    state.currentCourseKey = data.currentCourseKey || null;
    state.selectedFromLang = data.selectedFromLang || null;
    state.selectedToLang = data.selectedToLang || null;
    state.minutesPerActivity =
      typeof data.minutesPerActivity === "number" ? data.minutesPerActivity : state.minutesPerActivity;
    state.minutesPerDay =
      typeof data.minutesPerDay === "number" ? data.minutesPerDay : state.minutesPerDay;
    state.targetDays =
      typeof data.targetDays === "number" ? data.targetDays : state.targetDays;
    const selection = data.selection || {};
    state.selection = {
      sectionIndex:
        typeof selection.sectionIndex === "number" ? selection.sectionIndex : null,
      unitIndex: typeof selection.unitIndex === "number" ? selection.unitIndex : null,
    };
  } catch (error) {
    console.warn("Failed to load stored state", error);
  }
}

function saveState() {
  try {
    const payload = {
      activeTab: state.activeTab,
      currentCourseKey: state.currentCourseKey,
      selectedFromLang: state.selectedFromLang,
      selectedToLang: state.selectedToLang,
      minutesPerActivity: state.minutesPerActivity,
      minutesPerDay: state.minutesPerDay,
      targetDays: state.targetDays,
      selection: state.selection,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn("Failed to save state", error);
  }
}

function renderStoredInputs() {
  dom.minutesPerActivity.value = state.minutesPerActivity;
  dom.minutesPerDay.value = state.minutesPerDay;
  dom.targetDays.value = state.targetDays;
}

function clearCourseDisplay({ progressMessage } = {}) {
  renderCourseMeta(null);
  const message =
    progressMessage ||
    (state.selectedFromLang ? "Select a target language first" : "Select languages first");
  resetProgressControls(message);
  updateSectionHint();
  resetStats();
  updateSwapButton();
}

function resetProgressControls(message) {
  dom.sectionSelect.disabled = true;
  dom.sectionSelect.innerHTML = `<option value="">${message}</option>`;
  dom.unitSelect.disabled = true;
  dom.unitSelect.innerHTML = `<option value="">Select a section first</option>`;
  state.selection = { sectionIndex: null, unitIndex: null };
}

async function loadCourses() {
  dom.fromLangSelect.disabled = true;
  dom.toLangSelect.disabled = true;
  dom.fromLangSelect.innerHTML = `<option value="">Loading languages…</option>`;
  dom.toLangSelect.innerHTML = `<option value="">Loading…</option>`;
  try {
    const { body } = await fetchViaProxy("/");
    const courses = parseCourseList(body);
    if (!courses.length) {
      throw new Error("No courses found on DuolingoData.com.");
    }
    state.courses = courses;
    state.courseMap = new Map(courses.map((course) => [course.key, course]));

    populateFromLanguageSelect();
    dom.fromLangSelect.disabled = false;

    if (state.selectedFromLang) {
      populateToLanguageSelect(state.selectedFromLang);
      dom.fromLangSelect.value = state.selectedFromLang;
      dom.toLangSelect.disabled = false;

      let targetCourseKey = null;
      if (state.currentCourseKey && state.courseMap.has(state.currentCourseKey)) {
        targetCourseKey = state.currentCourseKey;
      } else if (state.selectedToLang) {
        const match = courses.find(
          (course) =>
            course.fromLang === state.selectedFromLang &&
            course.toLang === state.selectedToLang,
        );
        targetCourseKey = match?.key || null;
      }

      if (targetCourseKey) {
        dom.toLangSelect.value = targetCourseKey;
        await handleCourseSelection(targetCourseKey, { restoreProgress: true });
        return;
      }
    }

    populateToLanguageSelect(null);
    clearCourseDisplay();
    updateSwapButton();
  } catch (error) {
    console.error(error);
    dom.fromLangSelect.innerHTML = `<option value="">Unable to load languages</option>`;
    dom.toLangSelect.innerHTML = `<option value="">Unavailable</option>`;
    showToast("Course list failed to load. Check your connection and refresh.");
  }
}

async function handleCourseSelection(courseKey, { restoreProgress = false } = {}) {
  if (!courseKey || !state.courseMap.has(courseKey)) {
    clearCourseDisplay();
    saveState();
    updateSwapButton();
    return;
  }
  const meta = state.courseMap.get(courseKey);
  state.currentCourseKey = courseKey;
  state.selectedFromLang = meta.fromLang;
  state.selectedToLang = meta.toLang;
  if (!restoreProgress) {
    state.selection = { sectionIndex: null, unitIndex: null };
  }
  await ensureCourseDetail(courseKey);
  const autoSelect = !restoreProgress;
  const sectionsReady = populateSections({ autoSelect });
  if (sectionsReady) {
    populateUnits({ autoSelect });
  }
  saveState();
  computeAndRender();
  updateSwapButton();
}

async function ensureCourseDetail(courseKey) {
  if (!state.courseMap.has(courseKey)) return;
  if (state.courseDetailCache.has(courseKey)) {
    state.currentCourseData = state.courseDetailCache.get(courseKey);
    renderCourseMeta(state.currentCourseData);
    refreshLevelLabel(courseKey, state.currentCourseData.meta);
    return;
  }
  const meta = state.courseMap.get(courseKey);
  try {
    const { body } = await fetchViaProxy(meta.detailHref);
    const detail = parseCourseDetail(body, meta);
    state.courseDetailCache.set(courseKey, detail);
    state.currentCourseData = detail;
    renderCourseMeta(detail);
    refreshLevelLabel(courseKey, detail.meta);
    if (state.debug) {
      renderDebug(detail);
    }
  } catch (error) {
    console.error(error);
    showToast(`Unable to load course detail for ${meta.fromLang} → ${meta.toLang}.`);
  }
}

function refreshLevelLabel(courseKey, meta) {
  if (!meta) return;
  const course = state.courseMap.get(courseKey);
  if (!course) return;
  let changed = false;
  if (meta.level && course.level !== meta.level) {
    course.level = meta.level;
    changed = true;
  }
  if (meta.levelShort && course.levelShort !== meta.levelShort) {
    course.levelShort = meta.levelShort;
    changed = true;
  }
  if (changed && course.fromLang === state.selectedFromLang) {
    const previous = dom.toLangSelect.value;
    populateToLanguageSelect(state.selectedFromLang);
    if (previous) {
      dom.toLangSelect.value = previous;
    }
  }
}

function populateFromLanguageSelect() {
  const languageMeta = new Map();
  state.courses.forEach((course) => {
    if (!languageMeta.has(course.fromLang)) {
      languageMeta.set(course.fromLang, {
        code: course.fromCode,
        flag: getLanguageFlag(course.fromCode, course.fromLang),
      });
    }
  });

  const languages = Array.from(languageMeta.keys()).sort((a, b) => a.localeCompare(b));
  const options = [`<option value="">Select base language</option>`];
  languages.forEach((lang) => {
    const meta = languageMeta.get(lang) || { flag: "🌐" };
    options.push(`<option value="${lang}">${meta.flag} ${lang}</option>`);
  });
  dom.fromLangSelect.innerHTML = options.join("");
  if (state.selectedFromLang && !languages.includes(state.selectedFromLang)) {
    state.selectedFromLang = null;
  }
  if (state.selectedFromLang) {
    dom.fromLangSelect.value = state.selectedFromLang;
  } else {
    dom.fromLangSelect.selectedIndex = 0;
  }
  updateSwapButton();
}

function populateToLanguageSelect(fromLang) {
  if (!fromLang) {
    dom.toLangSelect.disabled = true;
    dom.toLangSelect.innerHTML = `<option value="">Select a base language first</option>`;
    return;
  }
  const targets = state.courses
    .filter((course) => course.fromLang === fromLang)
    .filter((course) => {
      if (typeof course.unitsCount === "number") {
        return course.unitsCount > 0;
      }
      return true;
    })
    .sort((a, b) => a.toLang.localeCompare(b.toLang));
  const duplicateCounts = targets.reduce((map, course) => {
    const key = course.toLang.toLowerCase();
    map.set(key, (map.get(key) || 0) + 1);
    return map;
  }, new Map());
  const options = [`<option value="">Select target language</option>`];
  targets.forEach((course) => {
    const count = duplicateCounts.get(course.toLang.toLowerCase()) || 0;
    const flag = getLanguageFlag(course.toCode, course.toLang);
    const descriptors = [];
    if (count > 1) {
      if (course.levelShort) {
        descriptors.push(course.levelShort);
      }
      if (!descriptors.length && course.unitsCount) {
        descriptors.push(`${course.unitsCount} units`);
      }
      if (!descriptors.length && course.updated) {
        descriptors.push(course.updated);
      }
    }
    const descriptorText = descriptors.length ? ` • ${descriptors.join(" · ")}` : "";
    options.push(`<option value="${course.key}">${flag} ${course.toLang}${descriptorText}</option>`);
  });
  dom.toLangSelect.innerHTML = options.join("");
  dom.toLangSelect.disabled = false;

  let resolvedKey = null;
  if (state.currentCourseKey && state.courseMap.has(state.currentCourseKey)) {
    const currentMeta = state.courseMap.get(state.currentCourseKey);
    if (currentMeta.fromLang === fromLang) {
      resolvedKey = state.currentCourseKey;
    }
  }
  if (!resolvedKey && state.selectedToLang) {
    const match = targets.find((course) => course.toLang === state.selectedToLang);
    if (match) {
      resolvedKey = match.key;
    } else {
      state.selectedToLang = null;
    }
  }
  if (resolvedKey) {
    dom.toLangSelect.value = resolvedKey;
  } else {
    dom.toLangSelect.selectedIndex = 0;
  }
  updateSwapButton();
}

function findCourseKey(fromLang, toLang, levelShort) {
  if (!fromLang || !toLang) return null;
  const matches = state.courses.filter(
    (course) => course.fromLang === fromLang && course.toLang === toLang,
  );
  if (!matches.length) return null;
  if (matches.length === 1) return matches[0].key;
  if (levelShort) {
    const exact = matches.find((course) => (course.levelShort || "").toUpperCase() === levelShort.toUpperCase());
    if (exact) return exact.key;
  }
  return matches[0].key;
}

function updateSwapButton() {
  if (!dom.swapButton) return;
  const fromLang = dom.fromLangSelect.value;
  const toValue = dom.toLangSelect.value;
  if (!fromLang || !toValue || !state.courseMap.has(toValue)) {
    dom.swapButton.disabled = true;
    return;
  }
  const currentCourse = state.courseMap.get(toValue);
  if (!currentCourse) {
    dom.swapButton.disabled = true;
    return;
  }
  const reverseKey = findCourseKey(currentCourse.toLang, currentCourse.fromLang, currentCourse.levelShort);
  dom.swapButton.disabled = !reverseKey;
}

function populateSections({ autoSelect = false } = {}) {
  const course = state.currentCourseData;
  if (!course || !Array.isArray(course.sections) || course.sections.length === 0) {
    dom.sectionSelect.disabled = true;
    dom.sectionSelect.innerHTML = `<option value="">Sections unavailable</option>`;
    dom.unitSelect.disabled = true;
    dom.unitSelect.innerHTML = `<option value="">Units unavailable</option>`;
    return false;
  }

  const options = course.sections
    .map((section, index) => {
      const descriptor = section.units.length ? ` (${section.units.length} units)` : "";
      const titleText = section.title ? `: ${section.title}` : "";
      return `<option value="${index}">Section ${section.sectionIndex}${titleText}${descriptor}</option>`;
    })
    .join("");

  dom.sectionSelect.innerHTML = options;
  dom.sectionSelect.disabled = false;

  if (
    autoSelect ||
    state.selection.sectionIndex === null ||
    state.selection.sectionIndex >= course.sections.length
  ) {
    state.selection.sectionIndex = 0;
  }

  dom.sectionSelect.value = String(state.selection.sectionIndex);
  updateSectionHint();
  return true;
}

function populateUnits({ autoSelect = false } = {}) {
  const { sectionIndex } = state.selection;
  const course = state.currentCourseData;
  if (
    sectionIndex === null ||
    !course ||
    !Array.isArray(course.sections) ||
    !course.sections[sectionIndex]
  ) {
    dom.unitSelect.disabled = true;
    dom.unitSelect.innerHTML = `<option value="">Units unavailable</option>`;
    return false;
  }

  const section = course.sections[sectionIndex];
  if (!Array.isArray(section.units) || section.units.length === 0) {
    dom.unitSelect.disabled = true;
    dom.unitSelect.innerHTML = `<option value="">No units listed</option>`;
    return false;
  }

  const options = section.units
    .map((unit, index) => {
      const status =
        typeof unit.activities === "number" ? `${unit.activities} lessons` : "lessons estimated";
      return `<option value="${index}">Unit ${unit.unitIndex}: ${unit.title} (${status})</option>`;
    })
    .join("");

  dom.unitSelect.innerHTML = options;
  dom.unitSelect.disabled = false;

  if (
    autoSelect ||
    state.selection.unitIndex === null ||
    state.selection.unitIndex >= section.units.length
  ) {
    state.selection.unitIndex = 0;
  }

  dom.unitSelect.value = String(state.selection.unitIndex);
  updateSectionHint();
  updateSwapButton();
  return true;
}

function updateSectionHint() {
  if (!dom.sectionCEFRHint) return;
  const course = state.currentCourseData;
  const { sectionIndex } = state.selection;
  if (!course || sectionIndex === null || !course.sections[sectionIndex]) {
    dom.sectionCEFRHint.textContent = "";
    return;
  }
  const section = course.sections[sectionIndex];
  const details = [];
  dom.sectionCEFRHint.textContent = details.join(" • ") || "";
}

function resetStats() {
  if (dom.statFinishDate) {
    dom.statFinishDate.textContent = "—";
  }
  if (dom.statLessonsLeft) {
    dom.statLessonsLeft.textContent = "—";
  }
  if (dom.statMinutesPerDay) {
    dom.statMinutesPerDay.textContent = "—";
  }
}

function renderCourseMeta(detail) {
  if (!detail) {
    dom.courseMeta.innerHTML = "";
    resetStats();
    return;
  }
  const { meta, totals } = detail;
  const metaLines = [];
  if (meta.updated) {
    metaLines.push(`Updated: ${meta.updated}`);
  }
  metaLines.push(`Total sections: ${detail.sections.length}`);
  metaLines.push(`Total units: ${totals.units}`);
  if (typeof totals.activities === "number") {
    metaLines.push(`Total lessons: ${totals.activities}`);
  }
  if (meta.level) {
    metaLines.push(`CEFR: ${meta.level}`);
  }
  metaLines.push(
    `<a href="${meta.detailHref}" target="_blank" rel="noopener">Open course detail</a>`,
  );
  dom.courseMeta.innerHTML = metaLines.map((line) => `<span>${line}</span>`).join("");
}

function computeAndRender({ force = false } = {}) {
  const course = state.currentCourseData;
  if (!course) {
    dom.resultHeadline.textContent = "Pick languages to load a course.";
    dom.resultDetail.textContent = "";
    dom.resultMeta.textContent = "";
    updateProgressSummary(0, 0);
    resetStats();
    updateSwapButton();
    return;
  }

  const { sectionIndex, unitIndex } = state.selection;
  if (sectionIndex === null) {
    dom.resultHeadline.textContent = "Select your current section.";
    dom.resultDetail.textContent = "";
    dom.resultMeta.textContent = "";
    updateProgressSummary(0, course.totals.activities);
    resetStats();
    return;
  }
  if (unitIndex === null) {
    dom.resultHeadline.textContent = "Select your current unit.";
    dom.resultDetail.textContent = "";
    dom.resultMeta.textContent = "";
    updateProgressSummary(0, course.totals.activities);
    resetStats();
    return;
  }

  const section = course.sections[sectionIndex];
  const unit = section.units[unitIndex];
  if (!unit) {
    dom.resultHeadline.textContent = "Unit data missing.";
    dom.resultDetail.textContent = "Choose a different unit or refresh the course.";
    dom.resultMeta.textContent = "";
    updateProgressSummary(0, course.totals.activities);
    resetStats();
    return;
  }
  const lessonsInUnit = Math.max(0, unit.activities || 0);
  if (!lessonsInUnit) {
    dom.resultHeadline.textContent = "Lesson data unavailable.";
    dom.resultDetail.textContent = "Refresh the course or pick a different unit to continue.";
    dom.resultMeta.textContent = "";
    updateProgressSummary(0, course.totals.activities);
    resetStats();
    return;
  }

  const { totalLessons, lessonsCompleted } = computeLessonProgress(
    course,
    sectionIndex,
    unitIndex,
  );
  updateProgressSummary(lessonsCompleted, totalLessons);

  const result =
    state.activeTab === "finish"
      ? computeFinish(totalLessons, lessonsCompleted)
      : computePace(totalLessons, lessonsCompleted);

  if (!result) {
    resetStats();
    return;
  }
  renderResult(result, { totalLessons, lessonsCompleted });

  if (force && state.debug) {
    renderDebug(course);
  }
}

function computeLessonProgress(course, sectionIndex, unitIndex) {
  let totalLessons = 0;
  let lessonsCompleted = 0;
  course.sections.forEach((section, sIdx) => {
    section.units.forEach((unit, uIdx) => {
      const count = Math.max(0, unit.activities || 0);
      totalLessons += count;
      if (sIdx < sectionIndex || (sIdx === sectionIndex && uIdx < unitIndex)) {
        lessonsCompleted += count;
      }
    });
  });
  return { totalLessons, lessonsCompleted };
}

function computeFinish(totalLessons, lessonsCompleted) {
  const lessonsLeft = Math.max(totalLessons - lessonsCompleted, 0);
  if (lessonsLeft <= 0) {
    dom.resultHeadline.textContent = "🎉 You have finished this course!";
    dom.resultDetail.textContent = "";
    dom.resultMeta.textContent = "";
    return null;
  }
  const minutesPerLesson = Math.max(state.minutesPerActivity, 0.1);
  const minutesPerDay = Math.max(state.minutesPerDay, 1);
  const minutesLeft = lessonsLeft * minutesPerLesson;
  const days = Math.ceil(minutesLeft / minutesPerDay);
  const finishDate = new Date();
  finishDate.setDate(finishDate.getDate() + days);
  return {
    headline: `You will finish in about ${days} ${days === 1 ? "day" : "days"}.`,
    detail: `That’s ${formatNumber(minutesLeft)} minutes of practice left (${lessonsLeft} lessons).`,
    finishDate,
    lessonsLeft,
    minutesPerDay,
    minutesPerLesson,
    mode: "finish",
  };
}

function computePace(totalLessons, lessonsCompleted) {
  const lessonsLeft = Math.max(totalLessons - lessonsCompleted, 0);
  if (lessonsLeft <= 0) {
    dom.resultHeadline.textContent = "🎉 You have finished this course!";
    dom.resultDetail.textContent = "Try a new course or adjust your inputs.";
    dom.resultMeta.textContent = "";
    return null;
  }
  const minutesPerLesson = Math.max(state.minutesPerActivity, 0.1);
  const daysTarget = Math.max(state.targetDays, 1);
  const minutesPerDay = Math.ceil((lessonsLeft * minutesPerLesson) / daysTarget);
  const lessonsPerDay = Math.ceil(lessonsLeft / daysTarget);
  const finishDate = new Date();
  finishDate.setDate(finishDate.getDate() + daysTarget);
  return {
    headline: `Spend about ${minutesPerDay} minutes per day.`,
    detail: `That’s roughly ${lessonsPerDay} ${lessonsPerDay === 1 ? "lesson" : "lessons"} each day to finish in ${daysTarget} days.`,
    finishDate,
    lessonsLeft,
    minutesPerDay,
    minutesPerLesson,
    targetDays: daysTarget,
    mode: "pace",
  };
}

function renderResult(result, { totalLessons, lessonsCompleted }) {
  dom.resultHeadline.textContent = result.headline;
  dom.resultDetail.textContent = result.detail;
  dom.resultMeta.textContent = result.meta;
  updateStats(result, totalLessons, lessonsCompleted);
}

function updateStats(result, totalLessons, lessonsCompleted) {
  if (!result) {
    resetStats();
    return;
  }
  const lessonsLeftRaw = result.lessonsLeft != null ? result.lessonsLeft : Math.max(totalLessons - lessonsCompleted, 0);
  const lessonsLeft = Number.isFinite(lessonsLeftRaw) && lessonsLeftRaw >= 0 ? lessonsLeftRaw : 0;

  if (dom.statFinishDate) {
    if (result.finishDate instanceof Date && !Number.isNaN(result.finishDate.getTime())) {
      dom.statFinishDate.textContent = formatDate(result.finishDate);
    } else {
      dom.statFinishDate.textContent = "—";
    }
  }
  if (dom.statLessonsLeft) {
    dom.statLessonsLeft.textContent = lessonsLeft ? formatNumber(lessonsLeft) : "0";
  }
  if (dom.statMinutesPerDay) {
    let minutesValue = result.minutesPerDay;
    if (typeof minutesValue !== "number" || Number.isNaN(minutesValue)) {
      minutesValue = state.minutesPerDay;
    }
    dom.statMinutesPerDay.textContent = `${formatNumber(minutesValue)} min`;
  }
}

function updateProgressSummary(done, total) {
  if (!total || total <= 0) {
    dom.progressText.textContent = "Progress: 0%";
    dom.progressCounts.textContent = "0 of 0 lessons completed";
    dom.progressFill.style.width = "0%";
    return;
  }
  const percent = Math.min(100, Math.round((done / total) * 100));
  dom.progressText.textContent = `Progress: ${percent}%`;
  dom.progressCounts.textContent = `${done} of ${total} lessons completed`;
  dom.progressFill.style.width = `${percent}%`;
}

function renderDebug(detail) {
  if (!dom.debugOutput) return;
  const samplePatterns = detail.sections
    .flatMap((section) => section.units.map((unit) => unit.activityPattern))
    .filter((pattern) => pattern && pattern.length)
    .slice(0, 3);
  const payload = {
    course: detail.meta.title,
    sectionCount: detail.sections.length,
    fallbackLessons: detail.meta.fallbackLessons,
    totals: detail.totals,
    samplePatterns,
  };
  dom.debugOutput.textContent = JSON.stringify(payload, null, 2);
}

async function fetchViaProxy(target) {
  const url = `${PROXY_ENDPOINT}${encodeURIComponent(target)}`;
  let response;
  try {
    response = await fetch(url, { headers: { Accept: "application/json" } });
  } catch (networkError) {
    throw new Error("Unable to reach proxy service.");
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch (parseError) {
    // continue below
  }

  if (!response.ok) {
    const message = payload?.error || `Proxy request failed (${response.status})`;
    throw new Error(message);
  }

  if (!payload || typeof payload.body !== "string") {
    throw new Error("Proxy response missing body content.");
  }

  return payload;
}

function parseCourseList(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const tables = Array.from(doc.querySelectorAll("table"));
  let table = tables.find((tbl) => {
    const headerText = tbl.querySelector("thead")?.textContent ?? "";
    return /course/i.test(headerText) && /units/i.test(headerText);
  });
  if (!table && tables.length) {
    table = tables[0];
  }
  if (!table) return [];

  const headerCells = Array.from(table.querySelectorAll("thead th")).map((th) =>
    th.textContent.trim().toLowerCase(),
  );
  const findIndex = (matchers) => {
    const list = Array.isArray(matchers) ? matchers : [matchers];
    return headerCells.findIndex((text) => list.some((matcher) => matcher.test(text)));
  };

  const courseIndex = findIndex([/course/, /name/]);
  const fromIndex = findIndex([/^from/, /base/, /speaker/]);
  const toIndex = findIndex([/^to/, /learn/, /target/]);
  const levelIndex = findIndex([/cefr/, /level/]);
  const unitsIndex = findIndex([/unit/]);
  const lessonsIndex = findIndex([/lesson/]);
  const updatedIndex = findIndex([/updated/, /refresh/]);

  const rows = Array.from(table.querySelectorAll("tbody tr")).filter(
    (row) => row.querySelectorAll("td").length >= Math.max(3, headerCells.length || 0),
  );

  return rows
    .map((row) => {
      const cells = Array.from(row.querySelectorAll("td"));
      const getCell = (index, fallback) =>
        index != null && index >= 0 && cells[index]
          ? cells[index]
          : fallback != null && fallback >= 0
          ? cells[fallback]
          : null;

      const courseCell = getCell(courseIndex, 0);
      const fromCell = getCell(fromIndex, 1);
      const toCell = getCell(toIndex, courseIndex >= 0 ? courseIndex : 0);

      const normalizeText = (cell) => cell?.textContent?.replace(/\s+/g, " ").trim() ?? "";
      const courseName = normalizeText(courseCell);
      const fromLangRaw = normalizeText(fromCell);
      const toLangRaw = normalizeText(toCell);

      const detailHref =
        courseCell?.querySelector('a[href*=".html"]')?.getAttribute("href") ??
        toCell?.querySelector('a[href*=".html"]')?.getAttribute("href") ??
        "";
      const absoluteHref = detailHref ? new URL(detailHref, REMOTE_BASE).href : null;

      const codes = absoluteHref ? extractLanguageCodes(absoluteHref) : { to: null, from: null };

      const toLang =
        languageCodeToName(codes.to) ||
        humanizeLanguageLabel(toLangRaw) ||
        humanizeLanguageLabel(courseName);
      const fromLang =
        languageCodeToName(codes.from) ||
        humanizeLanguageLabel(fromLangRaw) ||
        humanizeLanguageLabel(courseName.split("→")[0] || "");

      const numberFromCell = (cell) =>
        cell ? parseInt(cell.textContent.replace(/[^0-9]/g, ""), 10) || null : null;

      let levelRaw = normalizeText(getCell(levelIndex, -1));
      let levelShort = normalizeLevel(levelRaw);
      if (!levelShort) {
        const levelFromTitle = /CEFR\s*([A-C][0-3](?:\+|-)?)/i.exec(courseName);
        if (levelFromTitle) {
          levelShort = levelFromTitle[1].toUpperCase();
          levelRaw = `CEFR ${levelShort}`;
        }
      }
      const unitsCount = numberFromCell(getCell(unitsIndex, -1));
      const lessonsCount = numberFromCell(getCell(lessonsIndex, -1));
      const updated = normalizeText(getCell(updatedIndex, -1));

      if (!absoluteHref) return null;

      const key = `${absoluteHref}`;
      return {
        key,
        title: `${fromLang} → ${toLang}`,
        fromLang,
        toLang,
        fromCode: normalizeLanguageCode(codes.from),
        toCode: normalizeLanguageCode(codes.to),
        level: levelRaw || null,
        levelShort: levelShort || null,
        unitsCount,
        lessonsCount,
        updated,
        detailHref: absoluteHref,
      };
    })
    .filter(Boolean);
}

function extractLanguageCodes(detailHref) {
  try {
    const url = new URL(detailHref);
    const fileName = url.pathname.split("/").pop() || "";
    const base = fileName.replace(/\.[^.]+$/, "").toLowerCase();
    const match = base.match(/^([a-z]{2,5})f([a-z]{2,5})/);
    if (match) {
      return { to: match[1], from: match[2] };
    }
  } catch (error) {
    // ignore invalid urls
  }
  return { to: null, from: null };
}

function normalizeLanguageCode(code) {
  if (!code) return null;
  const cleaned = code.toLowerCase().replace(/[^a-z]/g, "");
  return cleaned || null;
}

function languageCodeToName(code) {
  const normalized = normalizeLanguageCode(code);
  if (!normalized) return null;
  if (LANGUAGE_NAME_OVERRIDES[normalized]) {
    return LANGUAGE_NAME_OVERRIDES[normalized];
  }
  if (normalized.length === 2 || normalized.length === 3) {
    return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
  }
  return null;
}

function humanizeLanguageLabel(raw) {
  if (!raw) return "";
  const trimmed = raw.replace(/\([^)]*\)/g, " ").replace(/for.+$/i, " ").replace(/from.+$/i, " ").trim();
  if (!trimmed) return "";
  const token = trimmed.toLowerCase();
  const override = languageCodeToName(token);
  if (override) return override;
  return trimmed
    .split(/[\s/_-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function normalizeLevel(level) {
  if (!level) return "";
  const match = level.match(/([A-C][0-3](?:\+|-)?)/i);
  if (match) {
    return match[1].toUpperCase();
  }
  const cleaned = level
    .replace(/CEFR\s*/i, "")
    .replace(/nivel\s*/i, "")
    .replace(/niveau\s*/i, "")
    .replace(/livello\s*/i, "")
    .replace(/nivel\s*/i, "")
    .replace(/nivå\s*/i, "")
    .replace(/ระดับ\s*/i, "")
    .trim();
  return cleaned.toUpperCase();
}

function codeToFlag(code) {
  if (!code || code.length < 2) return null;
  const alpha2 = code.slice(0, 2).toUpperCase();
  const first = alpha2.codePointAt(0);
  const second = alpha2.codePointAt(1);
  if (!first || !second) return null;
  return String.fromCodePoint(first + 127397, second + 127397);
}

function getLanguageFlag(code, name) {
  const normalized = normalizeLanguageCode(code);
  if (normalized && LANGUAGE_FLAGS[normalized]) {
    return LANGUAGE_FLAGS[normalized];
  }
  const derived = normalized ? codeToFlag(normalized) : null;
  if (derived) return derived;
  return name && name.toLowerCase().includes("english") ? "🇺🇸" : "🌐";
}

function parseCourseDetail(text, meta) {
  const clean = text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr)>/gi, "\n")
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/\u3164/g, " ");
  const plain = clean.replace(/<[^>]+>/g, "");
  const lines = plain.split("\n");
  const sections = [];
  let currentSection = null;
  let currentUnit = null;
  const unitRegex = /^\s*(\d+)\s+(\d+)\s+(.+)$/;
  const unitsWordPattern =
    "units?|unidades?|unidade?s?|unités?|unità|einheiten|lektion(?:en)?|lessons?|leçons?|lektioner|разделы|юнитов|уроков?|занятий|ders|درس|课程|課|レッスン|単元|단원|레슨";
  const sectionParenRegex = /^([^\d]{2,})\s*(\d+)\s*\((\d+)\s+[^)]*\)\s*(.*)$/u;
  const sectionAltRegex = new RegExp(
    `^([^\\d]{2,})\\s*(\\d+)\\s+[^\\d]*?(\\d+)\\s+(?:${unitsWordPattern})\\s*(.*)$`,
    "iu",
  );
  const numberLineRegex = /(\d+)/g;

  lines.forEach((rawLine) => {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();
    if (!trimmed) return;

    const normalized = trimmed.replace(/^[\-–—•*•]+\s*/, "");
    let sectionMatch = normalized.match(sectionParenRegex);
    if (!sectionMatch) {
      sectionMatch = normalized.match(sectionAltRegex);
    }
    if (sectionMatch) {
      const [, headingRaw, sectionNumber, unitCount, rest] = sectionMatch;
      const headingClean = headingRaw.trim().replace(/[:\s]+$/, "");
      const sectionTitleCandidate = rest.trim().replace(/^[\s:–-]+/, "");
      const originalTitle = sectionTitleCandidate || headingClean;
      const levelInTitle = normalizeLevel(originalTitle);
      const displayTitle = originalTitle
        .replace(/CEFR\s*[A-C][0-3](?:\+|-)?/gi, "")
        .replace(/\s{2,}/g, " ")
        .trim() || originalTitle;
      currentSection = {
        sectionIndex: Number(sectionNumber),
        unitCount: Number(unitCount),
        title: displayTitle,
        rawTitle: originalTitle,
        cefr: levelInTitle || "",
        units: [],
      };
      sections.push(currentSection);
      currentUnit = null;
      if (levelInTitle && !meta.levelShort) {
        meta.levelShort = levelInTitle;
        meta.level = `CEFR ${levelInTitle}`;
      }
      return;
    }

    const unitMatch = normalized.match(unitRegex);
    if (unitMatch && currentSection) {
      const [, sectionNumber, unitNumber, title] = unitMatch;
      if (Number(sectionNumber) !== currentSection.sectionIndex) {
        return;
      }
      currentUnit = {
        sectionIndex: Number(sectionNumber),
        unitIndex: Number(unitNumber),
        title: title.trim(),
        activityPattern: [],
        activities: null,
      };
      currentSection.units.push(currentUnit);
      return;
    }

    if (currentUnit && /[0-9]/.test(trimmed) && trimmed.includes(",")) {
      const numbers = [...trimmed.matchAll(numberLineRegex)].map((match) => Number(match[1]));
      if (numbers.length) {
        currentUnit.activityPattern = numbers;
        currentUnit.activities = numbers.reduce((sum, value) => sum + value, 0);
      }
    }
  });

  const filteredSections = sections.filter((section) => section.units.length > 0);

  let totals = filteredSections.reduce(
    (acc, section) => {
      section.units.forEach((unit) => {
        if (typeof unit.activities === "number") {
          acc.activities += unit.activities;
        }
        acc.units += 1;
      });
      return acc;
    },
    { activities: 0, units: 0 },
  );

  const metaAverage =
    typeof meta.lessonsCount === "number" && typeof meta.unitsCount === "number" && meta.unitsCount > 0
      ? Math.max(1, Math.round(meta.lessonsCount / meta.unitsCount))
      : null;
  const computedAverage =
    totals.units > 0 && totals.activities > 0
      ? Math.max(1, Math.round(totals.activities / totals.units))
      : null;
  const fallbackLessons = metaAverage || computedAverage || 10;

  let hadMissing = false;
  filteredSections.forEach((section) => {
    section.units.forEach((unit) => {
      if (!unit.activities || unit.activities <= 0) {
        unit.activities = fallbackLessons;
        unit.activityPattern = [];
        hadMissing = true;
      }
    });
  });

  totals = filteredSections.reduce(
    (acc, section) => {
      section.units.forEach((unit) => {
        acc.activities += unit.activities;
        acc.units += 1;
      });
      return acc;
    },
    { activities: 0, units: 0 },
  );

  if (totals.units === 0 && typeof meta.unitsCount === "number") {
    totals.units = meta.unitsCount;
  }
  if (totals.activities === 0 && typeof meta.lessonsCount === "number") {
    totals.activities = meta.lessonsCount;
  }
  totals.estimated = hadMissing;

  if (!meta.levelShort) {
    meta.levelShort = normalizeLevel(meta.level);
  }

  return {
    meta: {
      ...meta,
      title: `${meta.fromLang} → ${meta.toLang}`,
      fallbackLessons,
      levelShort: meta.levelShort || normalizeLevel(meta.level),
    },
    sections: filteredSections,
    totals,
  };
}

function showToast(message) {
  if (!dom.toastRegion) return;
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  dom.toastRegion.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("hide");
    setTimeout(() => {
      toast.remove();
    }, 220);
  }, 5000);
}

function formatNumber(value) {
  return new Intl.NumberFormat().format(Math.round(value));
}

function formatDate(date) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}
