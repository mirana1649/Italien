import { useEffect, useState } from 'react';
import { api } from '../api.js';
import Flashcards from '../components/Flashcards.jsx';
import { useLang } from '../i18n.jsx';

export default function Vocab() {
  const { t } = useLang(); const [items, setItems] = useState(null);
  useEffect(() => { api('/student/vocab').then(setItems).catch(() => setItems([])); }, []);
  if (!items) return <p className="center">{t('loading')}</p>;
  return (
    <div>
      <h2>{t('vocab_title')}</h2>
      <p className="muted">{t('vocab_help')}</p>
      <div className="card"><Flashcards items={items} /></div>
    </div>
  );
}
