import { useEffect, useState } from 'react';
import { api, mediaUrl } from '../api.js';
import { useAuth } from '../auth.jsx';

function OralRow({ o, onSaved }) {
  const [score, setScore] = useState(o.score ?? ''); const [comment, setComment] = useState(o.comment ?? ''); const [err, setErr] = useState('');
  const save = async () => {
    try { await api(`/teacher/oral/${o.id}/grade`, { method: 'POST', body: { score, comment } }); onSaved(); }
    catch (e) { setErr(e.message); }
  };
  return (
    <div className="card">
      <p><strong>{o.student}</strong> · {o.lesson} <span className="muted">{new Date(o.created_at).toLocaleString('fr-FR')}</span></p>
      <audio controls src={mediaUrl(o.audio_url)} />
      <div className="row">
        <input type="number" min="0" max="22" step="0.5" placeholder="Note /22" value={score} onChange={(e) => setScore(e.target.value)} style={{ maxWidth: 120 }} />
        <input placeholder="Commentaire pour l'étudiant" value={comment} onChange={(e) => setComment(e.target.value)} />
        <button className="primary" onClick={save}>Enregistrer</button>
      </div>
      {err && <p className="error">{err}</p>}
    </div>
  );
}

export default function Teacher() {
  const { user } = useAuth();
  const [students, setStudents] = useState([]); const [orals, setOrals] = useState([]);
  const load = () => { api('/teacher/students').then(setStudents); api('/teacher/oral').then(setOrals); };
  useEffect(load, []);
  return (
    <div>
      <h2>Oraux à corriger ({orals.length})</h2>
      {orals.length === 0 && <p className="muted">Aucun oral en attente.</p>}
      {orals.map((o) => <OralRow key={o.id} o={o} onSaved={load} />)}
      {user.role === 'teacher' && (
        <>
          <h2>Mes étudiants</h2>
          <div className="card scroll"><table>
            <thead><tr><th>Nom</th><th>Niveau</th><th>Cours</th><th>Séances restantes</th><th>Moy. /25</th><th>Dernière connexion</th></tr></thead>
            <tbody>{students.map((s) => (
              <tr key={s.id}><td>{s.name}</td><td>{s.level}</td><td>{s.course}</td><td>{s.sessions_remaining}</td><td>{s.avg_score ?? '—'}</td>
                <td>{s.last_login ? new Date(s.last_login).toLocaleDateString('fr-FR') : 'Jamais'}</td></tr>
            ))}</tbody>
          </table></div>
        </>
      )}
    </div>
  );
}
