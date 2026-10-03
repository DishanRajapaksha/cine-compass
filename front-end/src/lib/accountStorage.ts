export const syncKeys = ['cinecompass_schedule_filters','cinecompass_schedule_view','cineville_saved_showtimes','cinecompass_saved_films','cinecompass_hidden_movies','cinecompass_planner_prefs','cineville_filters','cineville_filters_open','cineville_timeline_prefs','cineville_timeline_theater_order'];
export const settingsEvent = 'cinecompass-settings-changed';
export function setPreference(key: string, value: string) {
  const previous = localStorage.getItem(key);
  localStorage.setItem(key,value);
  if (previous !== value && syncKeys.includes(key)) window.dispatchEvent(new Event(settingsEvent));
}
export function snapshot(): Record<string,string> {
  const result: Record<string,string> = {};
  for (const key of syncKeys) {
    let value = localStorage.getItem(key);
    if (value === null) continue;
    if (key.endsWith('_filters') || key === 'cineville_filters') {
      try { const filters=JSON.parse(value); for (const field of ['startDate','endDate','startTime','endTime']) filters[field]=null; value=JSON.stringify(filters); } catch { continue; }
    }
    result[key]=value!;
  }
  return result;
}
export function applySettings(values: Record<string,string>) {
  for (const key of syncKeys) {
    if (typeof values[key] === 'string') localStorage.setItem(key,values[key]); else localStorage.removeItem(key);
  }
}
