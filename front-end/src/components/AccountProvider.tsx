import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Account, api, ApiError, passkey, resetCsrf, Settings } from '../services/accountService';
import { applySettings, settingsEvent, snapshot } from '../lib/accountStorage';

type AccountState = {user:Account|null;status:string;error:string;busy:boolean;register:(name:string)=>Promise<void>;login:()=>Promise<void>;logout:()=>Promise<void>;addPasskey:()=>Promise<void>;reload:()=>Promise<void>;importGuest:()=>Promise<void>};
const AccountContext = createContext<AccountState | null>(null);
export const useAccount = () => useContext(AccountContext);
const guestKey='cinecompass_guest_settings';
const activeKey='cinecompass_active_account';
const stable = (values:Record<string,string>) => JSON.stringify(Object.entries(values).sort(([a],[b])=>a.localeCompare(b)));
export default function AccountProvider({children}:{children:React.ReactNode}) {
  const [user,setUser]=useState<Account|null>(null), [ready,setReady]=useState(false), [workspace,setWorkspace]=useState(0);
  const [status,setStatus]=useState(''), [error,setError]=useState(''), [busy,setBusy]=useState(false);
  const current=useRef<Account|null>(null), revision=useRef(0), baseline=useRef(''), blocked=useRef(false), writing=useRef(false);
  const guest=useRef<Record<string,string>>({});
  const restoreGuest=useCallback(() => {applySettings(guest.current);localStorage.removeItem(activeKey);current.current=null;setUser(null);setWorkspace(n=>n+1);},[]);
  const load=useCallback(async (account:Account) => {
    const settings=await api<Settings>('/settings');
    if(settings.userId!==account.id) throw new Error('The account changed in another tab. Reload this page.');
    applySettings(settings.values);revision.current=settings.revision;baseline.current=stable(snapshot());blocked.current=false;
    localStorage.setItem(activeKey,account.id);current.current=account;setUser(account);setWorkspace(n=>n+1);setStatus('Saved');setError('');
  },[]);
  useEffect(() => {
    let active=true;
    (async () => {
      try {
        const wasAccount=localStorage.getItem(activeKey);
        if (wasAccount) {guest.current=JSON.parse(localStorage.getItem(guestKey)||'{}');applySettings(guest.current);} else {guest.current=snapshot();localStorage.setItem(guestKey,JSON.stringify(guest.current));}
        const {user:account}=await api<{user:Account|null}>('/auth/me');
        if (!active) return;
        if (account) await load(account);else localStorage.removeItem(activeKey);
      } catch { if(active) setStatus('Account service unavailable. Browsing as a guest.'); }
      finally {if(active) setReady(true);}
    })();return () => {active=false;};
  },[load]);
  useEffect(() => {
    let timer:ReturnType<typeof setTimeout>;
    const save=async () => {
      if (!current.current || blocked.current || writing.current) return;
      const account=current.current, values=snapshot();
      if(stable(values)===baseline.current) {setStatus('Saved');return;}
      writing.current=true;setStatus('Saving…');
      try {
        const result=await api<{revision:number}>('/settings','PUT',{revision:revision.current,values,userId:account.id});
        if(current.current?.id!==account.id) return;
        revision.current=result.revision;baseline.current=stable(values);setStatus('Saved');setError('');
      } catch(e) {
        if(e instanceof ApiError && e.status===401) {restoreGuest();resetCsrf();}
        if(e instanceof ApiError && (e.status===409 || e.status===403)) blocked.current=true;
        setStatus('Not synced');setError((e as Error).message);
      } finally {writing.current=false;}
      if(current.current && !blocked.current && stable(snapshot())!==baseline.current) timer=setTimeout(save,3000);
    };
    const changed=() => {
      clearTimeout(timer);
      if(current.current) {if(stable(snapshot())===baseline.current) return;setStatus(blocked.current?'Not synced':'Pending sync');timer=setTimeout(save,600);}
      else {guest.current=snapshot();localStorage.setItem(guestKey,JSON.stringify(guest.current));}
    };
    const online=()=>{changed();};
    const accountChanged=(event:StorageEvent)=>{if(event.key===activeKey && event.newValue!==current.current?.id) window.location.reload();};
    window.addEventListener('storage',accountChanged);
    window.addEventListener(settingsEvent,changed);window.addEventListener('online',online);
    return () => {clearTimeout(timer);window.removeEventListener('storage',accountChanged);window.removeEventListener(settingsEvent,changed);window.removeEventListener('online',online);};
  },[restoreGuest]);
  const run=async (action:()=>Promise<void>)=>{setBusy(true);setError('');try {await action();}catch(e){setError((e as Error).name==='NotAllowedError'?'Passkey request cancelled or timed out. Try again.':(e as Error).message);}finally{setBusy(false);}};
  const authenticate=async (operation:'register'|'login',name?:string)=>{
    guest.current=snapshot();localStorage.setItem(guestKey,JSON.stringify(guest.current));
    const account=await passkey(operation,name);
    if(account) await load(account);
  };
  const state:AccountState={user,status,error,busy,
    register:name=>run(()=>authenticate('register',name)),login:()=>run(()=>authenticate('login')),
    logout:()=>run(async()=>{if(writing.current) throw new Error('Wait for settings to finish saving, then sign out.');await api('/auth/logout','POST',{});resetCsrf();restoreGuest();setStatus('');}),
    addPasskey:()=>run(async()=>{await passkey('passkeys');setStatus('Another passkey added.');}),
    reload:()=>run(async()=>{if(current.current) await load(current.current);}),
    importGuest:()=>run(async()=>{applySettings(guest.current);setWorkspace(n=>n+1);window.dispatchEvent(new Event(settingsEvent));})};
  return <AccountContext.Provider value={state}>{ready ? <React.Fragment key={workspace}>{children}</React.Fragment> : <p role="status">Opening CineCompass…</p>}</AccountContext.Provider>;
}
