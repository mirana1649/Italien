import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { AGENCY_CATS } from '../agencyMeta.js';
import { useLang } from '../i18n.jsx';
import { useUI } from '../ui.jsx';
import { CONTACT } from '../components/Layout.jsx';

// Espace Agence (étudiant) : une catégorie à la fois, les étapes dans l'ordre. Seul l'admin crée les démarches.
export default function Agency() {
  const { toast, celebrate } = useUI(); const { t } = useLang();
  const [d, setD] = useState(null); const [err, setErr] = useState(''); const [tab, setTab] = useState(null);
  const load = () => api('/agency').then(setD).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);
  const groups = useMemo(() => { const g = {}; (d?.steps || []).forEach((s) => { (g[s.category] ||= []).push(s); }); return g; }, [d]);
  if (err) return <p className="error">{err}</p>;
  if (!d) return <p className="center">{t('loading')}</p>;

  const cats = Object.keys(AGENCY_CATS).filter((k) => groups[k]);
  const current = tab && groups[tab] ? tab : cats[0];
  const total = d.steps.length, done = d.steps.filter((s) => s.done).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const catName = (k) => t(`cat_${k}`);

  const join = async () => { await api('/agency/join', { method: 'POST' }); celebrate(); toast(t('ag_welcome'), 'green'); load(); };
  const toggle = async (s) => {
    const next = !s.done;
    setD({ ...d, steps: d.steps.map((x) => (x.id === s.id ? { ...x, done: next } : x)) });
    try {
      await api(`/agency/steps/${s.id}/toggle`, { method: 'POST', body: { done: next } });
      if (next && d.steps.filter((x) => x.category === s.category).every((x) => x.id === s.id || x.done)) { celebrate(); toast(t('ag_done', catName(s.category)), 'green'); }
    } catch (e) { toast(e.message); load(); }
  };

  return (
    <div className="ag">
      <section className="ag-head card">
        <h1>{t('ag_title')}</h1>
        <p className="muted">{t('ag_sub')}</p>
        {d.joined ? (
          <>
            <div className="bar"><i style={{ width: `${pct}%` }} /></div>
            <p className="ag-prog">{t('ag_progress', done, total, pct)}</p>
          </>
        ) : (
          <div className="ag-join">
            <div><strong>{t('ag_join_t')}</strong><p className="muted" style={{ margin: '.2rem 0 0' }}>{t('ag_join_p')}</p></div>
            <div className="row wrap"><button className="primary" onClick={join}>{t('ag_join')}</button>
              <a className="btn ghost" href={CONTACT.whatsappLink} target="_blank" rel="noreferrer">{t('ag_wa')}</a></div>
          </div>
        )}
      </section>

      {total === 0 && <p className="muted">{t('ag_empty')}</p>}
      {cats.length > 0 && (
        <div className={d.joined ? '' : 'locked'}>
          <div className="lvl-tabs">{cats.map((k) => {
            const n = groups[k].filter((s) => s.done).length;
            return <button key={k} className={current === k ? 'on' : ''} onClick={() => setTab(k)}>{catName(k)} <small>{n}/{groups[k].length}</small></button>;
          })}</div>
          <section className="card">
            {groups[current].map((s, i) => (
              <div key={s.id} className={`step ${s.done ? 'done' : ''}`}>
                <label>
                  <input type="checkbox" checked={s.done} onChange={() => toggle(s)} />
                  <span><b><em className="num">{i + 1}</em>{s.title}</b>
                    {s.description && <small>{s.description}</small>}
                    {s.link_url && <small><a href={s.link_url} target="_blank" rel="noreferrer">{t('ag_link')}</a></small>}</span>
                </label>
              </div>
            ))}
          </section>
        </div>
      )}
      <p><Link to="/espace">{t('back_home')}</Link></p>
    </div>
  );
}
