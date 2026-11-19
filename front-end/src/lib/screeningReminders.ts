import { defaultLanguageFilters } from './schedule';
import { City, LanguageFilterValues } from '../types/Movie';

export const screeningRemindersKey = 'cinecompass_screening_reminders';
export const maximumLookAheadDays = 365;

export type ReminderFilters = Required<LanguageFilterValues> & {
  lookAheadDays: number;
  city: string | null;
};
export type ReminderChoices = {
  cities: City[];
  languages: string[];
  subtitleLanguages?: string[];
  cityError: string;
  retryCities: () => void;
};
export type OverrideKey = 'filmFilters' | 'listFilters';

type StoredReminderFilters = Partial<ReminderFilters> & Pick<ReminderFilters, 'lookAheadDays'>;

export type ScreeningReminders = StoredReminderFilters & {
  filmIds: string[];
  listIds: string[];
  filmFilters?: Record<string, StoredReminderFilters>;
  listFilters?: Record<string, StoredReminderFilters>;
};

export const defaultScreeningReminders: ScreeningReminders = {
  lookAheadDays: maximumLookAheadDays,
  filmIds: [],
  listIds: [],
};

export function validLookAhead(days: number) {
  return Number.isInteger(days) && days >= 1 && days <= maximumLookAheadDays;
}

export function resolveReminderFilters(settings: StoredReminderFilters): ReminderFilters {
  return {
    lookAheadDays: settings.lookAheadDays, city: settings.city ?? null,
    languageMatchMode: settings.languageMatchMode ?? defaultLanguageFilters.languageMatchMode,
    selectedSpokenLanguages: settings.selectedSpokenLanguages ?? defaultLanguageFilters.selectedSpokenLanguages,
    selectedSubtitleLanguages: settings.selectedSubtitleLanguages ?? defaultLanguageFilters.selectedSubtitleLanguages,
  };
}

export function reminderOverride(settings: ScreeningReminders, key: OverrideKey, id: string) {
  const entries = settings[key];
  return entries && Object.prototype.hasOwnProperty.call(entries, id) ? resolveReminderFilters(entries[id]) : undefined;
}

function validText(value: unknown, max = 128): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max && value.trim() === value;
}

function validFilters(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const {lookAheadDays, city, languageMatchMode, selectedSpokenLanguages, selectedSubtitleLanguages} = value as Partial<ReminderFilters>;
  return lookAheadDays !== undefined && validLookAhead(lookAheadDays) &&
    (city == null || validText(city)) &&
    (languageMatchMode === undefined || languageMatchMode === 'any' || languageMatchMode === 'all') &&
    [selectedSpokenLanguages, selectedSubtitleLanguages].every(languages => languages === undefined ||
      (Array.isArray(languages) && languages.length <= 1 && languages.every(code => validText(code, 32))));
}

export function validScreeningReminders(value: unknown): value is ScreeningReminders {
  if (!validFilters(value)) return false;
  const {filmIds, listIds, filmFilters, listFilters} = value as ScreeningReminders;
  return [filmIds, listIds].every(ids => Array.isArray(ids) && ids.every(id => validText(id)) && new Set(ids).size === ids.length) &&
    [filmFilters, listFilters].every(entries => entries === undefined ||
      (entries && typeof entries === 'object' && !Array.isArray(entries) &&
        Object.entries(entries).every(([id, filters]) => validText(id) && validFilters(filters))));
}
