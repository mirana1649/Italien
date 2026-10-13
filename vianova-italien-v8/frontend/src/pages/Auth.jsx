import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import LoginForm from '../components/LoginForm.jsx';
import { HOME } from '../routes.js';
import { LangSwitch, useLang } from '../i18n.jsx';
import Logo from '../components/Logo.jsx';

const LEVELS = [
  ['A1', 'A1 – Débutant'], ['A2', 'A2 – Élémentaire'], ['B1', 'B1 – Intermédiaire'],
  ['B2', 'B2 – Intermédiaire avancé'], ['C1', 'C1 – Autonome'], ['C2', 'C2 – Maîtrise'],
];

function Shell({ title, sub, children }) {
  return (
    <div className="auth">
      <aside>
        <Link to="/" className="brand-plate" aria-label="Vianova Academy"><Logo size="xl" full /></Link>
        <h1>Ton prochain diplôme est en Italie</h1>
        <p>Apprends l’italien avant de partir : leçon, écoute, exercice et oral. Et suis ton projet d’études avec l’agence : bourses, visa, logement.</p>
      </aside>
      <section className="card"><div className="row between"><h2 style={{ margin: 0 }}>{title}</h2><LangSwitch /></div><p className="muted">{sub}</p>{children}</section>
    </div>
  );
}

export function Login() {
  return (
    <Shell title="Connexion" sub="Accédez à vos cours.">
      <LoginForm labels={{ email: 'Email', password: 'Mot de passe', submit: 'Se connecter', forgot: 'Mot de passe oublié ?', signup: 'Créer un compte étudiant' }} />
    </Shell>
  );
}

export function Register() {
  const { start } = useAuth(); const nav = useNavigate();
  const { lang, t } = useLang();
  const [f, setF] = useState({ name: '', email: '', password: '', level: '', city: '', phone: '' }); const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setErr('');
    try { const d = await api('/auth/register', { method: 'POST', body: { ...f, lang } }); start(d); nav(HOME.student); }
    catch (x) { setErr(x.message); }
  };
  return (
    <Shell title="Créer mon compte" sub="Indiquez votre niveau d'italien pour que l'école vous place dans le bon cours.">
      <form onSubmit={submit}>
        <label>Nom complet<input required value={f.name} onChange={set('name')} /></label>
        <label>Email<input type="email" required value={f.email} onChange={set('email')} /></label>
        <label>Mot de passe (8 caractères minimum)<input type="password" minLength={8} required value={f.password} onChange={set('password')} /></label>
        <label>Ville / quartier où j'habite<input required value={f.city} onChange={set('city')} placeholder="Ex : Antananarivo, Analakely" /></label>
        <label>Téléphone / WhatsApp<input type="tel" value={f.phone} onChange={set('phone')} placeholder="+261 …" /></label>
        <label>Mon niveau d'italien
          <select required value={f.level} onChange={set('level')}>
            <option value="" disabled>Choisir un niveau…</option>
            {LEVELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <p className="muted" style={{ margin: '.2rem 0' }}>{t('study_lang')} : <strong>{lang === 'fr' ? 'Français' : lang === 'it' ? 'Italiano' : 'English'}</strong> (menu ci-dessus)</p>
        {err && <p className="error">{err}</p>}
        <button className="primary">Créer mon compte</button>
      </form>
      <p className="links"><Link to="/login">J'ai déjà un compte</Link></p>
    </Shell>
  );
}

export function Forgot() {
  const [email, setEmail] = useState(''); const [msg, setMsg] = useState('');
  const submit = async (e) => { e.preventDefault(); setMsg((await api('/auth/forgot-password', { method: 'POST', body: { email } })).message); };
  return (
    <Shell title="Mot de passe oublié" sub="Nous vous envoyons un lien de réinitialisation.">
      <form onSubmit={submit}>
        <label>Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        {msg && <p className="ok">{msg}</p>}
        <button className="primary">Envoyer le lien</button>
      </form>
      <p className="links"><Link to="/login">Retour à la connexion</Link></p>
    </Shell>
  );
}

export function Reset() {
  const [params] = useSearchParams(); const nav = useNavigate();
  const [password, setPassword] = useState(''); const [err, setErr] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    try { await api('/auth/reset-password', { method: 'POST', body: { token: params.get('token'), password } }); nav('/login'); }
    catch (x) { setErr(x.message); }
  };
  return (
    <Shell title="Nouveau mot de passe" sub="Choisissez un mot de passe d'au moins 8 caractères.">
      <form onSubmit={submit}>
        <label>Nouveau mot de passe<input type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        {err && <p className="error">{err}</p>}
        <button className="primary">Enregistrer</button>
      </form>
    </Shell>
  );
}
