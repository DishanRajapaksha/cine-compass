import React from 'react';
import { Bell } from 'lucide-react';
import { useAccount } from './AccountProvider';
import NotificationHistory from './NotificationHistory';
import './Notifications.css';

type Props = {
  enabled: boolean;
  unread: number;
  refreshCount: () => void;
};

export default function NotificationsPage({enabled, unread, refreshCount}: Props) {
  const account = useAccount();
  return <section className="cc-subpage cc-notifications" aria-labelledby="cc-notifications-title">
    <header className="cc-page-header">
      <div className="cc-page-title">
        <h2 id="cc-notifications-title">Notifications</h2>
        {unread > 0 && <span>{unread} unread</span>}
      </div>
    </header>
    {enabled ? <NotificationHistory unread={unread} refreshCount={refreshCount}/> : <div className="cc-empty">
      <Bell size={28} aria-hidden="true"/>
      <h3>Sign in for screening notifications</h3>
      {account && <button className="cc-primary" onClick={account.login}>Sign in</button>}
    </div>}
  </section>;
}
