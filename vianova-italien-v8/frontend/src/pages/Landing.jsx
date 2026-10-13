import { useRef } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { LangSwitch, useLang } from '../i18n.jsx';
import { COPY } from '../landingCopy.js';
import { HOME } from '../routes.js';
import { CONTACT } from '../components/Layout.jsx';
import LoginForm from '../components/LoginForm.jsx';
import Logo from '../components/Logo.jsx';
import { ThemeToggle } from '../components/theme.jsx';
import HeroStory from '../components/HeroStory.jsx';
import ServicesSlider from '../components/ServicesSlider.jsx';
import { useHeroSnap, useReveal } from '../scrollFx.js';

// Page d'accueil publique. Dès qu'on a un compte et qu'on est connecté, on ne la voit plus : on arrive directement dans son espace.
export default function Landing() {
  const { user, loading } = useAuth(); const { lang } = useLang();
  const root = useRef(null);
  useReveal(root, '.pub-sec h2, .sv, .steps li, .lv, .pub-sec > p, .pub-wrap > h2, .pub-cta-in, .foot-in > div', [loading, user]);
  useHeroSnap([loading, user]);
  if (loading) return <p className="center">…</p>;
  if (user) return <Navigate to={HOME[user.role]} replace />;
  const c = COPY[lang] || COPY.fr;
  const anchors = [['services', c.nav.services], ['comment', c.nav.how], ['niveaux', c.nav.levels], ['contact', c.nav.contact]];

  return (
    <div className="pub" ref={root}>
      <div className="stripe" />
      <div className="pub-bar">
        <div className="pub-bar-in">
          <span>{c.tagline}</span>
          <span className="row">
            <a href={CONTACT.whatsappLink} target="_blank" rel="noreferrer">WhatsApp {CONTACT.whatsapp}</a>
            <LangSwitch /><ThemeToggle />
          </span>
        </div>
      </div>

      <header className="pub-top">
        <div className="pub-top-in">
          <Link to="/" className="logo" aria-label="Vianova Academy"><Logo size="lg" /></Link>
          <nav aria-label="Menu">{anchors.map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}</nav>
          <a className="btn ghost-btn" href="#connexion">{c.login}</a>
          <Link className="primary btn" to="/inscription">{c.signup}</Link>
        </div>
      </header>

      <main>
        <section className="pub-hero">
          <div className="hero-bg" aria-hidden="true"><i /><i /><i /></div>
          <div className="pub-hero-in">
            <div className="hero-text">
              <HeroStory c={c} />
              <div className="row wrap">
                <Link className="primary btn big" to="/inscription">{c.signup}</Link>
                <a className="btn ghost-btn big" href="#services">{c.seeServices}</a>
              </div>
              <ul className="facts">{c.facts.map((f) => <li key={f}>{f}</li>)}</ul>
            </div>
            <aside id="connexion" className="login-card" aria-labelledby="login-title">
              <h2 id="login-title">{c.card.title}</h2>
              <p className="muted">{c.card.sub}</p>
              <LoginForm labels={c.card} />
            </aside>
          </div>
          <a className="scroll-cue" href="#services" aria-label={c.seeServices}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></a>
        </section>

        <section id="services" className="pub-sec">
          <h2>{c.servicesTitle}</h2>
          <ServicesSlider c={c} />
        </section>

        <section id="comment" className="pub-sec tint">
          <div className="pub-wrap">
            <h2>{c.howTitle}</h2>
            <ol className="steps">{c.steps.map(([t, d], i) => <li key={t}><i>{i + 1}</i><b>{t}</b><span>{d}</span></li>)}</ol>
          </div>
        </section>

        <section id="niveaux" className="pub-sec">
          <h2>{c.levelsTitle}</h2>
          <ul className="lv">{c.levels.map(([code, name]) => <li key={code}><b>{code}</b><span>{name}</span></li>)}</ul>
          <p className="muted">{c.levelsNote}</p>
        </section>

        <section className="pub-cta">
          <div className="pub-cta-in">
            <div><h2>{c.ctaTitle}</h2><p>{c.ctaText}</p></div>
            <div className="row wrap">
              <Link className="btn white-btn" to="/inscription">{c.signup}</Link>
              <a className="btn line-btn" href={CONTACT.whatsappLink} target="_blank" rel="noreferrer">{c.wa}</a>
            </div>
          </div>
        </section>
      </main>

      <footer id="contact" className="foot">
        <div className="foot-in">
          <div className="foot-brand"><Logo size="xl" full /><p>{c.tagline}</p></div>
          <div>
            <h4>{c.explore}</h4>
            {anchors.slice(0, 3).map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}
            <Link to="/inscription">{c.signup}</Link>
          </div>
          <div>
            <h4>{c.contact}</h4>
            <a href={CONTACT.whatsappLink} target="_blank" rel="noreferrer">WhatsApp {CONTACT.whatsapp}</a>
            <span>Facebook : {CONTACT.facebook}</span>
          </div>
        </div>
        <div className="foot-bottom"><span>© {new Date().getFullYear()} Vianova Academy · Madagascar → Italia</span><span>{c.rights}</span></div>
      </footer>
    </div>
  );
}
