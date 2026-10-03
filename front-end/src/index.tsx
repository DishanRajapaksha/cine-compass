import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import AccountProvider from './components/AccountProvider';
import reportWebVitals from './reportWebVitals';

// iOS exposes home-screen mode here even when its display-mode query is false.
const iosNavigator = navigator as Navigator & { standalone?: boolean };
document.documentElement.classList.toggle('ios-standalone', iosNavigator.standalone === true);

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <AccountProvider><App /></AccountProvider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

// Only production builds install a worker; development always uses fresh assets.
if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js?v=2', { updateViaCache: 'none' })
      .catch(error => console.warn('CineCompass offline support could not start.', error));
  });
}
