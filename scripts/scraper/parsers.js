/**
 * HTML parsing logic for Duolingo course data
 * Adapted from app.js for server-side use with cheerio
 */

import * as cheerio from 'cheerio';

// Language code to name mappings (from app.js)
const LANGUAGE_NAME_OVERRIDES = {
  af: 'Afrikaans', am: 'Amharic', ar: 'Arabic', az: 'Azerbaijani',
  be: 'Belarusian', bg: 'Bulgarian', bn: 'Bengali', bs: 'Bosnian',
  ca: 'Catalan', ceb: 'Cebuano', co: 'Corsican', cs: 'Czech', cy: 'Welsh',
  da: 'Danish', de: 'German', el: 'Greek', en: 'English', eo: 'Esperanto',
  es: 'Spanish', et: 'Estonian', eu: 'Basque', fa: 'Persian', fi: 'Finnish',
  fr: 'French', hv: 'High Valyrian', hw: 'Hawaiian', ga: 'Irish',
  gd: 'Scottish Gaelic', gl: 'Galician', gn: 'Guarani', gu: 'Gujarati',
  hk: 'Cantonese', ht: 'Haitian Creole', kl: 'Klingon', nb: 'Norwegian Bokmål',
  nv: 'Navajo', he: 'Hebrew', hi: 'Hindi', hr: 'Croatian', hu: 'Hungarian',
  hy: 'Armenian', id: 'Indonesian', ig: 'Igbo', is: 'Icelandic', it: 'Italian',
  ja: 'Japanese', ko: 'Korean', ku: 'Kurdish', la: 'Latin', lb: 'Luxembourgish',
  lt: 'Lithuanian', lv: 'Latvian', mg: 'Malagasy', mi: 'Maori', mk: 'Macedonian',
  ml: 'Malayalam', mn: 'Mongolian', mr: 'Marathi', ms: 'Malay', mt: 'Maltese',
  my: 'Burmese', ne: 'Nepali', nl: 'Dutch', no: 'Norwegian', ny: 'Chichewa',
  pl: 'Polish', pt: 'Portuguese', qu: 'Quechua', ro: 'Romanian', ru: 'Russian',
  sh: 'Serbo-Croatian', si: 'Sinhala', sk: 'Slovak', sr: 'Serbian', sv: 'Swedish',
  sw: 'Swahili', ta: 'Tamil', te: 'Telugu', th: 'Thai', tl: 'Tagalog',
  tr: 'Turkish', uk: 'Ukrainian', ur: 'Urdu', uz: 'Uzbek', vi: 'Vietnamese',
  yi: 'Yiddish', xh: 'Xhosa', zh: 'Chinese', zhhans: 'Chinese (Simplified)',
  zhhant: 'Chinese (Traditional)', zu: 'Zulu',
};

const REMOTE_BASE = 'https://duolingodata.com/';

/**
 * Parse the main course list table
 * @param {string} html - HTML content of the main page
 * @returns {Array} - Array of course objects
 */
export function parseCourseList(html) {
  const $ = cheerio.load(html);
  const courses = [];
  
  // Find the main course table
  let table = null;
  $('table').each((i, tbl) => {
    const headerText = $(tbl).find('thead').text();
    if (/course/i.test(headerText) && /units/i.test(headerText)) {
      table = $(tbl);
      return false; // break
    }
  });
  
  if (!table) {
    table = $('table').first();
  }
  
  if (!table || !table.length) {
    return courses;
  }

  // Parse header cells
  const headerCells = [];
  table.find('thead th').each((i, th) => {
    headerCells.push($(th).text().trim().toLowerCase());
  });

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

  // Parse rows
  table.find('tbody tr').each((i, row) => {
    const cells = $(row).find('td');
    if (cells.length < Math.max(3, headerCells.length || 0)) {
      return; // skip rows with insufficient cells
    }

    const getCell = (index, fallback) => {
      if (index != null && index >= 0 && cells[index]) {
        return $(cells[index]);
      }
      if (fallback != null && fallback >= 0) {
        return $(cells[fallback]);
      }
      return null;
    };

    const courseCell = getCell(courseIndex, 0);
    const fromCell = getCell(fromIndex, 1);
    const toCell = getCell(toIndex, courseIndex >= 0 ? courseIndex : 0);

    const normalizeText = (cell) => cell?.text()?.replace(/\s+/g, ' ').trim() ?? '';
    const courseName = normalizeText(courseCell);
    const fromLangRaw = normalizeText(fromCell);
    const toLangRaw = normalizeText(toCell);

    // Get detail href
    let detailHref = courseCell?.find('a[href$=".html"]').attr('href') ?? '';
    if (!detailHref && toCell) {
      detailHref = toCell.find('a[href$=".html"]').attr('href') ?? '';
    }
    const absoluteHref = detailHref ? new URL(detailHref, REMOTE_BASE).href : null;

    // Extract language codes
    const codes = absoluteHref ? extractLanguageCodes(absoluteHref) : { to: null, from: null };

    const toLang =
      languageCodeToName(codes.to) ||
      humanizeLanguageLabel(toLangRaw) ||
      humanizeLanguageLabel(courseName);
    const fromLang =
      languageCodeToName(codes.from) ||
      humanizeLanguageLabel(fromLangRaw) ||
      humanizeLanguageLabel((courseName.split('→')[0] || '').trim());

    const numberFromCell = (cell) => {
      if (!cell) return null;
      const num = parseInt(cell.text().replace(/[^0-9]/g, ''), 10);
      return num || null;
    };

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

    const key =
      absoluteHref ||
      `fallback:${(fromLang || '').toLowerCase()}::${(toLang || '').toLowerCase()}::${
        levelShort || levelRaw || updated || unitsCount || lessonsCount || 'v1'
      }`;

    courses.push({
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
      hasDetail: !!absoluteHref,
    });
  });

  // Filter out invalid courses
  return courses.filter((course) => {
    if (!course) return false;
    const from = (course.fromLang || '').toLowerCase();
    const to = (course.toLang || '').toLowerCase();
    if (from && to && from === to) return false;
    if (course.fromCode && course.toCode && course.fromCode === course.toCode) return false;
    return true;
  });
}

/**
 * Parse a course detail page
 * @param {string} html - HTML content of the detail page
 * @param {object} meta - Course metadata from the list
 * @returns {object} - Parsed course detail with sections and units
 */
export function parseCourseDetail(html, meta) {
  // Clean up HTML for text extraction
  const clean = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr)>/gi, '\n')
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/\u3164/g, ' ');
  const plain = clean.replace(/<[^>]+>/g, '');
  const lines = plain.split('\n');
  
  const sections = [];
  let currentSection = null;
  let currentUnit = null;
  const warnings = [];
  
  const unitRegex = /^\s*(\d+)\s+(\d+)\s+(.+)$/;
  const unitsWordPattern =
    'units?|unidades?|unidade?s?|unités?|unità|einheiten|lektion(?:en)?|lessons?|leçons?|lektioner|разделы|юнитов|уроков?|занятий|ders|درس|课程|課|レッスン|単元|단원|레슨';
  const sectionParenRegex = /^([^\d]{2,})\s*(\d+)\s*\((\d+)\s+[^)]*\)\s*(.*)$/u;
  const sectionAltRegex = new RegExp(
    `^([^\\d]{2,})\\s*(\\d+)\\s+[^\\d]*?(\\d+)\\s+(?:${unitsWordPattern})\\s*(.*)$`,
    'iu',
  );
  const numberLineRegex = /(\d+)/g;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();
    if (!trimmed) continue;

    const normalized = trimmed.replace(/^[\-–—•*•]+\s*/, '');
    let sectionMatch = normalized.match(sectionParenRegex);
    if (!sectionMatch) {
      sectionMatch = normalized.match(sectionAltRegex);
    }
    
    if (sectionMatch) {
      const [, headingRaw, sectionNumber, unitCount, rest] = sectionMatch;
      const headingClean = headingRaw.trim().replace(/[:\s]+$/, '');
      const sectionTitleCandidate = rest.trim().replace(/^[\s:–-]+/, '');
      const originalTitle = sectionTitleCandidate || headingClean;
      const levelInTitle = normalizeLevel(originalTitle);
      const cleanedTitle = originalTitle
        .replace(/CEFR\s*[A-C][0-3](?:\+|-)?/gi, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
      const displayTitle = cleanedTitle || originalTitle;
      
      currentSection = {
        sectionIndex: Number(sectionNumber),
        unitCount: Number(unitCount),
        title: displayTitle,
        rawTitle: originalTitle,
        cefr: levelInTitle || '',
        units: [],
      };
      sections.push(currentSection);
      currentUnit = null;
      
      if (levelInTitle && !meta.levelShort) {
        meta.levelShort = levelInTitle;
        meta.level = `CEFR ${levelInTitle}`;
      }
      continue;
    }

    const unitMatch = normalized.match(unitRegex);
    if (unitMatch && currentSection) {
      const [, unitNumber, activityCount, title] = unitMatch;
      const parsedActivities = Number(activityCount);
      currentUnit = {
        sectionIndex: currentSection.sectionIndex,
        unitIndex: Number(unitNumber),
        title: title.trim(),
        activityPattern: [],
        activities: Number.isFinite(parsedActivities) ? parsedActivities : null,
      };
      currentSection.units.push(currentUnit);
      continue;
    }

    // Check for activity patterns (comma-separated numbers)
    if (currentUnit && /[0-9]/.test(trimmed) && trimmed.includes(',')) {
      const numbers = [...trimmed.matchAll(numberLineRegex)].map((match) => Number(match[1]));
      if (numbers.length) {
        currentUnit.activityPattern = numbers;
        currentUnit.activities = numbers.reduce((sum, value) => sum + value, 0);
      }
    }
  }

  // Filter out empty sections
  const filteredSections = sections.filter((section) => section.units.length > 0);

  // Calculate totals
  let totals = filteredSections.reduce(
    (acc, section) => {
      section.units.forEach((unit) => {
        if (typeof unit.activities === 'number') {
          acc.activities += unit.activities;
        }
        acc.units += 1;
      });
      return acc;
    },
    { sections: filteredSections.length, activities: 0, units: 0 },
  );

  // Calculate fallback lessons count
  const metaAverage =
    typeof meta.lessonsCount === 'number' && typeof meta.unitsCount === 'number' && meta.unitsCount > 0
      ? Math.max(1, Math.round(meta.lessonsCount / meta.unitsCount))
      : null;
  const computedAverage =
    totals.units > 0 && totals.activities > 0
      ? Math.max(1, Math.round(totals.activities / totals.units))
      : null;
  const fallbackLessons = metaAverage || computedAverage || 10;

  // Fill in missing activity counts
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

  if (hadMissing) {
    warnings.push(`Some units missing activity data, using fallback: ${fallbackLessons}`);
  }

  // Recalculate totals after filling missing
  totals = filteredSections.reduce(
    (acc, section) => {
      section.units.forEach((unit) => {
        acc.activities += unit.activities;
        acc.units += 1;
      });
      acc.sections = filteredSections.length;
      return acc;
    },
    { sections: filteredSections.length, activities: 0, units: 0 },
  );

  // Use meta counts if parsing found nothing
  if (totals.units === 0 && typeof meta.unitsCount === 'number') {
    totals.units = meta.unitsCount;
    warnings.push('No sections parsed, using meta.unitsCount');
  }
  if (totals.activities === 0 && typeof meta.lessonsCount === 'number') {
    totals.activities = meta.lessonsCount;
    warnings.push('No activities parsed, using meta.lessonsCount');
  }

  return {
    sections: filteredSections,
    totals,
    warnings,
  };
}

/**
 * Parse the daily news page
 * @param {string} html - HTML content of the daily news page
 * @returns {object} - Parsed news entries
 */
export function parseDailyNews(html) {
  const $ = cheerio.load(html);
  const entries = [];
  
  // Try to find structured news items
  $('body').find('p, div, li').each((i, el) => {
    const text = $(el).text().trim();
    // Filter out very short or very long text
    if (text.length > 10 && text.length < 500) {
      // Check if it contains date-like patterns or change keywords
      if (/\d{4}[-/]\d{2}[-/]\d{2}|added|updated|new|changed|removed/i.test(text)) {
        entries.push({ text, index: i });
      }
    }
  });

  // If no structured entries found, just get recent content
  if (entries.length === 0) {
    $('body').find('p, li').each((i, el) => {
      const text = $(el).text().trim();
      if (text.length > 20 && text.length < 500) {
        entries.push({ text, index: i });
      }
    });
  }

  // Limit to recent items
  return { entries: entries.slice(0, 50) };
}

// Helper functions

function extractLanguageCodes(detailHref) {
  try {
    const url = new URL(detailHref);
    const fileName = url.pathname.split('/').pop() || '';
    const base = fileName.replace(/\.[^.]+$/, '').toLowerCase();
    const match = base.match(/^([a-z]{2,5})f([a-z]{2,5})/);
    if (match) {
      return { to: match[1], from: match[2] };
    }
  } catch {
    // ignore invalid urls
  }
  return { to: null, from: null };
}

function normalizeLanguageCode(code) {
  if (!code) return null;
  const cleaned = code.toLowerCase().replace(/[^a-z]/g, '');
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
  if (!raw) return '';
  const trimmed = raw
    .replace(/\([^)]*\)/g, ' ')
    .replace(/for.+$/i, ' ')
    .replace(/from.+$/i, ' ')
    .trim();
  if (!trimmed) return '';
  const token = trimmed.toLowerCase();
  const override = languageCodeToName(token);
  if (override) return override;
  return trimmed
    .split(/[\s/_-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function normalizeLevel(level) {
  if (!level) return '';
  const match = level.match(/([A-C][0-3](?:\+|-)?)/i);
  if (match) {
    return match[1].toUpperCase();
  }
  const cleaned = level
    .replace(/CEFR\s*/i, '')
    .replace(/nivel\s*/i, '')
    .replace(/niveau\s*/i, '')
    .replace(/livello\s*/i, '')
    .replace(/nivå\s*/i, '')
    .replace(/ระดับ\s*/i, '')
    .trim();
  return cleaned.toUpperCase();
}

export {
  extractLanguageCodes,
  normalizeLanguageCode,
  languageCodeToName,
  humanizeLanguageLabel,
  normalizeLevel,
};
