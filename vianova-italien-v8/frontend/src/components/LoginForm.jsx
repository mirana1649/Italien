import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { HOME } from '../routes.js';

// Formulaire de connexion partagé : page d'accueil publique et page /login.
// Une fois connecté, chacun va directement dans son espace.
export default function LoginForm({ labels }) {
  const { start } = useAuth(); const nav = useNavigate();
  const [f, setF] = useState({ email: '', password: '' }); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { const d = await api('/auth/login', { method: 'POST', body: f }); start(d); nav(HOME[d.user.role]); }
    catch (x) { setErr(x.message); setBusy(false); }
  };
  return (
    <form onSubmit={submit}>
      <label>{labels.email}<input type="email" autoComplete="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
      <label>{labels.password}<input type="password" autoComplete="current-password" required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></label>
      {err && <p className="error" role="alert">{err}</p>}
      <button className="primary full-btn" disabled={busy}>{labels.submit}</button>
      <p className="links"><Link to="/forgot">{labels.forgot}</Link><Link to="/inscription">{labels.signup}</Link></p>
    </form>
  );
}
