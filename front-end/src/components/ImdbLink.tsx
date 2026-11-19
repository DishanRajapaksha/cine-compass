import React, { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { getOmdbKey, IMDB_SETTINGS_EVENT, ImdbMatch, resolveImdb } from '../services/imdbService';
import { useAccount } from './AccountProvider';

export default function ImdbLink({ title, year }: { title: string; year?: number }) {
  const [key,setKey] = useState(getOmdbKey);
  const [match,setMatch] = useState<ImdbMatch | null>(null);
  const account = useAccount();
  const userId = account?.user?.id;
  const omdb = account?.omdb;
  useEffect(() => {
    const update = () => setKey(getOmdbKey());
    window.addEventListener(IMDB_SETTINGS_EVENT,update);
    window.addEventListener('storage',update);
    return () => {window.removeEventListener(IMDB_SETTINGS_EVENT,update);window.removeEventListener('storage',update);};
  },[]);
  useEffect(() => {
    let active = true;
    setMatch(null);
    const credential = userId && omdb?.enabled ? {userId,revision:omdb.revision} : key;
    if (credential) resolveImdb(title,year,credential).then(result => {if (active) setMatch(result);});
    return () => {active=false;};
  },[title,year,key,userId,omdb]);
  const query = `${title}${year ? ` ${year}` : ''}`;
  return <a className="cc-imdb-link" href={match ? `https://www.imdb.com/title/${match.id}/` : `https://www.imdb.com/find/?q=${encodeURIComponent(query)}&s=tt`} target="_blank" rel="noopener noreferrer" aria-label={match ? `View ${query} on IMDb${match.rating ? `, rated ${match.rating} out of 10` : ''}` : `Search IMDb for ${query}`} title={`${match ? 'View on' : 'Search'} IMDb (opens in a new tab)`}><span className="cc-imdb-wordmark">IMDb</span>{match?.rating ? ` ${match.rating}` : ''} <ExternalLink size={11}/></a>;
}
