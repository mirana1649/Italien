import { useRef } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { LangSwitch, useLang } from '../i18n.jsx';
import Logo from './Logo.jsx';
import { ThemeToggle } from './theme.jsx';
import { HOME } from '../routes.js';
import { useReveal } from '../scrollFx.js';

export const CONTACT = { whatsapp: '+39 350 826 8485', whatsappLink: 'https://wa.me/393508268485', facebook: 'Studiamo la lingua italiana & Studiamo in Italia' };

const menus = {
  student: [['/espace', 'nav_home'], ['/examen', 'nav_exam'], ['/vocabulaire', 'nav_vocab'], ['/agence', 'nav_agency']],
  teacher: [['/prof', 'Mes étudiants et oraux']],
  admin: [['/admin/suivi', 'Suivi'], ['/admin/etudiants', 'Étudiants'], ['/admin/utilisateurs', 'Utilisateurs'], ['/admin/cours', 'Cours et leçons'], ['/admin/examens', 'Examens'], ['/admin/oraux', 'Oraux'], ['/admin/agence', 'Agence'], ['/admin/ecole', 'Annonces']],
};


export default function Layout({ children }) {
  const { user, logout, stats } = useAuth();
  const { t } = useLang();
  const nav = useNavigate(); const loc = useLocation();
  const homeLink = HOME[user.role];
  const items = menus[user.role].map(([to, label]) => [to, label.startsWith('nav_') ? t(label) : label]);
  const isStudent = user.role === 'student';
  const mainRef = useRef(null);
  useReveal(mainRef, '.hs, .card:not(.qcard), .kpi, .ag-cats > *, .sec', [loc.pathname]);
  return (
    <>
      <div className="stripe" />
      <header className="top">
        <div className="top-in">
          <Link to={homeLink} className="logo" aria-label="Vianova Academy"><Logo size="sm" /></Link>
          <nav>{items.map(([to, label]) => <NavLink key={to} to={to} end>{label}</NavLink>)}</nav>
          {stats && <span className="pill" title="XP">{stats.xp} XP</span>}
          {isStudent && <LangSwitch />}
          <ThemeToggle />
          <span className="avatar" title={user.name}>{user.name.trim()[0]?.toUpperCase()}</span>
          <button className="ghost" onClick={() => { logout(); nav('/'); }}>{t('quit')}</button>
        </div>
      </header>
      <main className="page" key={loc.pathname} ref={mainRef}>{children}</main>
      <footer className="foot">
        <div className="foot-in">
          <div className="foot-brand">
            <Logo size="xl" full />
            <p>{t('foot_tag')}</p>
          </div>
          <div>
            <h4>{t('foot_nav')}</h4>
            {items.map(([to, label]) => <Link key={to} to={to}>{label}</Link>)}
          </div>
          <div>
            <h4>{t('foot_contact')}</h4>
            <a href={CONTACT.whatsappLink} target="_blank" rel="noreferrer">WhatsApp {CONTACT.whatsapp}</a>
            <span>Facebook : {CONTACT.facebook}</span>
          </div>
        </div>
        <div className="foot-bottom"><span>© {new Date().getFullYear()} Vianova Academy · Madagascar → Italia</span><span>{t('foot_rights')}</span></div>
      </footer>
    </>
  );
}
