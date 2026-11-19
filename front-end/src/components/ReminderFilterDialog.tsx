import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { OverrideKey, reminderOverride, resolveReminderFilters } from '../lib/screeningReminders';
import { LookAheadProps } from './NotificationLookAhead';
import ReminderFilterForm from './ReminderFilterForm';

type Props = LookAheadProps & {id: string; title: string; scope: OverrideKey; onClose: () => void};

export default function ReminderFilterDialog({id, title, scope, reminders, onClose, ...choices}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useId();
  const custom = reminderOverride(reminders.settings, scope, id);
  useEffect(() => {
    const el = dialog.current;
    el?.showModal();
    return () => el?.close();
  }, []);

  return <dialog ref={dialog} className="cc-dialog cc-settings-dialog" aria-labelledby={heading}
    onCancel={event => { event.stopPropagation(); onClose(); }}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <header className="cc-settings-header">
      <h2 id={heading}>Reminder filters</h2>
      <button className="cc-dialog-close" aria-label="Close reminder filters" onClick={onClose}><X size={22}/></button>
    </header>
    <div className="cc-settings-body">
      <h3>{title}</h3>
      <p>{custom ? 'This reminder uses custom filters.' : 'This reminder uses global filters. Save changes to set custom filters.'}</p>
      <ReminderFilterForm {...choices} value={custom ?? resolveReminderFilters(reminders.settings)} error={reminders.error}
        onSave={filters => {
          const saved = reminders.setOverride(scope, id, filters);
          if (saved) onClose();
          return saved;
        }}
        onReset={custom ? () => { if (reminders.setOverride(scope, id, null)) onClose(); } : undefined}/>
    </div>
  </dialog>;
}
