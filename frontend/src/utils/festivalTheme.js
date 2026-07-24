/**
 * Hindu festival theme helper — uses yearly calendar windows (lunar festivals shift).
 * Prefer server calendar via /api/festivals; falls back to bundled seed for offline.
 */
import bundled from './festivalCalendar.seed.json';

const toIsoDate = (d = new Date()) => {
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const inRange = (iso, start, end) => iso >= start && iso <= end;

/** @type {Record<string, object[]>|null} */
let remoteYears = null;

export const setFestivalCalendarCache = (yearsDocs = []) => {
  const map = {};
  for (const doc of yearsDocs) {
    if (doc?.year && Array.isArray(doc.festivals)) {
      map[String(doc.year)] = doc.festivals;
    }
  }
  remoteYears = Object.keys(map).length ? map : null;
};

export const getFestivalsForYear = (year) => {
  const key = String(year);
  if (remoteYears?.[key]) return remoteYears[key];
  return bundled.years?.[key] || [];
};

/**
 * @param {Date|string} [date]
 * @returns {null|{id:string,name:string,greeting:string,motif:string,accents:object,start:string,end:string}}
 */
export const getActiveFestivalTheme = (date = new Date()) => {
  const iso = toIsoDate(date);
  if (!iso) return null;
  const year = Number(iso.slice(0, 4));
  const festivals = getFestivalsForYear(year);
  return festivals.find((f) => inRange(iso, f.start, f.end)) || null;
};

/**
 * Decide whether festive edition should apply.
 * Manual override always wins; auto only when settings.autoFestiveTheme !== false.
 */
export const resolveFestiveSuggestion = ({
  date = new Date(),
  autoFestiveTheme = true,
  forcedTemplateId = null,
} = {}) => {
  const festival = getActiveFestivalTheme(date);
  if (!festival) {
    return { festival: null, suggestFestive: false, reason: 'none' };
  }
  if (forcedTemplateId && forcedTemplateId !== 'festive-edition') {
    return { festival, suggestFestive: false, reason: 'manual-override' };
  }
  if (autoFestiveTheme === false) {
    return { festival, suggestFestive: false, reason: 'disabled' };
  }
  return { festival, suggestFestive: true, reason: 'auto' };
};

export default getActiveFestivalTheme;
