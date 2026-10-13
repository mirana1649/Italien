import nodemailer from 'nodemailer';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const LOGO = path.join(here, '..', 'assets', 'logo.png');

const env = process.env;
export const mailConfigured = !!(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);

const transporter = mailConfigured
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: Number(env.SMTP_PORT || 465),
      secure:
        String(
          env.SMTP_SECURE ??
            (Number(env.SMTP_PORT || 465) === 465)
        ) === 'true',

      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },

      tls: {
        rejectUnauthorized: true,
      },
    })
  : null;
const FROM = env.MAIL_FROM || (env.SMTP_USER ? `Vianova Academy <${env.SMTP_USER}>` : 'Vianova Academy <no-reply@vianova.local>');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * Envoie un e-mail. Ne lève jamais d'erreur : renvoie { sent, reason }.
 * Sans SMTP configuré (développement), le message est affiché dans la console du serveur.
 */
export async function sendMail({ to, subject, text, html }) {
  if (!mailConfigured) {
    console.log(`\n[MAIL] SMTP non configuré : e-mail NON envoyé.\n  À : ${to}\n  Objet : ${subject}\n${text.split('\n').map((l) => '  | ' + l).join('\n')}\n`);
    return { sent: false, reason: 'smtp_not_configured' };
  }
  try {
    await transporter.sendMail({
      from: FROM, to, subject, text, html,
      attachments: [{ filename: 'logo.png', path: LOGO, cid: 'logo@vianova' }],
    });
    return { sent: true };
  } catch (e) {
    console.error('[MAIL] échec d\'envoi :', e.message);
    return { sent: false, reason: e.message };
  }
}

const fmtDate = (iso) => {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00Z`);
  const s = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** E-mail de confirmation d'admission à un cours : nom du cours, professeur, date et heure. */
export function admissionEmail({ student, course, teacher }) {
  const date = fmtDate(course.starts_on);
  const time = course.start_time ? course.start_time.slice(0, 5).replace(':', 'h') : null;
  const rows = [
    ['Cours', `${course.title} (niveau ${course.level})`],
    ['Professeur', teacher || 'Sera communiqué prochainement'],
    ['Date de début', date || 'Sera communiquée prochainement'],
    ['Heure', time ? `${time} (heure de Madagascar)` : 'Sera communiquée prochainement'],
  ];
  if (course.schedule) rows.push(['Rythme des séances', course.schedule]);
  rows.push(['Nombre de séances', String(course.total_sessions)]);

  const link = (env.CLIENT_URL || '').split(',')[0].trim();
  const first = student.name.trim().split(/\s+/)[0];
  const subject = `Admission confirmée : ${course.title}`;

  const text = [
    `Bonjour ${first},`,
    '',
    'Votre admission au cours suivant est confirmée.',
    '',
    ...rows.map(([k, v]) => `${k} : ${v}`),
    '',
    link ? `Connectez-vous à votre espace étudiant : ${link}` : 'Connectez-vous à votre espace étudiant avec votre adresse e-mail.',
    '',
    'À très bientôt,',
    "L'équipe Vianova Academy",
  ].join('\n');

  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#f6f7f4;font-family:Arial,Helvetica,sans-serif;color:#1b241f">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fff;border:1px solid #e5e8e2;border-radius:12px;overflow:hidden">
<tr><td style="height:5px;background:linear-gradient(90deg,#008C45 0 33%,#ffffff 33% 66%,#CD212A 66%)"></td></tr>
<tr><td align="center" style="padding:24px 24px 8px"><img src="cid:logo@vianova" alt="Vianova Academy" height="90" style="height:90px;width:auto"></td></tr>
<tr><td style="padding:8px 32px 8px">
<h1 style="font-size:22px;margin:12px 0 8px">Admission confirmée</h1>
<p style="margin:0 0 16px;line-height:1.5">Bonjour ${esc(first)}, votre admission au cours suivant est confirmée.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e5e8e2">
${rows.map(([k, v]) => `<tr><td style="padding:10px 0;border-bottom:1px solid #e5e8e2;color:#66726a;width:40%;font-size:14px">${esc(k)}</td><td style="padding:10px 0;border-bottom:1px solid #e5e8e2;font-weight:bold;font-size:15px">${esc(v)}</td></tr>`).join('')}
</table>
${link ? `<p style="text-align:center;margin:28px 0 12px"><a href="${esc(link)}" style="background:#008C45;color:#fff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:8px;display:inline-block">Accéder à mon espace étudiant</a></p>` : ''}
<p style="color:#66726a;font-size:13px;line-height:1.5;margin:16px 0 24px">À très bientôt,<br>L'équipe Vianova Academy</p>
</td></tr></table></td></tr></table></body></html>`;

  return { subject, text, html };
}
