import React from 'react';
import { useAccount } from './AccountProvider';

export default function AccountSettings() {
  const account = useAccount();
  if (!account) return null;

  return <section aria-labelledby="cc-account-title">
    <div className="cc-account-heading">
      <h3 id="cc-account-title">Account &amp; sync</h3>
      {account.status && <span role="status">{account.status}</span>}
    </div>
    {account.user ? <>
      <div className="cc-account-session">
        <p>Signed in as <strong>{account.user.name}</strong>.</p>
        <button className="cc-text-button" disabled={account.busy} onClick={account.logout}>Sign out</button>
      </div>
      <details>
        <summary>Settings on this device</summary>
        <p>Replace account settings with the guest preferences saved on this device, or reload the latest account settings. Reloading discards unsynced changes.</p>
        <div className="cc-account-actions">
          <button className="cc-text-button" disabled={account.busy} onClick={account.importGuest}>Import guest settings</button>
          <button className="cc-text-button" disabled={account.busy} onClick={account.reload}>Reload account settings</button>
        </div>
      </details>
    </> : <>
      <p>Sign in with Heimdall to sync your lists, saved screenings and preferences across devices.</p>
      <button className="cc-primary" disabled={account.busy} onClick={account.login}>Sign in with Heimdall</button>
    </>}
    {account.error && <p className="cc-error" role="alert">{account.error}</p>}
  </section>;
}
