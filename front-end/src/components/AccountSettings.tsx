import React from 'react';
import { useAccount } from './AccountProvider';
export default function AccountSettings() {
  const account=useAccount();
  if(!account) return null;
  return <section aria-labelledby="cc-account-title"><h3 id="cc-account-title">Account & sync</h3>
    {account.user ? <><p>Signed in as <strong>{account.user.name}</strong>.</p><div className="cc-account-actions"><button className="cc-text-button" disabled={account.busy} onClick={account.logout}>Sign out</button></div><details><summary>Settings on this device</summary><p>Replace account settings with the guest preferences saved on this device, or reload the latest account settings. Reloading discards unsynced changes.</p><div className="cc-account-actions"><button disabled={account.busy} onClick={account.importGuest}>Import guest settings</button><button disabled={account.busy} onClick={account.reload}>Reload account settings</button></div></details></> : <><p>Sync your preferences, watchlist films, saved screenings and hidden films across devices. Sign in with your Heimdall account.</p><button className="cc-primary" disabled={account.busy} onClick={account.login}>Sign in with Heimdall</button><p>You can keep browsing without an account.</p></>}
    {account.status && <p role="status">{account.status}</p>}{account.error && <p className="cc-error" role="alert">{account.error}</p>}
  </section>;
}
