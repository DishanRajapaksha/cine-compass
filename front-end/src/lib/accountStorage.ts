export const watchedMoviesKey = 'cinecompass_watched_movies';
const legacyWatchedMoviesKey = 'cinecompass_hidden_movies';
export const syncKeys = ['cinecompass_schedule_filters','cinecompass_schedule_view','cinecompass_catalogue_view','cinecompass_now_showing_sort','cinecompass_upcoming_sort','cinecompass_schedule_grouping','cineville_saved_showtimes','cinecompass_saved_films',watchedMoviesKey,'cinecompass_planner_prefs','cineville_filters','cineville_filters_open','cineville_timeline_prefs','cineville_timeline_theater_order'];
export const settingsEvent = 'cinecompass-settings-changed';

export function migrateWatchedMovies(): string {
  let readKey = watchedMoviesKey;
  try {
    const legacy = localStorage.getItem(legacyWatchedMoviesKey);
    if (legacy !== null) {
      if (localStorage.getItem(watchedMoviesKey) === null) {
        readKey = legacyWatchedMoviesKey;
        localStorage.setItem(watchedMoviesKey, legacy);
        readKey = watchedMoviesKey;
      }
      localStorage.removeItem(legacyWatchedMoviesKey);
    }
  } catch { /* Keep reading the legacy entry if storage cannot complete the move. */ }
  return readKey;
}

export function normalizeWatchedSettings(values: Record<string,string>): Record<string,string> {
  const { [legacyWatchedMoviesKey]: legacy, ...settings } = values;
  if (typeof legacy === 'string' && typeof settings[watchedMoviesKey] !== 'string')
    settings[watchedMoviesKey] = legacy;
  return settings;
}

export function setPreference(key: string, value: string) {
  const previous = localStorage.getItem(key);
  localStorage.setItem(key,value);
  if (previous !== value && syncKeys.includes(key)) window.dispatchEvent(new Event(settingsEvent));
}
export function snapshot(): Record<string,string> {
  const watchedKey = migrateWatchedMovies();
  const result: Record<string,string> = {};
  for (const key of syncKeys) {
    let value = localStorage.getItem(key === watchedMoviesKey ? watchedKey : key);
    if (value === null) continue;
    if (key.endsWith('_filters') || key === 'cineville_filters') {
      try { const filters=JSON.parse(value); for (const field of ['startDate','endDate','startTime','endTime']) filters[field]=null; value=JSON.stringify(filters); } catch { continue; }
    }
    result[key]=value!;
  }
  return result;
}
export function applySettings(values: Record<string,string>) {
  const settings = normalizeWatchedSettings(values);
  for (const key of syncKeys) {
    if (typeof settings[key] === 'string') localStorage.setItem(key,settings[key]); else localStorage.removeItem(key);
  }
  localStorage.removeItem(legacyWatchedMoviesKey);
}
