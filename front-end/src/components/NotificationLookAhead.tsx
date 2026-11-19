import React from 'react';
import { ReminderChoices, resolveReminderFilters } from '../lib/screeningReminders';
import useScreeningReminders from '../lib/useScreeningReminders';
import ReminderFilterForm from './ReminderFilterForm';

export type LookAheadProps = ReminderChoices & {
  reminders: ReturnType<typeof useScreeningReminders>;
};

export default function NotificationLookAhead({reminders, ...choices}: LookAheadProps) {
  return <section aria-labelledby="cc-screening-reminders-title">
    <h3 id="cc-screening-reminders-title">Screening notifications</h3>
    <p>Global filters apply to followed films and lists unless they have custom filters.</p>
    <ReminderFilterForm {...choices} value={resolveReminderFilters(reminders.settings)}
      onSave={reminders.setGlobalFilters} error={reminders.error}/>
    <p>CineCompass checks followed films and lists daily at 08:00 Amsterdam time.</p>
  </section>;
}
