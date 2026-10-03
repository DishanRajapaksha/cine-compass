import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, CalendarPlus, Copy, ExternalLink, X } from 'lucide-react';
import { useAccount } from './AccountProvider';
import { api } from '../services/accountService';
import './CalendarSubscription.css';

type Subscription = { enabled: boolean; url: string | null; reminderMinutes: number | null };
const disabled: Subscription = { enabled:false, url:null, reminderMinutes:null };
export const appleCalendarUrl = (url: string) => {
  const parsed = new URL(url);
  if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('Invalid calendar subscription link.');
  return `webcal://${parsed.host}${parsed.pathname}${parsed.search}`;
};
function SubscriptionDialog({onClose}:{onClose:()=>void}) {
  const account = useAccount();
  const userId = account?.user?.id;
  const dialog = useRef<HTMLDialogElement>(null);
  const reminderId = useId();
  const [subscription,setSubscription] = useState<Subscription>(disabled);
  const [reminder,setReminder] = useState('none');
  const [loading,setLoading] = useState(Boolean(userId));
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [message,setMessage] = useState('');
  const [retry,setRetry] = useState(0);
  useEffect(() => {
    const el=dialog.current, overflow=document.body.style.overflow;
    el?.showModal(); document.body.style.overflow='hidden';
    return () => {el?.close();document.body.style.overflow=overflow;};
  },[]);
  useEffect(() => {
    if (!userId) return;
    let active=true;
    setLoading(true);setError('');
    api<Subscription>('/calendar/subscription').then(value => {
      if (active) {setSubscription(value);setReminder(value.reminderMinutes === null ? 'none' : String(value.reminderMinutes));}
    }).catch(e => {if(active) setError((e as Error).message);}).finally(() => {if(active) setLoading(false);});
    return () => {active=false;};
  },[userId,retry]);
  const save = async () => {
    setBusy(true);setError('');setMessage('');
    try {
      const value=await api<Subscription>('/calendar/subscription','POST',{reminderMinutes:reminder === 'none' ? null : Number(reminder)});
      setSubscription(value);setMessage(subscription.enabled ? 'Reminder saved' : 'Ready to subscribe');
    } catch(e) {setError((e as Error).message);} finally {setBusy(false);}
  };
  const revoke = async () => {
    setBusy(true);setError('');setMessage('');
    try {await api('/calendar/subscription','DELETE');setSubscription(disabled);setMessage('Link disabled');}
    catch(e) {setError((e as Error).message);} finally {setBusy(false);}
  };
  const copy = async () => {
    try {await navigator.clipboard.writeText(subscription.url!);setMessage('Link copied');setError('');}
    catch {setError('Could not copy the link. Select it below and copy it manually.');}
  };
  const changed = reminder !== (subscription.reminderMinutes === null ? 'none' : String(subscription.reminderMinutes));
  return <dialog ref={dialog} className="cc-dialog cc-calendar-dialog" aria-label="Calendar subscription" onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget) onClose();}}>
    <header className="cc-calendar-header"><div className="cc-calendar-heading"><span className="cc-calendar-icon"><CalendarPlus size={21}/></span><div><span className="cc-calendar-eyebrow">Apple Calendar</span><h2>Saved screenings</h2></div></div><button className="cc-calendar-close" aria-label="Close calendar subscription" onClick={onClose}><X size={20}/></button></header>
    <div className="cc-calendar-body">
      {!userId ? <div className="cc-subscription-signin"><p>Sign in to sync your saved screenings.</p><button className="cc-calendar-primary" disabled={account?.busy || !account} onClick={account?.login}>Sign in with a passkey</button></div> : loading ? <p role="status">Loading calendar settings…</p> : <>
        <div className="cc-calendar-reminder"><label htmlFor={reminderId}><Bell size={17}/><span>Reminder for each film</span></label><select id={reminderId} disabled={busy || Boolean(error && !subscription.enabled)} value={reminder} onChange={e=>setReminder(e.target.value)}><option value="none">No reminder</option><option value="15">15 minutes before</option><option value="30">30 minutes before</option><option value="60">1 hour before</option><option value="1440">1 day before</option></select></div>
        {subscription.enabled && <p className="cc-subscription-active">Subscription enabled</p>}
      </>}
      {subscription.url && <details className="cc-calendar-help"><summary>Link and subscription controls</summary><p>Private link — anyone with it can view your screenings.</p><label className="cc-subscription-link">Subscription link<input readOnly value={subscription.url} onFocus={e=>e.currentTarget.select()}/></label><button className="cc-text-button" disabled={busy} onClick={copy}><Copy size={14}/> Copy subscription link</button><button className="cc-text-button" disabled={busy} onClick={revoke}>Turn off subscription</button></details>}
      {account?.error && !userId && <p role="alert" className="cc-calendar-error">{account.error}</p>}
    </div>
    {userId && !loading && <footer className="cc-calendar-footer">
      {userId && !loading && <div className="cc-calendar-actions">
        {subscription.enabled && subscription.url ? <><a className="cc-calendar-primary" href={appleCalendarUrl(subscription.url)}><ExternalLink size={17}/>Open in Apple Calendar</a>{changed && <button className="cc-calendar-secondary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save reminder'}</button>}</> : <button className="cc-calendar-primary" disabled={busy || Boolean(error)} onClick={save}>{busy ? 'Creating link…' : 'Enable calendar subscription'}</button>}
        {error && <button className="cc-calendar-secondary" disabled={busy} onClick={()=>setRetry(n=>n+1)}>Retry loading settings</button>}
      </div>}
      {message && <p role="status" className="cc-calendar-status">{message}</p>}{error && <p role="alert" className="cc-calendar-error">{error}</p>}
    </footer>}
  </dialog>;
}
export default function CalendarSubscription() {
  const [open,setOpen] = useState(false);
  const trigger=useRef<HTMLButtonElement>(null);
  return <section aria-labelledby="cc-subscription-title"><h3 id="cc-subscription-title">Calendar</h3><p>Sync saved screenings with Apple Calendar.</p><button ref={trigger} className="cc-text-button" aria-haspopup="dialog" onClick={()=>setOpen(true)}>Set up calendar subscription</button>{open && createPortal(<SubscriptionDialog onClose={()=>setOpen(false)}/>,trigger.current?.closest('.cc-app') || document.body)}</section>;
}
