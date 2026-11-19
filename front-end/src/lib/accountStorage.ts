import { screeningRemindersKey } from './screeningReminders';
import { legacyListKeys, movieListsKey, normalizeMovieListSettings } from './movieLists';

export const cinemaListsKey = 'cinecompass_cinema_lists';
export const syncKeys = ['cinecompass_schedule_filters','cinecompass_schedule_view','cinecompass_catalogue_view','cinecompass_now_showing_sort','cinecompass_upcoming_sort','cinecompass_schedule_grouping','cineville_saved_showtimes',movieListsKey,screeningRemindersKey,cinemaListsKey,'cinecompass_planner_prefs','cineville_filters','cineville_filters_open','cineville_timeline_prefs','cineville_timeline_theater_order'];
export const settingsEvent = 'cinecompass-settings-changed';

export function setPreference(key: string, value: string) {
  const previous = localStorage.getItem(key);
  localStorage.setItem(key,value);
  if (previous !== value && syncKeys.includes(key)) window.dispatchEvent(new Event(settingsEvent));
}
export function snapshot(): Record<string,string> {
  const result: Record<string,string> = {};
  for (const key of [...syncKeys, ...legacyListKeys]) {
    let value = localStorage.getItem(key);
    if (value === null) continue;
    if (key.endsWith('_filters') || key === 'cineville_filters') {
      try { const filters=JSON.parse(value); for (const field of ['startDate','endDate','startTime','endTime']) filters[field]=null; value=JSON.stringify(filters); } catch { continue; }
    }
    result[key]=value!;
  }
  return normalizeMovieListSettings(result);
}
export function applySettings(values: Record<string,string>) {
  const settings = normalizeMovieListSettings(values);
  for (const key of legacyListKeys) localStorage.removeItem(key);
  for (const key of syncKeys) {
    if (typeof settings[key] === 'string') localStorage.setItem(key,settings[key]); else localStorage.removeItem(key);
  }
}
