export const screeningRemindersKey = 'cinecompass_screening_reminders';
export const maximumLookAheadDays = 365;

export type ScreeningReminders = {
  lookAheadDays: number;
  filmIds: string[];
  listIds: string[];
};

export const defaultScreeningReminders: ScreeningReminders = {
  lookAheadDays: maximumLookAheadDays,
  filmIds: [],
  listIds: [],
};

export function validLookAhead(days: number) {
  return Number.isInteger(days) && days >= 1 && days <= maximumLookAheadDays;
}

export function validScreeningReminders(value: unknown): value is ScreeningReminders {
  if (!value || typeof value !== 'object') return false;
  const {lookAheadDays, filmIds, listIds} = value as ScreeningReminders;
  return validLookAhead(lookAheadDays) && [filmIds, listIds].every(ids =>
    Array.isArray(ids) && ids.every(id => typeof id === 'string'));
}
