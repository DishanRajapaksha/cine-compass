import React, { createContext, useContext } from 'react';
import { Bell } from 'lucide-react';
import useScreeningReminders from '../lib/useScreeningReminders';

export const ScreeningRemindersContext = createContext<ReturnType<typeof useScreeningReminders> | null>(null);

export default function ScreeningReminder({id, title, list = false}: {id: string; title: string; list?: boolean}) {
  const reminders = useContext(ScreeningRemindersContext);
  if (!reminders?.enabled) return null;
  const active = (list ? reminders.settings.listIds : reminders.settings.filmIds).includes(id);
  const label = list ? 'Notify for this list' : 'Notify me';

  return <button className="cc-text-button cc-reminder-toggle" aria-pressed={active} aria-label={list ? `Notify for list ${title}` : `Notify me for ${title}`}
    onClick={() => list ? reminders.toggleList(id) : reminders.toggleFilm(id)}>
    <Bell size={14} fill={active ? 'currentColor' : 'none'} aria-hidden="true"/> {label}
  </button>;
}
