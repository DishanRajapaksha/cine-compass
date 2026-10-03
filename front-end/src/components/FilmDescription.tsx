import React, { useEffect, useRef, useState } from 'react';
import { Languages } from 'lucide-react';
import { Movie } from '../types/Movie';
import { translateDescription } from '../services/translationService';
import { plainDescription } from './ScreeningRow';

export default function FilmDescription({ movie }: { movie: Movie }) {
  const original = plainDescription(movie.overview).trim();
  const [translation, setTranslation] = useState('');
  const [showEnglish, setShowEnglish] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  const translate = async () => {
    if (translation) { setShowEnglish(true); return; }
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError('');
    try {
      const value = await translateDescription(original, controller.signal);
      if (!controller.signal.aborted) {
        setTranslation(value);
        setShowEnglish(true);
      }
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Translation is unavailable right now. Please try again.');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  const canTranslate = original && original !== 'No description available.' && movie.overviewLanguage !== 'en';
  return <>
    <p className="cc-detail-synopsis" lang={showEnglish ? 'en' : movie.overviewLanguage} aria-live="polite">{showEnglish ? translation : original}</p>
    {canTranslate && <div className="cc-translation">
      <button disabled={loading} onClick={showEnglish ? () => setShowEnglish(false) : translate}>
        <Languages size={15} aria-hidden="true"/>{loading ? 'Translating…' : showEnglish ? 'Show original' : 'Translate to English'}
      </button>
      <small>{showEnglish ? 'Machine translation · MyMemory' : 'Sends this description to MyMemory when you translate.'}</small>
      {loading && <span className="cc-translation-status" role="status">Translating description to English…</span>}
      {error && <span className="cc-translation-error" role="alert">{error}</span>}
    </div>}
  </>;
}
