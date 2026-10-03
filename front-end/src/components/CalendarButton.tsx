import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, CalendarPlus, Download, ExternalLink, Share2, X } from 'lucide-react';
import { CalendarScreening, calendarFile, downloadCalendar } from '../lib/calendar';
import { amsterdamDate, dateLabel, screeningTime } from '../lib/schedule';
import './CalendarButton.css';

function CalendarDialog({ screenings, onClose }: { screenings: CalendarScreening[]; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const reminderId = useId();
  const doubleBill = screenings.length > 1;
  const sameDay = screenings.every(s => amsterdamDate(s.startDate) === amsterdamDate(screenings[0].startDate));
  const [reminder, setReminder] = useState('none');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [sharing, setSharing] = useState(false);
  const [canShare] = useState(() => {
    try { return typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [new File([''], 'screening.ics', { type: 'text/calendar' })] }); }
    catch { return false; }
  });
  useEffect(() => {
    const el = dialog.current;
    const overflow = document.body.style.overflow;
    el?.showModal(); document.body.style.overflow = 'hidden';
    return () => { el?.close(); document.body.style.overflow = overflow; };
  }, []);
  const exportCalendar = async (share: boolean) => {
    if (sharing) return;
    setError(''); setMessage('');
    try {
      const file = calendarFile(screenings, reminder === 'none' ? null : Number(reminder));
      if (share) {
        setSharing(true);
        await navigator.share({ files: [file], title: doubleBill ? 'Double bill' : screenings[0].movieTitle });
        setMessage('Calendar file shared. Confirm the events in your calendar app.');
      } else {
        downloadCalendar(file);
        setMessage('Calendar file downloaded. Open it in your calendar app to add the events.');
      }
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return;
      setError(e instanceof Error ? e.message : 'Could not export the calendar. Try downloading the file.');
    } finally { setSharing(false); }
  };
  return <dialog ref={dialog} className="cc-dialog cc-calendar-dialog" aria-label={doubleBill ? 'Add double bill to calendar' : 'Add screening to calendar'} onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <header className="cc-calendar-header">
      <div className="cc-calendar-heading"><span className="cc-calendar-icon"><CalendarPlus size={21}/></span><div><span className="cc-calendar-eyebrow">Add to calendar</span><h2>{doubleBill ? 'Your double bill' : 'Your screening'}</h2></div></div>
      <button className="cc-calendar-close" aria-label="Close calendar export" onClick={onClose}><X size={20}/></button>
    </header>
    <div className="cc-calendar-body">
      <p className="cc-calendar-date">{sameDay ? dateLabel(amsterdamDate(screenings[0].startDate)) : 'Your programme'}<span>{doubleBill ? '2 separate events' : '1 event'} · Amsterdam time</span></p>
      <ol className="cc-calendar-events">{screenings.map((s,index) => <li key={s.showtimeId}>
        <span className="cc-calendar-number" aria-hidden="true">{index+1}</span>
        <div className="cc-calendar-film"><h3>{s.movieTitle}</h3>{!sameDay && <span className="cc-calendar-event-date">{dateLabel(amsterdamDate(s.startDate))}</span>}<strong className="cc-calendar-time">{screeningTime(s.startDate)} <span>–</span> {screeningTime(s.endDate)}{amsterdamDate(s.startDate) !== amsterdamDate(s.endDate) && <small> · {dateLabel(amsterdamDate(s.endDate))}</small>}</strong><span className="cc-calendar-venue">{s.theaterName} · {s.theaterCity}</span></div>
        {s.ticketingUrl ? <a className="cc-calendar-ticket" href={s.ticketingUrl} target="_blank" rel="noopener noreferrer" aria-label={`Tickets for ${s.movieTitle}`}>Tickets <ExternalLink size={13}/></a> : <span className="cc-calendar-no-ticket">No ticket link</span>}
      </li>)}</ol>
      <div className="cc-calendar-reminder"><label htmlFor={reminderId}><Bell size={17}/><span>Reminder{doubleBill ? ' for each film' : ''}</span></label><select id={reminderId} value={reminder} onChange={e => setReminder(e.target.value)}><option value="none">No reminder</option><option value="15">15 minutes before</option><option value="30">30 minutes before</option><option value="60">1 hour before</option><option value="1440">1 day before</option></select></div>
      <details className="cc-calendar-help"><summary>Using Apple Calendar on iPhone?</summary><p>Share the .ics file to Mail, send it to yourself, then open the attachment in Apple Mail to add the events. You’ll confirm the calendar there.</p></details>
    </div>
    <footer className="cc-calendar-footer">
      <div className={`cc-calendar-actions ${canShare ? 'with-share' : ''}`}><button className="cc-calendar-download" disabled={sharing} onClick={() => exportCalendar(false)}><Download size={17}/>Download calendar file</button>{canShare && <button className="cc-calendar-share" disabled={sharing} onClick={() => exportCalendar(true)}><Share2 size={17}/>{sharing ? 'Sharing…' : 'Share calendar file'}</button>}</div>
      <p className="cc-calendar-caption">Includes cinema, times{screenings.some(s => s.ticketingUrl) ? ', and ticket links' : ''}. Your calendar app controls reminders.</p>
      {message && <p role="status" className="cc-calendar-status">{message}</p>}{error && <p role="alert" className="cc-calendar-error">{error}</p>}
    </footer>
  </dialog>;
}
export default function CalendarButton({ screenings, className = '', label = 'Add to calendar' }: { screenings: CalendarScreening[]; className?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return <><button ref={trigger} className={className} onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label={`${label}: ${screenings.map(s => s.movieTitle).join(' + ')}`}><CalendarPlus size={14}/><span className="cc-action-label">{label}</span></button>{open && createPortal(<CalendarDialog screenings={screenings} onClose={() => setOpen(false)}/>, trigger.current?.closest('.cc-app') || document.body)}</>;
}
