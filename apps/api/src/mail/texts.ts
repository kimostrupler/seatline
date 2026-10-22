import type { MailLanguage } from '@seatline/shared';
import type { Mail } from './mail.service';

// E-mail texts (en, Swiss German, French). Plain text: no tracking, no images.

export function signInMail(to: string, link: string, language: MailLanguage): Mail {
  const t = {
    en: {
      subject: 'Your Seatline sign-in link',
      text: `Hello,\n\nUse this link to sign in to Seatline. It works once and for 15 minutes:\n\n${link}\n\nIf you didn't ask for it, just ignore this e-mail — nobody can sign in without it.\n\nSeatline`,
    },
    de: {
      subject: 'Ihr Anmeldelink für Seatline',
      text: `Guten Tag\n\nMit diesem Link melden Sie sich bei Seatline an. Er funktioniert einmal und 15 Minuten lang:\n\n${link}\n\nFalls Sie ihn nicht angefordert haben, ignorieren Sie diese E-Mail einfach — ohne den Link kann sich niemand anmelden.\n\nSeatline`,
    },
    fr: {
      subject: 'Votre lien de connexion à Seatline',
      text: `Bonjour,\n\nCe lien vous connecte à Seatline. Il fonctionne une seule fois, pendant 15 minutes :\n\n${link}\n\nSi vous ne l’avez pas demandé, ignorez simplement cet e-mail — personne ne peut se connecter sans ce lien.\n\nSeatline`,
    },
  }[language];
  return { to, ...t };
}

export function inviteMail(
  to: string,
  invitedBy: string,
  workspace: string,
  link: string,
  language: MailLanguage,
): Mail {
  const t = {
    en: {
      subject: `${invitedBy} added you to Seatline`,
      text: `Hello,\n\n${invitedBy} added you to ${workspace} on Seatline, where your office's desks are planned.\n\nTo sign in, open ${link} and enter this e-mail address. You'll get a link to sign in — no password needed.\n\nSeatline`,
    },
    de: {
      subject: `${invitedBy} hat Sie zu Seatline hinzugefügt`,
      text: `Guten Tag\n\n${invitedBy} hat Sie bei ${workspace} auf Seatline hinzugefügt, wo die Arbeitsplätze Ihres Büros geplant werden.\n\nZum Anmelden öffnen Sie ${link} und geben diese E-Mail-Adresse ein. Sie erhalten einen Anmeldelink — ohne Passwort.\n\nSeatline`,
    },
    fr: {
      subject: `${invitedBy} vous a ajouté à Seatline`,
      text: `Bonjour,\n\n${invitedBy} vous a ajouté à ${workspace} sur Seatline, où les postes de travail de votre bureau sont planifiés.\n\nPour vous connecter, ouvrez ${link} et saisissez cette adresse e-mail. Vous recevrez un lien de connexion — sans mot de passe.\n\nSeatline`,
    },
  }[language];
  return { to, ...t };
}
