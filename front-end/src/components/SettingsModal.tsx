import React, { useEffect, useRef } from 'react';
import { Settings2, X } from 'lucide-react';
import ImdbSettings from './ImdbSettings';
import AccountSettings from './AccountSettings';
import CalendarSubscription from './CalendarSubscription';
import NotificationLookAhead, { LookAheadProps } from './NotificationLookAhead';
import './SettingsModal.css';

type Props = {
  screeningReminders: LookAheadProps;
  onClose: () => void;
};

export default function SettingsModal({screeningReminders,onClose}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {const el=dialog.current;el?.showModal();return () => el?.close();},[]);
  return <dialog ref={dialog} className="cc-dialog cc-settings-dialog cc-preferences-dialog" aria-labelledby="cc-settings-title"
    onCancel={onClose} onClick={e => {if(e.target===e.currentTarget) onClose();}}>
    <header className="cc-settings-header">
      <div className="cc-preferences-title"><Settings2 size={24} aria-hidden="true"/><h2 id="cc-settings-title">Settings</h2></div>
      <button className="cc-dialog-close" aria-label="Close settings" title="Close settings" onClick={onClose}><X size={22}/></button>
    </header>
    <div className="cc-settings-body cc-preferences-body">
      <AccountSettings/>
      {screeningReminders.reminders.enabled && <NotificationLookAhead {...screeningReminders}/>}
      <div className="cc-preferences-integrations">
        <CalendarSubscription/>
        <section aria-labelledby="cc-imdb-title"><h3 id="cc-imdb-title">IMDb</h3><ImdbSettings/></section>
      </div>
    </div>
  </dialog>;
}
