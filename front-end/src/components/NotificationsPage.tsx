import React, { useState } from 'react';
import { Bell } from 'lucide-react';
import { useAccount } from './AccountProvider';
import useScreeningReminders from '../lib/useScreeningReminders';
import { maximumLookAheadDays, validLookAhead } from '../lib/screeningReminders';
import NotificationHistory from './NotificationHistory';
import './Notifications.css';

type Props = {
  reminders: ReturnType<typeof useScreeningReminders>;
  unread: number;
  refreshCount: () => void;
};

function LookAhead({reminders, status}: Pick<Props, 'reminders'> & {status?: string}) {
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? String(reminders.settings.lookAheadDays);
  const days = Number(value);
  return <section className="cc-notification-options" aria-label="Reminder settings">
    <form onSubmit={event => {
      event.preventDefault();
      if (validLookAhead(days) && reminders.setLookAhead(days)) setDraft(null);
    }}>
      <label htmlFor="cc-look-ahead">Look ahead (days)</label>
      <div>
        <input id="cc-look-ahead" type="number" min={1} max={maximumLookAheadDays} step={1} required
          value={value} onChange={event => setDraft(event.target.value)}/>
        <button type="submit" className="cc-primary" disabled={!validLookAhead(days) || days === reminders.settings.lookAheadDays}>Save</button>
      </div>
    </form>
    <p>CineCompass checks followed films and lists daily at 08:00 Amsterdam time.</p>
    {status && <p role="status">{status}</p>}
  </section>;
}

export default function NotificationsPage({reminders, unread, refreshCount}: Props) {
  const account = useAccount();
  return <section className="cc-subpage cc-notifications" aria-labelledby="cc-notifications-title">
    <header className="cc-page-header">
      <div className="cc-page-title">
        <h2 id="cc-notifications-title">Notifications</h2>
        {unread > 0 && <span>{unread} unread</span>}
      </div>
    </header>
    {reminders.enabled ? <>
      <LookAhead reminders={reminders} status={account?.status}/>
      <NotificationHistory unread={unread} refreshCount={refreshCount}/>
    </> : <div className="cc-empty">
      <Bell size={28} aria-hidden="true"/>
      <h3>Sign in for screening notifications</h3>
      {account && <button className="cc-primary" onClick={account.login}>Sign in</button>}
    </div>}
  </section>;
}
