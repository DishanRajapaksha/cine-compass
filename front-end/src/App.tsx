import React, { useEffect, useState } from 'react';
import MovieGallery from './components/MovieGallery';
import CinemaSchedule from './components/CinemaSchedule';

function App() {
  const [classic, setClassic] = useState(() => window.location.hash === '#classic');
  useEffect(() => {
    const handleHash = () => setClassic(window.location.hash === '#classic');
    window.addEventListener('hashchange',handleHash);
    return () => window.removeEventListener('hashchange',handleHash);
  }, []);
  return classic ? <div className="min-h-screen bg-slate-50 text-slate-900"><div className="px-4 pt-4"><a href="#schedule" className="text-sm font-semibold text-indigo-700 underline">← New programme view</a></div><MovieGallery/></div> : <CinemaSchedule/>;
}
export default App;
