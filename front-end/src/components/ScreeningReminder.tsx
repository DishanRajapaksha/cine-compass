import React, { createContext, useContext, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell } from 'lucide-react';
import { normalizeLanguageCodes } from '../lib/utils';
import { LookAheadProps } from './NotificationLookAhead';
import ReminderFilterDialog from './ReminderFilterDialog';

export const ScreeningRemindersContext = createContext<LookAheadProps | null>(null);

type Props = {id: string; title: string; list?: boolean; spokenLanguages?: string[]; subtitleLanguages?: string[]};

export default function ScreeningReminder({id, title, list = false, spokenLanguages = [], subtitleLanguages = []}: Props) {
  const options = useContext(ScreeningRemindersContext);
  const [editing, setEditing] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  if (!options?.reminders.enabled) return null;
  const {reminders} = options;
  const active = (list ? reminders.settings.listIds : reminders.settings.filmIds).includes(id);
  const label = list ? 'Notify for this list' : 'Notify me';

  return <>
    <button type="button" className="cc-text-button cc-reminder-toggle" aria-pressed={active}
      aria-label={list ? `Notify for list ${title}` : `Notify me for ${title}`}
      onClick={() => list ? reminders.toggleList(id) : reminders.toggleFilm(id)}>
      <Bell size={14} fill={active ? 'currentColor' : 'none'} aria-hidden="true"/> {label}
    </button>
    {active && <button ref={trigger} type="button" className="cc-text-button" aria-haspopup="dialog"
      aria-label={`Reminder filters for ${title}`} onClick={() => setEditing(true)}>Reminder filters</button>}
    {active && editing && createPortal(<ReminderFilterDialog {...options} id={id} title={title} scope={list ? 'listFilters' : 'filmFilters'}
      languages={normalizeLanguageCodes([...options.languages, ...spokenLanguages])}
      subtitleLanguages={normalizeLanguageCodes([...(options.subtitleLanguages ?? []), ...subtitleLanguages])}
      onClose={() => setEditing(false)}/>, trigger.current?.closest('.cc-app') ?? document.body)}
  </>;
}
