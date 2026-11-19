import { useEffect, useState } from 'react';
import { setPreference } from './accountStorage';
import { readStorage } from './schedule';
import { defaultScreeningReminders, ScreeningReminders, screeningRemindersKey, validScreeningReminders } from './screeningReminders';

const load = () => readStorage(screeningRemindersKey, defaultScreeningReminders, validScreeningReminders);

export default function useScreeningReminders(enabled: boolean) {
  const [settings, setSettings] = useState(load);
  const [error, setError] = useState('');
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === screeningRemindersKey || event.key === null) setSettings(load());
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  const update = (change: (current: ScreeningReminders) => ScreeningReminders) => {
    if (!enabled) return false;
    try {
      const next = change(load());
      setPreference(screeningRemindersKey, JSON.stringify(next));
      setSettings(next);
      setError('');
      return true;
    } catch {
      setError('The screening reminder could not be saved.');
      return false;
    }
  };

  const toggle = (key: 'filmIds' | 'listIds', id: string) => update(current => ({
    ...current,
    [key]: current[key].includes(id) ? current[key].filter(entry => entry !== id) : [...current[key], id],
  }));

  return {
    enabled, settings, error,
    toggleFilm: (id: string) => toggle('filmIds', id),
    toggleList: (id: string) => toggle('listIds', id),
    setLookAhead: (lookAheadDays: number) => update(current => ({...current, lookAheadDays})),
  };
}
